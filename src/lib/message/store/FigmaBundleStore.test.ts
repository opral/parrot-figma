import { describe, expect, test } from "vitest";
import type { Message } from "@inlang/sdk";
import {
	FIGMA_BUNDLE_MIGRATION_KEY,
	FIGMA_BUNDLE_PREFIX,
	FigmaBundleStore,
	LEGACY_MESSAGE_PREFIX,
} from "./FigmaBundleStore";
import { bundleToLegacyMessage, legacyMessageToBundle } from "./LegacyMessageBundleConverter";
import { migrateLegacyMessagesToBundles } from "../../migrations/migrateLegacyMessagesToBundles";

class FakeRoot {
	id = "0:0";

	data = new Map<string, string>();

	failOnKey?: string;

	getPluginData(key: string) {
		return this.data.get(key) ?? "";
	}

	getPluginDataKeys() {
		return [...this.data.entries()].filter(([, value]) => value !== "").map(([key]) => key);
	}

	setPluginData(key: string, value: string) {
		if (key === this.failOnKey) {
			this.failOnKey = undefined;
			throw new Error("injected write failure");
		}
		if (value === "") this.data.delete(key);
		else this.data.set(key, value);
	}
}

class FakeDocumentChanges {
	listener?: (event: any) => void;

	on(_type: "documentchange", listener: (event: any) => void) {
		this.listener = listener;
	}

	off() {
		this.listener = undefined;
	}

	emit() {
		this.listener?.({
			documentChanges: [
				{
					origin: "REMOTE",
					type: "PROPERTY_CHANGE",
					node: { id: "0:0" },
					properties: ["pluginData"],
				},
			],
		});
	}
}

const legacyMessage: Message = {
	id: "welcome",
	alias: {},
	selectors: [{ type: "VariableReference", name: "audience" }],
	variants: [
		{
			languageTag: "en",
			match: ["admin"],
			pattern: [
				{ type: "Text", value: "Hello " },
				{ type: "VariableReference", name: "name" },
			],
		},
		{
			languageTag: "en",
			match: ["*"],
			pattern: [{ type: "Text", value: "Hello" }],
		},
	],
};

describe("FigmaBundleStore", () => {
	test("roundtrips legacy selectors, matches, and patterns", () => {
		expect(bundleToLegacyMessage(legacyMessageToBundle(legacyMessage))).toEqual(legacyMessage);
	});

	test("emits remote add, update, and delete changes", () => {
		const root = new FakeRoot();
		const documentChanges = new FakeDocumentChanges();
		const store = new FigmaBundleStore({ root, documentChanges });
		const events: any[] = [];
		store.subscribe((changes) => events.push(changes));

		const bundle = legacyMessageToBundle(legacyMessage);
		root.setPluginData(FIGMA_BUNDLE_PREFIX + bundle.id, JSON.stringify(bundle));
		documentChanges.emit();
		bundle.messages[0]!.variants[0]!.pattern = [{ type: "text", value: "Updated" }];
		root.setPluginData(FIGMA_BUNDLE_PREFIX + bundle.id, JSON.stringify(bundle));
		documentChanges.emit();
		root.setPluginData(FIGMA_BUNDLE_PREFIX + bundle.id, "");
		documentChanges.emit();

		expect(events).toEqual([
			{ added: ["welcome"], updated: [], deleted: [] },
			{ added: [], updated: ["welcome"], deleted: [] },
			{ added: [], updated: [], deleted: ["welcome"] },
		]);
	});
});

describe("legacy migration", () => {
	test("validates, writes bundles, then removes legacy messages", () => {
		const root = new FakeRoot();
		root.setPluginData(LEGACY_MESSAGE_PREFIX + legacyMessage.id, JSON.stringify(legacyMessage));

		expect(migrateLegacyMessagesToBundles(root)).toEqual({
			status: "migrated",
			migratedBundles: 1,
		});
		expect(root.getPluginData(LEGACY_MESSAGE_PREFIX + legacyMessage.id)).toBe("");
		expect(
			bundleToLegacyMessage(JSON.parse(root.getPluginData(FIGMA_BUNDLE_PREFIX + legacyMessage.id))),
		).toEqual(legacyMessage);
		expect(root.getPluginData(FIGMA_BUNDLE_MIGRATION_KEY)).not.toBe("");
	});

	test("does not write anything when preflight validation fails", () => {
		const root = new FakeRoot();
		root.setPluginData(LEGACY_MESSAGE_PREFIX + "wrong-key", JSON.stringify(legacyMessage));
		const before = new Map(root.data);

		expect(() => migrateLegacyMessagesToBundles(root)).toThrow("contains message");
		expect(root.data).toEqual(before);
	});

	test("restores every touched key when a write fails", () => {
		const root = new FakeRoot();
		root.setPluginData(LEGACY_MESSAGE_PREFIX + legacyMessage.id, JSON.stringify(legacyMessage));
		root.setPluginData(FIGMA_BUNDLE_MIGRATION_KEY, "old-marker");
		const before = new Map(root.data);
		root.failOnKey = LEGACY_MESSAGE_PREFIX + legacyMessage.id;

		expect(() => migrateLegacyMessagesToBundles(root)).toThrow("Previous plugin data was restored");
		expect(root.data).toEqual(before);
	});
});
