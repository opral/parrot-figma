import type { BundleRows as BundleNested } from "../store/BundleRows";

type EditorMessage = BundleNested["messages"][number];

/**
 * The messages of the languages that have no text yet, so that the editor can show a row for them.
 * All languages of a message share its selectors: a draft of a plural message starts from the
 * reference's selectors without variants (its forms are added one by one), any other draft is an
 * empty text.
 */
export function draftMessages(
	bundle: BundleNested,
	locales: string[],
	baseLocale: string,
): EditorMessage[] {
	const selectors = bundle.messages.find((m) => m.locale === baseLocale)?.selectors ?? [];
	return locales
		.filter((locale) => !bundle.messages.some((m) => m.locale === locale))
		.map((locale): EditorMessage => {
			const id = `${bundle.id}_${locale}`;
			return {
				id,
				bundle_id: bundle.id,
				locale,
				selectors: structuredClone(selectors),
				variants:
					selectors.length > 0 ? [] : [{ id: `${id}_1`, message_id: id, matches: [], pattern: [] }],
			};
		});
}
