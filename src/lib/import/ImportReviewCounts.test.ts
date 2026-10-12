/** The "Review import" counts against what the import writes. Real plugins, real merge code. */
import { describe, expect, test, vi } from "vitest";

// UILocalizedLabel imports quill, which needs a DOM at module load - not used by `import`
vi.mock("quill", () => {
	class Quill {
		static import() {
			return class {};
		}
	}
	return { default: Quill, Delta: class {} };
});

import MessageImporter from "./MessageImporter";
import { importWithPlugin } from "./InlangPluginImporter";
import { translationPlugins } from "../transfer/TranslationFormats";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../message/store/LegacyMessageBundleConverter";
import type { Message } from "../message/LegacyMessage";
import LocalizedLabelManagerUI from "../localizedlabels/LocalizedLabelManagerUI";

const plugin = (label: string) =>
	translationPlugins.find((format) => format.label === label)!.plugin;

/** A message as the store has it after reloading the plugin (InlangMessageStoreFigmaRoot.load). */
const stored = (message: Message) => bundleToLegacyMessage(legacyMessageToBundle(message));

/** Runs the real preview statistics and the real `LocalizedLabelManagerUI.import` against one store. */
async function previewAndImport(existing: Message[], incoming: Message[], language: string) {
	const messages = new Map(existing.map((message) => [message.id, structuredClone(message)]));
	const messageStore = {
		getMessage: (id: string) => structuredClone(messages.get(id)),
		getMessageByName: (id: string) => structuredClone(messages.get(id)),
		upsertMessage: async (message: Message) => {
			written.push(structuredClone(message));
			messages.set(message.id, structuredClone(message));
		},
	};
	const written: Message[] = [];
	let refreshedLayers: string[] = [];
	const stats = MessageImporter.getImportStatistics(messageStore as any, incoming, language as any);
	// the real class with its Figma side stubbed (works whether `import` runs inline or in an undo step)
	const manager = Object.assign(Object.create(LocalizedLabelManagerUI.prototype), {
		messageStore,
		getWithMessages: async (ids: string[]) => {
			refreshedLayers = ids;
			return [];
		},
		updateToMessageHead: async () => {},
		runAsUndoStep: async <T>(operation: () => Promise<T>) => operation(),
		commitUndo: async () => {},
	}) as LocalizedLabelManagerUI;
	await manager.import(incoming, language as any);
	return {
		counts: {
			newMessages: stats.newMessages.length,
			newTranslations: stats.newTranslations.length,
			changedTranslations: stats.changedTranslations.length,
		},
		written,
		refreshedLayers,
		after: (id: string) => messages.get(id)!,
	};
}

const text = (message: Message, language: string, match: string[] = []) =>
	message.variants
		.filter((v) => v.languageTag === language && JSON.stringify(v.match) === JSON.stringify(match))
		.map((v) => v.pattern.map((e) => (e.type === "Text" ? e.value : `{${e.name}}`)).join(""));

describe("import review counts vs. what the import writes", () => {
	test("a removed form of a plain select message is a changed translation", async () => {
		// plain = no annotation, so no nativeBundle (a `.match {$gender}` from Inlang Message Format / ICU select)
		const greeting = stored({
			id: "greeting",
			selectors: [{ type: "VariableReference", name: "gender" }],
			variants: [
				{
					languageTag: "en",
					match: ["female"],
					pattern: [{ type: "Text", value: "Welcome, madam" }],
				},
				{ languageTag: "en", match: ["*"], pattern: [{ type: "Text", value: "Welcome" }] },
				{
					languageTag: "de",
					match: ["female"],
					pattern: [{ type: "Text", value: "Willkommen, Frau" }],
				},
				{ languageTag: "de", match: ["*"], pattern: [{ type: "Text", value: "Willkommen" }] },
			],
		});
		expect(greeting.nativeBundle).toBeUndefined();

		// A1: the translator removed the "female" form from the file (Inlang Message Format)
		const withoutFemale = await importWithPlugin({
			plugin: plugin("Inlang Message Format"),
			fileName: "en.json",
			content: JSON.stringify({
				greeting: [
					{
						declarations: ["input gender"],
						selectors: ["gender"],
						match: { "gender=*": "Welcome" },
					},
				],
			}),
			locale: "en",
		});
		const a1 = await previewAndImport([greeting], withoutFemale, "en");
		// what the import does: the English "female" form is deleted
		expect(a1.written).toHaveLength(1);
		expect(a1.after("greeting").variants.filter((v) => v.languageTag === "en")).toEqual([
			{ languageTag: "en", match: ["*"], pattern: [{ type: "Text", value: "Welcome" }] },
		]);
		expect(a1.counts).toEqual({ newMessages: 0, newTranslations: 0, changedTranslations: 1 });

		// A2: a flat JSON file with the same text: counted as a NEW translation although English had one
		const flat = await importWithPlugin({
			plugin: plugin("inlang JSON"),
			fileName: "en.json",
			content: JSON.stringify({ greeting: "Welcome" }),
			locale: "en",
		});
		const a2 = await previewAndImport([greeting], flat, "en");
		expect(text(a2.after("greeting"), "en", ["female"])).toEqual([]);
		expect(a2.counts).toEqual({ newMessages: 0, newTranslations: 0, changedTranslations: 1 });
	});

	test("filling an empty translation is a new translation", async () => {
		for (const empty of [[], [{ type: "Text" as const, value: "" }]]) {
			const hello = stored({
				id: "hello",
				selectors: [],
				variants: [
					{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hello" }] },
					{ languageTag: "de", match: [], pattern: empty },
				],
			});
			const incoming = await importWithPlugin({
				plugin: plugin("inlang JSON"),
				fileName: "de.json",
				content: JSON.stringify({ hello: "Hallo" }),
				locale: "de",
			});
			const result = await previewAndImport([hello], incoming, "de");
			expect(result.counts).toEqual({ newMessages: 0, newTranslations: 1, changedTranslations: 0 });
		}
	});

	test("re-importing an unchanged file counts and writes nothing", async () => {
		const existing = [
			stored({
				id: "hello",
				selectors: [],
				variants: [
					{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hello" }] },
					{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
				],
			}),
		];
		const incoming = await importWithPlugin({
			plugin: plugin("inlang JSON"),
			fileName: "en.json",
			content: JSON.stringify({ hello: "Hello" }),
			locale: "en",
		});
		const result = await previewAndImport(existing, incoming, "en");
		expect(result.counts).toEqual({ newMessages: 0, newTranslations: 0, changedTranslations: 0 });
		expect(result.refreshedLayers).toEqual([]);
		expect(result.written.map((m) => m.id)).toEqual([]);
	});

	test("a changed plural message is one changed translation, not one per form", async () => {
		const i18next = plugin("i18next JSON");
		const read = async (locale: string, content: object) =>
			importWithPlugin({
				plugin: i18next,
				fileName: `${locale}.json`,
				content: JSON.stringify(content),
				locale,
			});
		const en = (
			await read("en", { items_one: "{{count}} item", items_other: "{{count}} items" })
		)[0];
		const ru = (
			await read("ru", {
				items_one: "{{count}} предмет",
				items_few: "{{count}} предмета",
				items_many: "{{count}} предметов",
				items_other: "{{count}} предмета",
			})
		)[0];
		const { mergeImportedMessage } = await import("../message/store/LegacyMessageBundleConverter");
		const existing = mergeImportedMessage(en, ru, "ru");

		// one Russian form changed -> "Changed translations: 4"
		const oneFormChanged = await read("ru", {
			items_one: "{{count}} штука",
			items_few: "{{count}} предмета",
			items_many: "{{count}} предметов",
			items_other: "{{count}} предмета",
		});
		const changed = await previewAndImport([existing], oneFormChanged, "ru");
		expect(changed.counts).toEqual({ newMessages: 0, newTranslations: 0, changedTranslations: 1 });

		// a new plural message with 4 forms -> "New messages: 1"
		const fresh = await previewAndImport(
			[],
			await read("ru", { items_one: "a", items_few: "b", items_many: "c", items_other: "d" }),
			"ru",
		);
		expect(fresh.counts).toEqual({ newMessages: 1, newTranslations: 0, changedTranslations: 0 });

		// the plain path (no nativeBundle on either side) counts only the forms that differ
		const plainExisting = stored({
			id: "pick",
			selectors: [{ type: "VariableReference", name: "gender" }],
			variants: [
				{ languageTag: "de", match: ["female"], pattern: [{ type: "Text", value: "a" }] },
				{ languageTag: "de", match: ["*"], pattern: [{ type: "Text", value: "b" }] },
			],
		});
		const plainIncoming: Message[] = [
			{
				...plainExisting,
				variants: [
					{ languageTag: "de", match: ["female"], pattern: [{ type: "Text", value: "CHANGED" }] },
					{ languageTag: "de", match: ["*"], pattern: [{ type: "Text", value: "b" }] },
				],
			},
		];
		const plain = await previewAndImport([plainExisting], plainIncoming, "de");
		expect(plain.counts).toEqual({ newMessages: 0, newTranslations: 0, changedTranslations: 1 });
	});
});
