import { describe, expect, it } from "vitest";
import { checkBundle, missingVariants } from "@inlang/sdk/browser";
import type { BundleNested } from "../store/FigmaBundleStore";
import { formLabel } from "../../../ui/views/messages/TranslationProblems";
import {
	addChoiceValue,
	addMessageSelector,
	removeChoiceValue,
	selectorChoices,
} from "./Selectors";

const t = (value: string) => [{ type: "text" as const, value }];
type Forms = Record<string, Record<string, string>>;

/**
 * What the ICU plugin imports for `{count, plural, =0 {…} one {…} other {…}}` (plus an optional
 * gender select in front): per language, the forms as "gender|exact|plural" -> text.
 */
function icu(forms: Forms, gender = false, plural = true): BundleNested {
	const selectors = [
		...(gender ? ["gender"] : []),
		...(plural ? ["countPluralExact", "countPlural"] : []),
	];
	return {
		id: "items",
		declarations: [
			{ type: "input-variable", name: "count" },
			...(gender ? [{ type: "input-variable" as const, name: "gender" }] : []),
			{
				type: "local-variable",
				name: "countPluralExact",
				value: { type: "expression", arg: { type: "variable-reference", name: "count" } },
			},
			{
				type: "local-variable",
				name: "countPlural",
				value: {
					type: "expression",
					arg: { type: "variable-reference", name: "count" },
					annotation: { type: "function-reference", name: "plural", options: [] },
				},
			},
		],
		messages: Object.entries(forms).map(([locale, texts]) => ({
			id: `items_${locale}`,
			bundleId: "items",
			locale,
			selectors: selectors.map((name) => ({ type: "variable-reference" as const, name })),
			variants: Object.entries(texts).map(([keys, text]) => ({
				id: `items_${locale}_${keys}`,
				messageId: `items_${locale}`,
				matches: keys
					.split("|")
					.map((value, index) =>
						value === "*"
							? { type: "catchall-match" as const, key: selectors[index]! }
							: { type: "literal-match" as const, key: selectors[index]!, value },
					),
				pattern: t(text),
			})),
		})),
	};
}

/**
 * The forms the forms strip offers as "+ Add form" (what `<inlang-message-forms>` computes from the
 * reference's variants) next to the `missing-variant` diagnostics of the problems filter.
 */
function stripAndChecks(bundle: BundleNested, locale: string) {
	const reference = bundle.messages.find((m) => m.locale === "en")!;
	const message = bundle.messages.find((m) => m.locale === locale)!;
	const label = (matches: readonly { type: string; key: string; value?: string }[]) =>
		matches.map((m) => (m.type === "literal-match" ? m.value : "*")).join(" · ");
	const strip = missingVariants(message, bundle.declarations, {
		referenceVariants: locale === "en" ? undefined : reference.variants,
	}).map(label);
	const checks = checkBundle({ bundle, locales: ["en", "de", "ru"], referenceLocale: "en" })
		.filter((d) => d.locale === locale && d.checkId === "missing-variant")
		.map((d) => label((d as { matches: { type: string; key: string; value?: string }[] }).matches));
	return { strip, checks };
}

describe("forms strip and problems agree", () => {
	const en = { "0|*": "No items", "*|one": "{count} item", "*|*": "{count} items" };
	it("has no false problems for an ICU =0 / one / other message", () => {
		const bundle = icu({ en, de: { "0|*": "Keine", "*|one": "1 Element", "*|*": "x" } });
		expect(stripAndChecks(bundle, "en")).toEqual({ strip: [], checks: [] });
		expect(stripAndChecks(bundle, "de")).toEqual({ strip: [], checks: [] });
	});
	it("asks Russian for its categories and a missing =0 in both", () => {
		const bundle = icu({ en, ru: { "*|one": "1 штука", "*|*": "штук" } });
		const { strip, checks } = stripAndChecks(bundle, "ru");
		expect(strip).toEqual(["0 · *", "* · few", "* · many"]);
		expect(checks).toEqual(strip);
	});
	it("asks a translation for the reference's select values", () => {
		const bundle = icu(
			{
				en: { female: "She", male: "He", "*": "They" },
				de: { female: "Sie", "*": "Sie" },
			},
			true,
			false,
		);
		const { strip, checks } = stripAndChecks(bundle, "de");
		expect(strip).toEqual(["male"]);
		expect(checks).toEqual(strip);
	});
});

describe("exact numbers and select values", () => {
	it("adds =0 to the reference only, the translations show it as missing; removes it everywhere", () => {
		const plain = icu({
			en: { "*|one": "one", "*|*": "other" },
			de: { "*|one": "eins", "*|*": "andere" },
		});
		// without an exact number yet: a plural made through the drawer has no exact selector
		const plural = addMessageSelector(
			{
				...plain,
				declarations: plain.declarations.filter(
					(d) => d.name !== "countPluralExact" && d.name !== "countPlural",
				),
				messages: plain.messages.map((m) => ({
					...m,
					selectors: [],
					variants: [{ ...m.variants[1]!, matches: [] }],
				})),
			},
			{ variable: "count", kind: "plural" },
			"en",
		);
		const [choice] = selectorChoices(plural, "en");
		expect(choice).toMatchObject({ kind: "Plural", selector: "countPlural", values: [] });
		const { bundle: zero, variantId } = addChoiceValue(plural, choice!, "0", "en");
		expect(selectorChoices(zero, "en")[0]).toMatchObject({
			names: ["countPluralExact", "countPlural"],
			values: ["0"],
		});
		for (const message of zero.messages)
			expect(message.selectors.map((s) => s.name)).toEqual(["countPluralExact", "countPlural"]);
		// the reference gets the empty form (the one the editor selects), it keeps Parrot's camelCase message id
		const [en, de] = zero.messages;
		expect(en!.variants.find((v) => v.id === variantId)).toMatchObject({
			messageId: "items_en",
			pattern: [],
			matches: [
				{ type: "literal-match", key: "countPluralExact", value: "0" },
				{ type: "catchall-match", key: "countPlural" },
			],
		});
		// German gets no empty form: "+ Add form" and the problems filter ask for it
		expect(de!.variants).toHaveLength(1);
		// (German has only its catch-all here, so "one" is missing as well)
		expect(stripAndChecks(zero, "de")).toEqual({
			strip: ["0 · *", "* · one"],
			checks: ["0 · *", "* · one"],
		});
		const removed = removeChoiceValue(zero, selectorChoices(zero, "en")[0]!, "0");
		expect(removed.declarations).toEqual(plural.declarations);
		expect(removed.messages.map((m) => m.selectors)).toEqual(
			plural.messages.map((m) => m.selectors),
		);
	});

	it("adds and removes a select value without touching the selector", () => {
		const bundle = icu(
			{
				en: { female: "She", male: "He", "*": "They" },
				de: { female: "Sie", male: "Er", "*": "Sie" },
			},
			true,
			false,
		);
		const gender = selectorChoices(bundle, "en")[0]!;
		expect(gender).toMatchObject({ kind: "Select", values: ["female", "male"] });
		const { bundle: diverse, variantId } = addChoiceValue(bundle, gender, "diverse", "en");
		expect(variantId).toBeDefined();
		expect(selectorChoices(diverse, "en")[0]!.values).toEqual(["female", "male", "diverse"]);
		expect(stripAndChecks(diverse, "de")).toEqual({ strip: ["diverse"], checks: ["diverse"] });
		const noMale = removeChoiceValue(diverse, gender, "male");
		expect(selectorChoices(noMale, "en")[0]!.values).toEqual(["female", "diverse"]);
		expect(noMale.messages[0]!.selectors).toEqual(bundle.messages[0]!.selectors);
	});
});

it("labels a form like the forms strip: one key per choice", () => {
	const bundle = icu({ en: { "female|0|*": "a", "*|*|one": "b", "*|*|*": "c" } }, true);
	const message = bundle.messages[0]!;
	expect(message.variants.map((v) => formLabel(v, message, bundle.declarations))).toEqual([
		"female, 0",
		"any other, one",
		"any other, other",
	]);
});
