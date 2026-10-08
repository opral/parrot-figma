import { expect, test } from "vitest";
import { translationPlugins } from "./TranslationFormats";
import { importWithPlugin } from "../import/InlangPluginImporter";
import { exportWithPlugin } from "./ExportWithPlugin";

const icu = translationPlugins.find((format) => format.label === "ICU MessageFormat")!.plugin;

test("ICU select variants survive import and export", async () => {
	const content = JSON.stringify({
		greeting: "{gender, select, female {She} male {He} other {They}} arrived",
	});
	const imported = await importWithPlugin({
		plugin: icu,
		content,
		fileName: "en.json",
		locale: "en",
	});
	expect(imported[0].selectors).toEqual([{ type: "VariableReference", name: "gender" }]);
	expect(imported[0].variants).toHaveLength(3);
	const exported = await exportWithPlugin(icu, imported, "en");
	const reimported = await importWithPlugin({
		plugin: icu,
		content: exported.content,
		fileName: exported.fileName,
		locale: "en",
	});
	expect(reimported).toEqual(imported);
});

test.each([
	"{count, plural, one {# item} other {# items}}",
	"Total {amount, number, currency/USD}",
])("ICU metadata survives storage and export: %s", async (pattern) => {
	const imported = await importWithPlugin({
		plugin: icu,
		content: JSON.stringify({ item: pattern }),
		fileName: "en.json",
		locale: "en",
	});
	const { parseBundle, serializeBundle } = await import("../message/store/FigmaBundleStore");
	const { bundleToLegacyMessage, legacyMessageToBundle } =
		await import("../message/store/LegacyMessageBundleConverter");
	const stored = bundleToLegacyMessage(
		parseBundle(serializeBundle(legacyMessageToBundle(imported[0]))),
	);
	const exported = await exportWithPlugin(icu, [stored], "en");
	expect(JSON.parse(exported.content).item).toBe(pattern);
});

test("Apple catalogs import only the chosen language", async () => {
	const plugin = translationPlugins.find(
		(format) => format.label === "Apple String Catalog",
	)!.plugin;
	const content = JSON.stringify({
		sourceLanguage: "en",
		version: "1.0",
		strings: {
			greeting: {
				localizations: {
					en: { stringUnit: { state: "translated", value: "Hello" } },
					de: { stringUnit: { state: "translated", value: "Hallo" } },
				},
			},
		},
	});
	const messages = await importWithPlugin({
		plugin,
		content,
		fileName: "Localizable.xcstrings",
		locale: "de",
	});
	expect(messages[0].variants).toEqual([
		{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
	]);
	await expect(
		importWithPlugin({ plugin, content, fileName: "Localizable.xcstrings", locale: "fr" }),
	).rejects.toThrow("selected language");
});
