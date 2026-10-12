import type { InlangPlugin } from "@inlang/sdk/browser";
import i18nextPlugin from "@inlang/plugin-i18next";
import { pluginSettings, translationPlugins } from "./TranslationFormats";
import type { Message } from "../message/LegacyMessage";
import { legacyMessageToBundle } from "../message/store/LegacyMessageBundleConverter";

const NEXT_INTL_PLUGIN_KEY = "plugin.inlang.nextIntl";
const I18NEXT_PLUGIN_KEY = i18nextPlugin.key;

/** A message that is left out of an exported file, and why. */
export type SkippedMessage = { id: string; reason: string };

// next-intl messages are nested objects and next-intl rejects "." inside a key. The plugin only writes
// nested objects for messages whose id carries the path - ids Parrot generates have none, so
// "checkout.title" would be exported as the flat (and for next-intl invalid) key "checkout.title".
function withNextIntlPaths(bundles: ReturnType<typeof legacyMessageToBundle>[]) {
	return bundles.map((bundle) => ({
		...bundle,
		messages: bundle.messages.map((message) => {
			const id = `${NEXT_INTL_PLUGIN_KEY}:${encodeURIComponent(
				JSON.stringify({ locale: message.locale, bundleId: bundle.id, path: bundle.id.split(".") }),
			)}`;
			return {
				...message,
				id,
				variants: message.variants.map((variant) => ({ ...variant, messageId: id })),
			};
		}),
	}));
}

/**
 * Keys a format cannot hold, with the reason. Nested JSON formats (next-intl, i18next) cannot hold
 * "home" next to "home.title" (a value cannot be a text and an object) or empty path parts ("a..b");
 * "__proto__" is dropped by JSON parsers. The plugins would write an invalid key or silently drop one -
 * those messages are left out and reported instead.
 */
function keyProblems(ids: readonly string[], nested: boolean): Map<string, string> {
	const problems = new Map<string, string>();
	for (const id of ids) {
		const parts = nested ? id.split(".") : [id];
		if (parts.includes("__proto__")) problems.set(id, "“__proto__” cannot be a key");
		else if (nested && parts.some((part) => part === ""))
			problems.set(id, "the key has an empty part between dots");
	}
	if (!nested) return problems;
	// only keys that are written can clash: "home" is left out next to "home.title", "home.title" is written
	const written = ids.filter((id) => !problems.has(id));
	for (const id of written) {
		const child = written.find((other) => other.startsWith(`${id}.`));
		if (child)
			problems.set(id, `this format cannot hold both “${id}” and “${child}”: rename one of them`);
	}
	return problems;
}

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

// Parrot texts are HTML. A bundle that came from a format whose plugin parses "<b>bold</b>" into markup
// nodes (i18next, ...) would make every other format refuse the export ("Markup is not supported by the
// JSON plugin") - write the tags as text, which is also what the text looks like on the canvas.
function withMarkupAsText(bundles: ReturnType<typeof legacyMessageToBundle>[]) {
	return bundles.map((bundle) => ({
		...bundle,
		messages: bundle.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => {
				if (!variant.pattern.some((element) => element.type.startsWith("markup-"))) return variant;
				const pattern: typeof variant.pattern = [];
				for (const element of variant.pattern) {
					const text =
						element.type === "markup-start"
							? `<${element.name}>`
							: element.type === "markup-end"
								? `</${element.name}>`
								: element.type === "markup-standalone"
									? `<${element.name}/>`
									: undefined;
					const previous = pattern[pattern.length - 1];
					if (text === undefined) pattern.push(element);
					else if (previous?.type === "text") previous.value += text;
					else pattern.push({ type: "text", value: text });
				}
				return { ...variant, pattern };
			}),
		})),
	}));
}

/**
 * The file of one language in the given format. A message that cannot be written (its key or forms do
 * not fit the format, or it cannot be read as an Inlang bundle) does not block the others: it is left
 * out and listed in `skipped` with the reason.
 */
export async function exportWithPlugin(
	plugin: InlangPlugin<any>,
	source: Message[],
	locale: string,
	// language of the design file - catalogs such as .xcstrings declare it as their source language
	baseLocale: string = locale,
) {
	if (!plugin.exportFiles) throw new Error("This plugin does not support export.");
	const skipped: SkippedMessage[] = [];
	const converted = [] as ReturnType<typeof legacyMessageToBundle>[];
	for (const message of source) {
		// only the messages of this language: a problem of another language must not block this file
		if (!message.variants.some((variant) => variant.languageTag === locale)) continue;
		try {
			converted.push(legacyMessageToBundle(message));
		} catch (error) {
			skipped.push({ id: message.id, reason: errorText(error) });
		}
	}
	let bundles = withMarkupAsText(converted)
		.map((bundle) => ({
			...bundle,
			messages: bundle.messages.filter((message) => message.locale === locale),
		}))
		.filter((bundle) => bundle.messages.length > 0);
	const problems = keyProblems(
		bundles.map((bundle) => bundle.id),
		plugin.key === NEXT_INTL_PLUGIN_KEY || plugin.key === I18NEXT_PLUGIN_KEY,
	);
	for (const [id, reason] of problems) skipped.push({ id, reason });
	bundles = bundles.filter((bundle) => !problems.has(bundle.id));
	// The store order changes whenever the plugin is reopened - a stable order keeps the exported files
	// diff-friendly in the user's repository.
	const nested = (plugin.key === NEXT_INTL_PLUGIN_KEY ? withNextIntlPaths(bundles) : bundles).sort(
		(a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
	);
	const settings = {
		baseLocale,
		locales: [...new Set([baseLocale, locale])],
		modules: [],
		[plugin.key]: pluginSettings(plugin),
	};
	const exportBundles = (selected: typeof nested) =>
		plugin.exportFiles!({
			bundles: selected.map(({ messages, ...bundle }) => bundle),
			messages: selected.flatMap((bundle) =>
				bundle.messages.map(({ variants, ...message }) => message),
			),
			variants: selected.flatMap((bundle) =>
				bundle.messages.flatMap((message) => message.variants),
			),
			settings,
		});
	let files: Awaited<ReturnType<typeof exportBundles>>;
	try {
		files = await exportBundles(nested);
	} catch (error) {
		// The plugins reject the whole file for one message they cannot write ("Markup is not supported",
		// a key Android cannot use, ...): find those messages and export the rest.
		const writable = [] as typeof nested;
		for (const bundle of nested) {
			try {
				await exportBundles([bundle]);
				writable.push(bundle);
			} catch (bundleError) {
				skipped.push({ id: bundle.id, reason: errorText(bundleError) });
			}
		}
		if (writable.length === nested.length || writable.length === 0) {
			const reason = errorText(error);
			if (writable.length === nested.length) throw error;
			throw new Error(
				`${reason.replace(/\.?$/, ".")} No message of this language can be written in this format. Choose another format.`,
				{ cause: error },
			);
		}
		files = await exportBundles(writable);
	}
	if (files.length !== 1) throw new Error("The format did not produce a single language file.");
	return {
		fileName: files[0].name.split(/[\\/]/).pop() || `${locale}.json`,
		fileType:
			translationPlugins.find((format) => format.plugin.key === plugin.key)?.mimeType ??
			"application/octet-stream",
		content: new TextDecoder().decode(files[0].content),
		skipped: skipped.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
	};
}
