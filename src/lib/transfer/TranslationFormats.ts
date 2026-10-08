import jsonPlugin from "@inlang/plugin-json";
import i18nextPlugin from "@inlang/plugin-i18next";
import icuPlugin from "@inlang/plugin-icu1";
import messageFormatPlugin from "@inlang/plugin-message-format";
import nextIntlPlugin from "@inlang/plugin-next-intl";
import androidPlugin from "@inlang/plugin-android";
import appleStringsPlugin from "@inlang/plugin-apple-strings";
import appleCatalogPlugin from "@inlang/plugin-apple-xcstrings";
import type { InlangPlugin } from "@inlang/sdk/browser";

export type TranslationPlugin = {
	label: string;
	plugin: InlangPlugin<any>;
	pathPattern: string;
	mimeType: string;
};

function format(
	label: string,
	source: Pick<InlangPlugin<any>, "key" | "importFiles" | "exportFiles">,
	pathPattern = "/{locale}.json",
	mimeType = "application/json",
): TranslationPlugin {
	if (!source.importFiles || !source.exportFiles)
		throw new Error(`${label} must support import and export.`);
	return {
		label,
		pathPattern,
		mimeType,
		plugin: { key: source.key, importFiles: source.importFiles, exportFiles: source.exportFiles },
	};
}

// Curated browser-compatible storage plugins. Both panels derive their menu from
// these adapters; source-code matcher plugins do not represent file formats.
export const translationPlugins: TranslationPlugin[] = [
	format("inlang JSON", jsonPlugin),
	format("i18next JSON", i18nextPlugin),
	format("ICU MessageFormat", icuPlugin),
	format("Inlang Message Format", messageFormatPlugin),
	format("next-intl JSON", nextIntlPlugin),
	format("Android XML", androidPlugin, "/res/values{locale}/strings.xml", "application/xml"),
	format("Apple strings", appleStringsPlugin, "/{locale}.lproj/Localizable.strings", "text/plain"),
	format("Apple String Catalog", appleCatalogPlugin, "/Localizable.xcstrings"),
];

export const translationFormats = translationPlugins.map(({ label, plugin }) => ({
	label,
	value: plugin.key,
}));

export function pluginSettings(plugin: InlangPlugin<any>) {
	const format = translationPlugins.find((format) => format.plugin.key === plugin.key);
	return { pathPattern: format?.pathPattern ?? "/{locale}.json" };
}
