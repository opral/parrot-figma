import {
	openProject,
	selectBundleNested,
	type InlangPlugin,
	type InlangProject,
} from "@inlang/sdk/browser";
import { openLix } from "@inlang/sdk/lix";
import type { Message } from "../message/LegacyMessage";
import { bundleToLegacyMessage } from "../message/store/LegacyMessageBundleConverter";
import type { BundleNested } from "../message/store/FigmaBundleStore";
import { fromRows } from "../message/store/BundleRows";

import { pluginSettings } from "../transfer/TranslationFormats";

export { translationPlugins as importPlugins } from "../transfer/TranslationFormats";

const APPLE_STRINGS_PLUGIN_KEY = "plugin.inlang.apple-strings";
// A private-use character that stands in for an escaped backslash while the plugin reads the file.
const ESCAPED_BACKSLASH = "\uE000";

// @inlang/plugin-apple-strings (0.2.7) rejects its own output: its escape check
// (/\\(?![\\"nrtuU]|$)/) looks at every backslash on its own, so the second backslash of an escaped
// backslash (two characters) followed by anything but another escape throws "Unsupported Apple .strings escape".
// Escaped backslashes are replaced by a placeholder before the plugin parses the file and restored after.
function protectEscapedBackslashes(content: string) {
	return content.includes(ESCAPED_BACKSLASH)
		? content
		: content.replace(/\\\\/g, ESCAPED_BACKSLASH);
}

function restoreEscapedBackslashes<T>(value: T): T {
	return JSON.parse(JSON.stringify(value).split(ESCAPED_BACKSLASH).join("\\\\"));
}

export async function importWithPlugin(args: {
	plugin: InlangPlugin<any>;
	fileName: string;
	content: string;
	locale: string;
}): Promise<Message[]> {
	const lix = await openLix();
	let project: InlangProject | undefined;
	try {
		let baseLocale = args.locale;
		const locales = new Set([args.locale]);
		if (args.plugin.key === "plugin.inlang.apple-xcstrings") {
			const catalog = JSON.parse(args.content);
			if (typeof catalog.sourceLanguage !== "string")
				throw new Error("The catalog needs a sourceLanguage.");
			baseLocale = catalog.sourceLanguage;
			locales.add(baseLocale);
			for (const entry of Object.values(catalog.strings ?? {}) as {
				localizations?: Record<string, unknown>;
			}[]) {
				for (const locale of Object.keys(entry?.localizations ?? {})) locales.add(locale);
			}
		}
		project = await openProject({
			lix,
			settings: {
				baseLocale,
				locales: [...locales],
				modules: [],
				[args.plugin.key]: pluginSettings(args.plugin),
			},
			providePlugins: [args.plugin],
		});
		await project.importFiles({
			pluginKey: args.plugin.key,
			files: [
				{
					locale: args.locale,
					content: new TextEncoder().encode(
						args.plugin.key === APPLE_STRINGS_PLUGIN_KEY
							? protectEscapedBackslashes(args.content)
							: args.content,
					),
				},
			],
		});
		let imported: BundleNested[] = (await selectBundleNested(project.db).selectAll().execute()).map(
			fromRows,
		);
		if (args.plugin.key === APPLE_STRINGS_PLUGIN_KEY && !args.content.includes(ESCAPED_BACKSLASH))
			imported = restoreEscapedBackslashes(imported);
		// Catalogs can contain many languages. Only the row selected by the user is imported.
		const bundles = imported
			.map((bundle) => ({
				...bundle,
				messages: bundle.messages.filter((message) => message.locale === args.locale),
			}))
			.filter((bundle) => bundle.messages.length > 0);
		if (bundles.length === 0)
			throw new Error("This file contains no translations for the selected language.");
		// Preview uses an isolated project: parsing never changes the Figma file.
		return bundles.map((bundle) => bundleToLegacyMessage(bundle));
	} catch (error) {
		throw new Error(`${args.fileName}: ${error instanceof Error ? error.message : String(error)}`, {
			cause: error,
		});
	} finally {
		try {
			await project?.close();
		} finally {
			await lix.close();
		}
	}
}
