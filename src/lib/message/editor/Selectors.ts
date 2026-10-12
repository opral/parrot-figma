import {
	addExactNumber,
	addSelectValue,
	addSelector,
	removeExactNumber,
	removeSelectValue,
	removeSelector,
	selectableVariables,
	type SelectorKind,
} from "@inlang/editor-component";
import { isNumericKey, selectorGroups } from "@inlang/sdk/browser";
import type { BundleNested } from "../store/FigmaBundleStore";

export type SelectorChoice = {
	/** the input variable the selector reads from ("count") */
	variable: string;
	kind: "Plural" | "Ordinal" | "Select";
	/** the selector names in the bundle (two for an ICU `=0` + plural) */
	names: string[];
	/** the plural or select selector of the choice ("countPlural", "gender") */
	selector: string;
	/** the exact numbers of a plural ("0") or the values of a select ("female"), in any language */
	values: string[];
};

/** The plural / select choices a message currently has (what the translator sees as one choice each). */
export function selectorChoices(bundle: BundleNested, baseLocale: string): SelectorChoice[] {
	const message = bundle.messages.find((m) => m.locale === baseLocale) ?? bundle.messages[0];
	if (!message) return [];
	// the values of every language: a value only a translation has can be removed as well
	const variants = bundle.messages.flatMap((m) => m.variants);
	return selectorGroups(message, bundle.declarations, { variants }).map((group) => ({
		variable: group.input,
		kind: !group.isPlural ? "Select" : group.plural?.type === "ordinal" ? "Ordinal" : "Plural",
		names: group.names,
		selector: group.selector,
		values: group.isPlural
			? group.keys.filter(isNumericKey)
			: group.keys.filter((key) => key !== "*"),
	}));
}

/** Variables a plural / select can still be added on: input variables that no selector reads from yet. */
export function selectableInputs(bundle: BundleNested, baseLocale: string): string[] {
	const used = new Set(selectorChoices(bundle, baseLocale).map((choice) => choice.variable));
	return selectableVariables(bundle).filter(
		(name) =>
			bundle.declarations.find((d) => d.name === name)?.type === "input-variable" &&
			!used.has(name),
	);
}

const createId = () => crypto.randomUUID();

/**
 * Makes the message plural / ordinal / a select in every language. The forms of select values are
 * created in the reference language only; the other languages then show them as missing. See
 * `addSelector` of the editor component.
 */
export function addMessageSelector(
	bundle: BundleNested,
	args: { variable: string; kind: SelectorKind; values?: string[] },
	baseLocale: string,
): BundleNested {
	return addSelector(bundle, { ...args, locale: baseLocale, createId });
}

/** Removes a choice again (keeps the catch-all / "other" form of every language, drops the other forms). */
export function removeMessageSelector(bundle: BundleNested, choice: SelectorChoice): BundleNested {
	return choice.names.reduce((next, name) => removeSelector(next, name), bundle);
}

/**
 * One more exact number of a plural (ICU `=0`) or value of a select: an empty form in the reference
 * language (`variantId`, the first one when there are several rows), and a missing form ("+ Add form",
 * "With problems") in every other language until it is translated. See `addExactNumber` /
 * `addSelectValue` of the editor component.
 */
export function addChoiceValue(
	bundle: BundleNested,
	choice: SelectorChoice,
	value: string,
	baseLocale: string,
): { bundle: BundleNested; variantId?: string } {
	const args = { selector: choice.selector, value, locale: baseLocale, createId };
	const next =
		choice.kind === "Select" ? addSelectValue(bundle, args) : addExactNumber(bundle, args);
	const before = new Set(bundle.messages.flatMap((m) => m.variants.map((v) => v.id)));
	const added = next.messages
		.find((m) => m.locale === baseLocale)
		?.variants.find((v) => !before.has(v.id));
	return { bundle: next, variantId: added?.id };
}

/** Deletes the forms of an exact number / a select value in every language. */
export function removeChoiceValue(
	bundle: BundleNested,
	choice: SelectorChoice,
	value: string,
): BundleNested {
	return choice.kind === "Select"
		? removeSelectValue(bundle, { selector: choice.selector, value })
		: removeExactNumber(bundle, { selector: choice.selector, value });
}

/**
 * A translation that has the plural of the reference but not its exact numbers (ICU `=0`; the
 * `missing-selector` check, "No form for =0"): chooses by the exact numbers in every language, so the
 * translation shows the forms as missing ("+ Add form"). The reference keeps its forms.
 */
export function addExactNumbersOfReference(
	bundle: BundleNested,
	input: string,
	values: readonly string[],
	baseLocale: string,
): BundleNested {
	return values.reduce(
		(next, value) => addExactNumber(next, { selector: input, value, locale: baseLocale, createId }),
		bundle,
	);
}
