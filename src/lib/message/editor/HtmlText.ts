import type { BundleNested } from "../store/FigmaBundleStore";
import { fromRows, toRows, type BundleRows } from "../store/BundleRows";

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

type Variant = Pick<BundleNested["messages"][number]["variants"][number], "pattern">;

function isRichVariant(variant: Variant): boolean {
	return variant.pattern.some((element) => element.type === "text" && isRichHtml(element.value));
}

/**
 * The bundle as the plain-text editor sees it: database rows (the shape of the editor components),
 * entities decoded, and the ids of the variants that contain markup (their pattern is left exactly
 * as stored).
 */
export function toEditorBundle(stored: BundleNested): { bundle: BundleRows; rich: Set<string> } {
	const rich = new Set<string>();
	const bundle = toRows(stored);
	const decoded: BundleRows = {
		...bundle,
		messages: bundle.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => {
				if (isRichVariant(variant)) {
					rich.add(variant.id);
					return variant;
				}
				return { ...variant, pattern: decodePattern(variant.pattern) };
			}),
		})),
	};
	return { bundle: decoded, rich };
}

function decodePattern<P extends Variant["pattern"]>(pattern: P): P {
	return pattern.map((element) =>
		element.type === "text" ? { ...element, value: htmlToPlainText(element.value) } : element,
	) as P;
}

/** Inverse of `toEditorBundle`: encodes edited text and restores variants that were only previewed. */
export function fromEditorBundle(
	editedRows: BundleRows,
	rich: ReadonlySet<string>,
	stored: BundleNested,
): BundleNested {
	const storedVariants = new Map(
		stored.messages.flatMap((message) => message.variants).map((variant) => [variant.id, variant]),
	);
	const edited = fromRows(editedRows);
	return {
		...edited,
		messages: edited.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => {
				const prior = storedVariants.get(variant.id);
				if (rich.has(variant.id)) return prior ?? variant;
				// an unedited text keeps its stored encoding (imports store `&` and `<` as they are)
				if (
					prior &&
					JSON.stringify(decodePattern(prior.pattern)) === JSON.stringify(variant.pattern)
				)
					return { ...variant, pattern: prior.pattern };
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

type Pattern = BundleNested["messages"][number]["variants"][number]["pattern"];

const tag = /<(\/?)([a-z][a-z0-9]*)\b[^>]*?(\/?)>/gi;

/**
 * Stored (HTML) text as the Inlang translation checks need it: formatting tags become markup
 * elements (so a translation that lost the bold of the reference is reported), entities are decoded
 * (`&nbsp;` alone is no text). Line breaks (`<br>`) stay text: they may differ between languages.
 */
export function htmlPatternForChecks(pattern: Pattern): Pattern {
	const result: Pattern = [];
	const pushText = (value: string) => {
		if (value === "") return;
		const previous = result[result.length - 1];
		if (previous?.type === "text") previous.value += value;
		else result.push({ type: "text", value });
	};
	for (const element of pattern) {
		if (element.type !== "text") {
			result.push(element);
			continue;
		}
		let last = 0;
		for (const match of element.value.matchAll(tag)) {
			pushText(htmlToPlainText(element.value.slice(last, match.index)));
			last = match.index + match[0].length;
			const [, closing, rawName, selfClosing] = match;
			const name = rawName.toLowerCase();
			if (name === "br") pushText("\n");
			else if (closing) result.push({ type: "markup-end", name });
			else if (selfClosing) result.push({ type: "markup-standalone", name });
			else result.push({ type: "markup-start", name });
		}
		pushText(htmlToPlainText(element.value.slice(last)));
	}
	return result;
}

/** The bundle with `htmlPatternForChecks` applied to every variant. */
export function htmlBundleForChecks(bundle: BundleNested): BundleNested {
	return {
		...bundle,
		messages: bundle.messages.map((message) => ({
			...message,
			variants: message.variants.map((variant) => ({
				...variant,
				pattern: htmlPatternForChecks(variant.pattern),
			})),
		})),
	};
}
