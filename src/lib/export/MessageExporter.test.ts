import { describe, expect, test } from "vitest";
import type { Message } from "../message/LegacyMessage";
import { InlangV3Project } from "../message/store/InlangV3Project";
import MessageExporter from "./MessageExporter";
import { Locale } from "../message/variants/Locale";

const messages: Message[] = [
	{
		id: "ManageSale.PricePlaceholder",
		selectors: [],
		variants: [
			{
				languageTag: "en",
				match: [],
				pattern: [
					{ type: "Text", value: "Hello " },
					{ type: "VariableReference", name: "name" },
				],
			},
		],
	},
	{
		id: "cart_items",
		selectors: [{ type: "VariableReference", name: "countPlural" }],
		variants: [
			{
				languageTag: "en",
				match: ["one"],
				pattern: [
					{ type: "VariableReference", name: "count" },
					{ type: "Text", value: " item" },
				],
			},
			{
				languageTag: "en",
				match: ["*"],
				pattern: [
					{ type: "VariableReference", name: "count" },
					{ type: "Text", value: " items" },
				],
			},
		],
	},
];

describe("plugin-driven message export", () => {
	test("exports i18next JSON with exact keys, variables, and plurals", async () => {
		await withProject(async (store) => {
			const file = await MessageExporter.export(store, Locale.EN, "i18next");
			expect(file?.fileName).toBe("en.json");
			const json = JSON.parse(file!.content);
			expect(json.ManageSale.PricePlaceholder).toBe("Hello {{name}}");
			expect(json.cart_items_one).toBe("{{count}} item");
			expect(json.cart_items).toBe("{{count}} items");
		});
	});

	test("exports Android XML with exact representable keys, variables, and plurals", async () => {
		await withProject(async (store) => {
			const file = await MessageExporter.export(store, Locale.EN, "android-xml");
			expect(file?.fileName).toBe("strings.xml");
			expect(file?.content).toContain('name="ManageSale.PricePlaceholder"');
			expect(file?.content).toContain("%1$s");
			expect(file?.content).toContain('<plurals name="cart_items">');
			expect(file?.content).toContain('quantity="one"');
			expect(file?.content).toContain('quantity="other"');
			expect(file?.content).toContain('quantity="one">"%1$d item"');
			expect(file?.content).toContain('quantity="other">"%1$d items"');
		});
	});

	test("exports Apple strings with exact keys and variables", async () => {
		await withProject(async (store) => {
			const project = store.inlangProject!;
			await project.delete("cart_items");
			const file = await MessageExporter.export(store, Locale.EN, "apple-strings");
			expect(file?.fileName).toBe("en.strings");
			expect(file?.content).toContain('"ManageSale.PricePlaceholder" = "Hello %1$@";');
		});
	});

	test("fails Apple .strings export rather than flattening plurals", async () => {
		await withProject(async (store) => {
			await expect(MessageExporter.export(store, Locale.EN, "apple-strings")).rejects.toThrow(
				"cannot represent selectors or plurals",
			);
		});
	});

	test("rejects multiple files instead of silently dropping output", async () => {
		const store = {
			exportFiles: async () => [
				{ locale: "en", name: "one.json", content: new Uint8Array() },
				{ locale: "en", name: "two.json", content: new Uint8Array() },
			],
		} as unknown as TestMessageStore;
		await expect(MessageExporter.export(store, Locale.EN, "i18next")).rejects.toThrow(
			"multi-file downloads are not supported",
		);
	});

	test("rejects a real namespaced i18next export instead of dropping files", async () => {
		const project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [
				plainMessage("plain", "Plain"),
				plainMessage("common:greeting", "Hello"),
				plainMessage("app:title", "Title"),
			],
		});
		const store = testStore(project);
		try {
			const files = await project.exportFiles("plugin.inlang.i18next", "en");
			expect(files.map((file) => file.name).sort()).toEqual([
				"app-en.json",
				"common-en.json",
				"en.json",
			]);
			await expect(MessageExporter.export(store, Locale.EN, "i18next")).rejects.toThrow(
				"3 files were generated",
			);
		} finally {
			await project.close();
		}
	});

	test("rejects i18next selectors it cannot represent", async () => {
		const project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [
				{
					id: "greeting",
					selectors: [{ type: "VariableReference", name: "audience" }],
					variants: [
						{
							languageTag: "en",
							match: ["formal"],
							pattern: [{ type: "Text", value: "Good day" }],
						},
						{ languageTag: "en", match: ["*"], pattern: [{ type: "Text", value: "Hi" }] },
					],
				},
			],
		});
		try {
			await expect(
				MessageExporter.export(testStore(project), Locale.EN, "i18next"),
			).rejects.toThrow(/selector.*audience/i);
		} finally {
			await project.close();
		}
	});

	test("returns only the selected locale", async () => {
		const project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en", "de"], modules: [] },
			messages: [
				{
					id: "greeting",
					selectors: [],
					variants: [
						{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hello" }] },
						{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
					],
				},
			],
		});
		try {
			const file = await MessageExporter.export(testStore(project), Locale.DE, "i18next");
			expect(file?.fileName).toBe("de.json");
			expect(JSON.parse(file!.content)).toEqual({ greeting: "Hallo" });
		} finally {
			await project.close();
		}
	});

	test("preserves countPlural as an ordinary placeholder without a selector", async () => {
		const project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [
				{
					id: "ordinary_placeholder",
					selectors: [],
					variants: [
						{
							languageTag: "en",
							match: [],
							pattern: [{ type: "VariableReference", name: "countPlural" }],
						},
					],
				},
			],
		});
		try {
			const file = await MessageExporter.export(testStore(project), Locale.EN, "android-xml");
			expect(file?.content).toContain('name="ordinary_placeholder">"%1$s"');
		} finally {
			await project.close();
		}
	});

	test("plural declarations include count even when patterns omit it", async () => {
		const project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [
				{
					id: "item_label",
					selectors: [{ type: "VariableReference", name: "countPlural" }],
					variants: [
						{ languageTag: "en", match: ["one"], pattern: [{ type: "Text", value: "item" }] },
						{ languageTag: "en", match: ["*"], pattern: [{ type: "Text", value: "items" }] },
					],
				},
			],
		});
		try {
			const [file] = await project.exportFiles("plugin.inlang.android", "en");
			expect(new TextDecoder().decode(file!.content)).toContain('quantity="other">"items"');
		} finally {
			await project.close();
		}
	});
});

async function withProject(run: (store: TestMessageStore) => Promise<void>) {
	const project = await InlangV3Project.open({
		settings: { baseLocale: "en", locales: ["en"], modules: [] },
		messages,
	});
	const store = testStore(project);
	try {
		await run(store);
	} finally {
		await project.close();
	}
}

function testStore(project: InlangV3Project) {
	return {
		inlangProject: project,
		exportFiles: project.exportFiles.bind(project),
	} as TestMessageStore;
}

function plainMessage(id: string, value: string): Message {
	return {
		id,
		selectors: [],
		variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value }] }],
	};
}

type TestMessageStore = {
	inlangProject: InlangV3Project;
	exportFiles: InlangV3Project["exportFiles"];
} & import("../message/store/MessageStoreMemory").default;
