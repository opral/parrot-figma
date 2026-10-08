import {
	openProject,
	selectBundleNested,
	type InlangPlugin,
	type InlangProject,
	type BundleNested,
} from "@inlang/sdk/browser";
import { openLix } from "@inlang/sdk/lix";
import type { Message } from "../message/LegacyMessage";
import { bundleToLegacyMessage } from "../message/store/LegacyMessageBundleConverter";

import { pluginSettings } from "../transfer/TranslationFormats";

export { translationPlugins as importPlugins } from "../transfer/TranslationFormats";

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
			files: [{ locale: args.locale, content: new TextEncoder().encode(args.content) }],
		});
		const imported: BundleNested[] = await selectBundleNested(project.db).selectAll().execute();
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
