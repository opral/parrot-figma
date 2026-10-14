import { afterEach, describe, expect, it, vi } from "vitest";
import MigrationManager from "./MigrationManager";
import publishedFixture from "../../../qa/fixtures/published-0.10.112.json";
import {
	FIGMA_BUNDLE_PREFIX,
	FIGMA_BUNDLE_MIGRATION_KEY,
	LEGACY_MESSAGE_PREFIX,
} from "../message/store/FigmaBundleStore";
import { bundleToLegacyMessage } from "../message/store/LegacyMessageBundleConverter";

function node(id: string, data: Record<string, string> = {}) {
	const values = new Map(Object.entries(data));
	return {
		id,
		values,
		getPluginData: (key: string) => values.get(key) ?? "",
		getPluginDataKeys: () => [...values.keys()].filter((k) => values.get(k) !== ""),
		setPluginData: vi.fn((key: string, value: string) => values.set(key, value)),
	};
}
function fixture(rootData: Record<string, string>, texts: ReturnType<typeof node>[] = []) {
	const root = {
		...node("0:0", rootData),
		children: [] as any[],
		findAllWithCriteria: vi.fn(() => {
			throw Error("Root scan is forbidden");
		}),
	};
	const page = {
		id: "page",
		loadAsync: vi.fn(async () => {
			loaded = true;
		}),
		findAllWithCriteria: vi.fn(() => {
			if (!loaded) throw Error("Page not loaded");
			return texts;
		}),
	};
	let loaded = false;
	root.children.push(page);
	vi.stubGlobal("figma", { root });
	return { root, page, manager: new MigrationManager({} as any) };
}
const legacy = {
	id: "welcome",
	alias: {},
	selectors: [],
	variants: [
		{
			languageTag: "en",
			match: [],
			pattern: [
				{ type: "Text", value: "Hello " },
				{ type: "VariableReference", name: "name" },
				{ type: "Text", value: "!" },
			],
		},
		{
			languageTag: "de",
			match: [],
			pattern: [
				{ type: "Text", value: "Hallo " },
				{ type: "VariableReference", name: "name" },
				{ type: "Text", value: "!" },
			],
		},
	],
};
afterEach(() => vi.unstubAllGlobals());

describe("published project migration", () => {
	it("migrates the exact messages captured from Community version 0.10.112", async () => {
		const { root, manager } = fixture(publishedFixture.root);
		await manager.migrate();
		for (const [key, raw] of Object.entries(publishedFixture.root)) {
			if (key.startsWith(LEGACY_MESSAGE_PREFIX)) {
				const message = JSON.parse(raw);
				expect(
					bundleToLegacyMessage(JSON.parse(root.getPluginData(FIGMA_BUNDLE_PREFIX + message.id))),
				).toEqual({ ...message, alias: {} });
			} else if (key !== "parrot_migration_executed") {
				expect(root.getPluginData(key)).toBe(raw);
			}
		}
	});

	it("loads pages before repairing parameter values, preserves links/config, and is idempotent", async () => {
		const pv = JSON.stringify({ name: { type: "string", value: "Anna", default: false } });
		const label = node("label", {
			mn: "welcome",
			mn_welcome: "welcome",
			parameterValuesKey: pv,
			pv: JSON.stringify({ name: { type: "string", value: "Loren Impsum", default: true } }),
			fitp: "{}",
			language: "de",
		});
		const config = JSON.stringify({ refLanguage: "en", enabledLanguages: ["en", "de"] });
		const { root, page, manager } = fixture(
			{
				parrot_migration_executed: "0.10.71",
				prt_ic: config,
				[LEGACY_MESSAGE_PREFIX + "welcome"]: JSON.stringify(legacy),
			},
			[label],
		);
		await manager.migrate();
		expect(page.loadAsync).toHaveBeenCalledOnce();
		expect(root.findAllWithCriteria).not.toHaveBeenCalled();
		expect(label.getPluginData("pv")).toBe(pv);
		expect(label.getPluginData("parameterValuesKey")).toBe("");
		expect(label.getPluginData("mn")).toBe("welcome");
		expect(label.getPluginData("mn_welcome")).toBe("welcome");
		expect(root.getPluginData("prt_ic")).toBe(config);
		expect(
			bundleToLegacyMessage(JSON.parse(root.getPluginData(FIGMA_BUNDLE_PREFIX + "welcome"))),
		).toEqual(legacy);
		expect(root.getPluginData("parrot_migration_executed")).toBe("0.10.101");
		const state = [...root.values],
			textState = [...label.values];
		await new MigrationManager({} as any).migrate();
		expect([...root.values]).toEqual(state);
		expect([...label.values]).toEqual(textState);
		expect(page.loadAsync).toHaveBeenCalledOnce();
	});
	it("preserves user-entered values instead of replacing them with misplaced defaults", async () => {
		const pv = JSON.stringify({ count: { type: "decimal", value: 42, default: false } });
		const label = node("label", {
			pv,
			parameterValuesKey: JSON.stringify({ count: { type: "decimal", value: 7, default: true } }),
		});
		const { manager } = fixture({ parrot_migration_executed: "0.10.71" }, [label]);
		await manager.migrate();
		expect(label.getPluginData("pv")).toBe(pv);
	});
	it("rolls back root, labels, and version markers if a write fails", async () => {
		const label = node("label", { pv: "{}", parameterValuesKey: '{"name":{"value":"Anna"}}' });
		const { root, manager } = fixture({ parrot_migration_executed: "0.10.71" }, [label]);
		const before = [...root.values],
			textBefore = [...label.values];
		const write = label.setPluginData.getMockImplementation()!;
		let fail = true;
		label.setPluginData.mockImplementation((key, value) => {
			if (key === "parameterValuesKey" && fail) {
				fail = false;
				throw Error("disk failure");
			}
			return write(key, value);
		});
		await expect(manager.migrate()).rejects.toThrow("Original project data was restored");
		expect([...root.values]).toEqual(before);
		expect([...label.values]).toEqual(textBefore);
		await manager.migrate();
		expect(root.getPluginData("parrot_migration_executed")).toBe("0.10.101");
	});
	it("does not commit schema repairs if bundle validation would drop existing data", async () => {
		const label = node("label", { pv: "{}", parameterValuesKey: '{"name":{"value":"Anna"}}' });
		const { root, manager } = fixture(
			{
				parrot_migration_executed: "0.10.71",
				[LEGACY_MESSAGE_PREFIX + "welcome"]: JSON.stringify({
					...legacy,
					alias: { other: "welcome" },
				}),
			},
			[label],
		);
		const before = [...root.values],
			textBefore = [...label.values];
		await expect(manager.migrate()).rejects.toThrow("Original project data was restored");
		expect([...root.values]).toEqual(before);
		expect([...label.values]).toEqual(textBefore);
		expect(root.getPluginData(FIGMA_BUNDLE_MIGRATION_KEY)).toBe("");
	});
	it("upgrades pre-0.10.71 storage and cross-page links before creating the bundle store", async () => {
		const label = node("label", { mi: "old-id", fi: JSON.stringify({ name: { value: "Anna" } }) });
		const { root, manager } = fixture(
			{
				prt_c: JSON.stringify({ baseLanguage: "en", enabledLanguages: ["en", "de"] }),
				"prt_m__old-id": JSON.stringify({
					name: "welcome",
					variants: {
						en: { n: { other: { text: "Hello" } } },
						de: { n: { other: { text: "Hallo" } } },
					},
				}),
			},
			[label],
		);
		await manager.migrate();
		expect(JSON.parse(root.getPluginData("prt_ic")).refLanguage).toBe("en");
		expect(root.getPluginData("prt_c")).toBe("");
		expect(label.getPluginData("mn")).toBe("welcome");
		expect(label.getPluginData("mi")).toBe("");
		expect(JSON.parse(label.getPluginData("pv")).name.value).toBe("Anna");
		expect(
			bundleToLegacyMessage(JSON.parse(root.getPluginData(FIGMA_BUNDLE_PREFIX + "welcome")))
				.variants,
		).toHaveLength(2);
	});
	it.each([
		{ name: "reference", message: { name: "welcome", ref: "other" } },
		{
			name: "plural",
			message: {
				name: "welcome",
				variants: { en: { n: { one: { text: "One" }, other: { text: "Many" } } } },
			},
		},
		{
			name: "gender",
			message: { name: "welcome", variants: { en: { m: { other: { text: "Hello" } } } } },
		},
	])("preserves unsupported historical $name messages and configuration", async ({ message }) => {
		const { root, manager } = fixture({
			prt_c: JSON.stringify({ baseLanguage: "en" }),
			prt_m__old: JSON.stringify(message),
		});
		const before = Object.fromEntries(root.values);
		await expect(manager.migrate()).rejects.toThrow("Original project data was restored");
		for (const [key, value] of Object.entries(before)) expect(root.getPluginData(key)).toBe(value);
		expect(root.getPluginData("prt_ic")).toBe("");
		expect(root.getPluginData("parrot_migration_executed")).toBe("");
	});
	it("preserves an unmapped historical layer link", async () => {
		const label = node("label", { mi: "missing", fi: "{}" });
		const { root, manager } = fixture({ prt_c: '{"baseLanguage":"en"}' }, [label]);
		await expect(manager.migrate()).rejects.toThrow("Original project data was restored");
		expect(label.getPluginData("mi")).toBe("missing");
		expect(root.getPluginData("parrot_migration_executed")).toBe("");
	});
	it("does not scan pages again for an already migrated project", async () => {
		const { root, page, manager } = fixture({
			parrot_migration_executed: "0.10.101",
			[FIGMA_BUNDLE_MIGRATION_KEY]: '{"version":1,"migratedBundles":0}',
		});
		await manager.migrate();
		expect(page.loadAsync).not.toHaveBeenCalled();
		expect(root.setPluginData).not.toHaveBeenCalled();
	});
});
