import { expect, test, vi } from "vitest";
import { InlangMessageStore } from "./InlangMessageStoreFigmaRoot";
import { importWithPlugin } from "../../import/InlangPluginImporter";
import { exportWithPlugin } from "../../transfer/ExportWithPlugin";
import { translationPlugins } from "../../transfer/TranslationFormats";

test("the Figma sandbox retains ICU metadata after a fresh store is constructed", async () => {
	const data = new Map<string, string>();
	const root = {
		id: "0:0",
		getPluginData: (key: string) => data.get(key) ?? "",
		getPluginDataKeys: () => [...data.keys()],
		setPluginData: (key: string, value: string) => data.set(key, value),
	};
	vi.stubGlobal("figma", { root, on: vi.fn(), off: vi.fn(), ui: { postMessage: vi.fn() } });
	try {
		const plugin = translationPlugins.find((p) => p.label === "ICU MessageFormat")!.plugin;
		const values = {
			items: "{count, plural, one {# item} other {# items}}",
			price: "Total {amount, number, currency/USD}",
		};
		const imported = await importWithPlugin({
			plugin,
			content: JSON.stringify(values),
			fileName: "en.json",
			locale: "en",
		});
		const browserClone = globalThis.structuredClone;
		vi.stubGlobal("structuredClone", undefined);
		const store = new InlangMessageStore(false);
		for (const message of imported) await store.saveMessage(message);
		const reopened = new InlangMessageStore(false);
		const saved = await reopened.load();
		vi.stubGlobal("structuredClone", browserClone);
		const exported = await exportWithPlugin(plugin, saved, "en");
		expect(JSON.parse(exported.content)).toEqual(values);
	} finally {
		vi.unstubAllGlobals();
	}
});
