import type { InlangPlugin } from "@inlang/sdk/browser";
import { pluginSettings, translationPlugins } from "./TranslationFormats";
import type { Message } from "../message/LegacyMessage";
import { legacyMessageToBundle } from "../message/store/LegacyMessageBundleConverter";

const NEXT_INTL_PLUGIN_KEY = "plugin.inlang.nextIntl";

// next-intl messages are nested objects and next-intl rejects "." inside a key. The plugin only writes
// nested objects for messages whose id carries the path - ids Parrot generates have none, so
// "checkout.title" would be exported as the flat (and for next-intl invalid) key "checkout.title".
function withNextIntlPaths(bundles: ReturnType<typeof legacyMessageToBundle>[]) {
	const ids = new Set(bundles.map((bundle) => bundle.id));
	// "a" and "a.b" cannot both be written as nested objects - keep the flat keys then
	if ([...ids].some((id) => [...ids].some((other) => other.startsWith(`${id}.`)))) return bundles;
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

export async function exportWithPlugin(
	plugin: InlangPlugin<any>,
	source: Message[],
	locale: string,
	// language of the design file - catalogs such as .xcstrings declare it as their source language
	baseLocale: string = locale,
) {
	if (!plugin.exportFiles) throw new Error("This plugin does not support export.");
	const bundles = withMarkupAsText(source.map(legacyMessageToBundle));
	const nested = (plugin.key === NEXT_INTL_PLUGIN_KEY ? withNextIntlPaths(bundles) : bundles)
		.map((bundle) => ({
			...bundle,
			messages: bundle.messages.filter((message) => message.locale === locale),
		}))
		.filter((bundle) => bundle.messages.length > 0)
		// The store order changes whenever the plugin is reopened - a stable order keeps the exported files
		// diff-friendly in the user's repository.
		.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
		// The plugins only say "Markup is not supported" - name the messages the user has to change.
		const failing: string[] = [];
		for (const bundle of nested) {
			try {
				await exportBundles([bundle]);
			} catch {
				failing.push(bundle.id);
				if (failing.length > 5) break;
			}
		}
		const reason = error instanceof Error ? error.message : String(error);
		if (failing.length === 0) throw error;
		throw new Error(
			`${reason.replace(/\.?$/, ".")} Affected messages: ${failing.slice(0, 5).join(", ")}${
				failing.length > 5 ? " and others" : ""
			}. Remove or change them, or choose another format.`,
			{ cause: error },
		);
	}
	if (files.length !== 1) throw new Error("The format did not produce a single language file.");
	return {
		fileName: files[0].name.split(/[\\/]/).pop() || `${locale}.json`,
		fileType:
			translationPlugins.find((format) => format.plugin.key === plugin.key)?.mimeType ??
			"application/octet-stream",
		content: new TextDecoder().decode(files[0].content),
	};
}
