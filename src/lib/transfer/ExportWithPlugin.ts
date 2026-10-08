import type { InlangPlugin } from "@inlang/sdk/browser";
import { pluginSettings, translationPlugins } from "./TranslationFormats";
import type { Message } from "../message/LegacyMessage";
import { legacyMessageToBundle } from "../message/store/LegacyMessageBundleConverter";

export async function exportWithPlugin(
	plugin: InlangPlugin<any>,
	source: Message[],
	locale: string,
) {
	if (!plugin.exportFiles) throw new Error("This plugin does not support export.");
	const nested = source
		.map(legacyMessageToBundle)
		.map((bundle) => ({
			...bundle,
			messages: bundle.messages.filter((message) => message.locale === locale),
		}))
		.filter((bundle) => bundle.messages.length > 0);
	const files = await plugin.exportFiles({
		bundles: nested.map(({ messages, ...bundle }) => bundle),
		messages: nested.flatMap((bundle) =>
			bundle.messages.map(({ variants, ...message }) => message),
		),
		variants: nested.flatMap((bundle) => bundle.messages.flatMap((message) => message.variants)),
		settings: {
			baseLocale: locale,
			locales: [locale],
			modules: [],
			[plugin.key]: pluginSettings(plugin),
		},
	});
	if (files.length !== 1) throw new Error("The format did not produce a single language file.");
	return {
		fileName: files[0].name.split(/[\\/]/).pop() || `${locale}.json`,
		fileType:
			translationPlugins.find((format) => format.plugin.key === plugin.key)?.mimeType ??
			"application/octet-stream",
		content: new TextDecoder().decode(files[0].content),
	};
}
