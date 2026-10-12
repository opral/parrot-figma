import { afterEach, describe, expect, test, vi } from "vitest";
import type { Message } from "../LegacyMessage";
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

	emit(origin: "REMOTE" | "LOCAL" = "REMOTE") {
		this.listener?.({
			documentChanges: [
				{
					origin,
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

	test("rejects legacy data that the Inlang bundle model would silently drop", () => {
		expect(() => legacyMessageToBundle({ ...legacyMessage, variants: [] })).toThrow(
			"cannot preserve them without a locale message",
		);
		expect(() =>
			legacyMessageToBundle({ ...legacyMessage, alias: { oldName: "welcome" } }),
		).toThrow("aliases that cannot be represented");
	});

	test("only reports bundles that changed after the store was created", () => {
		const root = new FakeRoot();
		const documentChanges = new FakeDocumentChanges();
		const bundle = legacyMessageToBundle(legacyMessage);
		root.setPluginData(FIGMA_BUNDLE_PREFIX + bundle.id, JSON.stringify(bundle));
		const store = new FigmaBundleStore({ root, documentChanges });
		const events: any[] = [];
		store.subscribe((changes) => events.push(changes));

		documentChanges.emit();
		expect(events).toEqual([]);

		// writes of this plugin are not remote changes
		bundle.messages[0]!.variants[0]!.pattern = [{ type: "text", value: "Mine" }];
		store.put(bundle);
		documentChanges.emit();
		expect(events).toEqual([]);

		bundle.messages[0]!.variants[0]!.pattern = [{ type: "text", value: "Theirs" }];
		root.setPluginData(FIGMA_BUNDLE_PREFIX + bundle.id, JSON.stringify(bundle));
		documentChanges.emit();
		expect(events).toEqual([{ added: [], updated: ["welcome"], deleted: [] }]);
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

describe("FigmaBundleStore local changes (undo / redo)", () => {
	afterEach(() => vi.useRealTimers());

	test("reports bundles that an undo changed once the changes stopped, not the writes of the store", () => {
		vi.useFakeTimers();
		const root = new FakeRoot();
		const documentChanges = new FakeDocumentChanges();
		const bundle = legacyMessageToBundle(legacyMessage);
		const key = FIGMA_BUNDLE_PREFIX + bundle.id;
		root.setPluginData(key, JSON.stringify(bundle));
		const store = new FigmaBundleStore({ root, documentChanges });
		const events: any[] = [];
		store.subscribe((changes) => events.push(changes));

		// the store's own writes fire local events too - nothing differs from what it remembers
		const written = structuredClone(bundle);
		written.messages[0]!.variants[0]!.pattern = [{ type: "text", value: "Translation" }];
		store.put(written);
		documentChanges.emit("LOCAL");
		vi.advanceTimersByTime(1000);
		expect(events).toEqual([]);

		// Cmd+Z restores the old plugin data behind the store's back
		root.setPluginData(key, JSON.stringify(bundle));
		documentChanges.emit("LOCAL");
		documentChanges.emit("LOCAL");
		vi.advanceTimersByTime(1000);
		expect(events).toEqual([{ added: [], updated: ["welcome"], deleted: [] }]);

		// and a link that was undone disappears
		root.setPluginData(key, "");
		documentChanges.emit("LOCAL");
		vi.advanceTimersByTime(1000);
		expect(events[1]).toEqual({ added: [], updated: [], deleted: ["welcome"] });
	});
});

describe("FigmaBundleStore undo latency", () => {
	afterEach(() => vi.useRealTimers());

	test("an undo of a bundle written last is reported at once, everything else after the slow check", () => {
		vi.useFakeTimers();
		const root = new FakeRoot();
		const documentChanges = new FakeDocumentChanges();
		const bundle = legacyMessageToBundle(legacyMessage);
		const key = FIGMA_BUNDLE_PREFIX + bundle.id;
		const other = { ...structuredClone(bundle), id: "other" };
		other.messages = other.messages.map((m) => ({
			...m,
			id: `other_${m.locale}`,
			bundleId: "other",
			variants: m.variants.map((v) => ({
				...v,
				id: `other_${v.id}`,
				messageId: `other_${m.locale}`,
			})),
		}));
		root.setPluginData(key, JSON.stringify(bundle));
		root.setPluginData(FIGMA_BUNDLE_PREFIX + "other", JSON.stringify(other));
		const store = new FigmaBundleStore({ root, documentChanges });
		const events: any[] = [];
		store.subscribe((changes) => events.push(changes));

		// own write + its event: nothing differs
		const written = structuredClone(bundle);
		written.messages[0]!.variants[0]!.pattern = [{ type: "text", value: "Translation" }];
		store.put(written);
		documentChanges.emit("LOCAL");
		expect(events).toEqual([]);

		// Cmd+Z restores it behind the store's back: reported synchronously from the recent bundles
		root.setPluginData(key, JSON.stringify(bundle));
		documentChanges.emit("LOCAL");
		expect(events).toEqual([{ added: [], updated: ["welcome"], deleted: [] }]);
		vi.advanceTimersByTime(20);
		expect(events).toHaveLength(1);

		// a bundle this store never wrote (undo of an import, an older edit) is found by the full check
		root.setPluginData(FIGMA_BUNDLE_PREFIX + "other", "");
		documentChanges.emit("LOCAL");
		expect(events).toHaveLength(1);
		vi.advanceTimersByTime(1000);
		expect(events[1]).toEqual({ added: [], updated: [], deleted: ["other"] });
	});
});

describe("FigmaBundleStore own writes", () => {
	afterEach(() => vi.useRealTimers());

	test("a pause in typing does not read every bundle", () => {
		vi.useFakeTimers();
		const root = new FakeRoot();
		const documentChanges = new FakeDocumentChanges();
		const bundle = legacyMessageToBundle(legacyMessage);
		for (let i = 0; i < 50; i++) {
			root.setPluginData(FIGMA_BUNDLE_PREFIX + `b${i}`, JSON.stringify({ ...bundle, id: `b${i}` }));
		}
		const store = new FigmaBundleStore({ root, documentChanges });
		const reads = vi.spyOn(root, "getPluginData");
		const written = structuredClone(bundle);
		for (let i = 0; i < 5; i++) {
			written.messages[0]!.variants[0]!.pattern = [{ type: "text", value: `T${i}` }];
			store.put(written);
			documentChanges.emit("LOCAL");
		}
		vi.advanceTimersByTime(1000);
		// one read of the bundle written last per change, no full check
		expect(reads.mock.calls.length).toBeLessThanOrEqual(5);
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

	test("does not touch legacy storage when a message cannot be represented", () => {
		const root = new FakeRoot();
		const empty = { ...legacyMessage, variants: [] };
		root.setPluginData(LEGACY_MESSAGE_PREFIX + empty.id, JSON.stringify(empty));
		const before = new Map(root.data);

		expect(() => migrateLegacyMessagesToBundles(root)).toThrow(
			"cannot preserve them without a locale message",
		);
		expect(root.data).toEqual(before);
	});
});
