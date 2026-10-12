import type { BundleNested } from "../store/FigmaBundleStore";

/**
 * Text elements of a message hold the HTML of the text layer: `&`, `<` and `>` are stored as entities
 * (`Tom &amp; Jerry`) and formatted text (bold, lists, ...) as markup (`First <strong>bold</strong>`).
 * The plain-text message editor must neither show nor produce either of them by accident:
 * - text without markup is shown decoded (`Tom & Jerry`) and encoded again when it is saved,
 * - text with markup is "rich": it is shown as a read-only preview and is never rewritten.
 */

const markup = /<\/?[a-z][^>]*>|<!--/i;

/** True if the stored text contains HTML markup (formatting) and not only entities. */
export function isRichHtml(value: string): boolean {
	return markup.test(value);
}

const entities: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	nbsp: "\u00a0",
};

/** Stored (HTML) text without markup -> the text the user sees. Unknown entities stay untouched. */
export function htmlToPlainText(value: string): string {
	return value.replace(/&(amp|lt|gt|nbsp);/g, (_, name: string) => entities[name]!);
}

/**
 * Edited plain text -> stored (HTML) text. Inverse of `htmlToPlainText`: entities this module does not
 * decode (`&quot;`, `&#169;`, ...) are kept as they are so that stored text round trips unchanged.
 */
export function plainTextToHtml(value: string): string {
	return value.replace(/&(?:#\d+;|#x[0-9a-f]+;|([a-z][a-z0-9]*);)?|[<>\u00a0]/gi, (match, name) => {
		if (match === "<") return "&lt;";
		if (match === ">") return "&gt;";
		if (match === "\u00a0") return "&nbsp;";
		// a bare `&` or an entity that is decoded for editing: encode the ampersand
		if (match === "&" || (name !== undefined && Object.hasOwn(entities, name)))
			return `&amp;${match.slice(1)}`;
		return match;
	});
}

type Variant = BundleNested["messages"][number]["variants"][number];

function isRichVariant(variant: Variant): boolean {
	return variant.pattern.some((element) => element.type === "text" && isRichHtml(element.value));
}

/**
 * The bundle as the plain-text editor sees it: entities decoded, and the ids of the variants that
 * contain markup (their pattern is left exactly as stored).
 */
export function toEditorBundle(bundle: BundleNested): { bundle: BundleNested; rich: Set<string> } {
	const rich = new Set<string>();
	const decoded: BundleNested = {
		...bundle,
		messages: bundle.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => {
				if (isRichVariant(variant)) {
					rich.add(variant.id);
					return variant;
				}
				return {
					...variant,
					pattern: variant.pattern.map((element) =>
						element.type === "text"
							? { ...element, value: htmlToPlainText(element.value) }
							: element,
					),
				};
			}),
		})),
	};
	return { bundle: decoded, rich };
}

/** Inverse of `toEditorBundle`: encodes edited text and restores variants that were only previewed. */
export function fromEditorBundle(
	edited: BundleNested,
	rich: ReadonlySet<string>,
	stored: BundleNested,
): BundleNested {
	const storedVariants = new Map(
		stored.messages.flatMap((message) => message.variants).map((variant) => [variant.id, variant]),
	);
	return {
		...edited,
		messages: edited.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => {
				if (rich.has(variant.id)) return storedVariants.get(variant.id) ?? variant;
				return {
					...variant,
					pattern: variant.pattern.map((element) =>
						element.type === "text"
							? { ...element, value: plainTextToHtml(element.value) }
							: element,
					),
				};
			}),
		})),
	};
}
