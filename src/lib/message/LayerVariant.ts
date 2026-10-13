import type { Message, Variant } from "./LegacyMessage";
import type { MessageParameterValues } from "./MessageParameterValues";

/**
 * Which form (variant) of a message a text layer shows.
 *
 * A message with selectors (a plural `count`, a `gender` select) has one form per combination of
 * values. A layer shows one of them: the form its stored variable values choose (`count` = 1 shows the
 * `one` form). The values live with the layer (plugin data `pv`, like the values of every other variable);
 * without a value the layer shows the catch-all form ("other").
 */

const PLURAL_CATEGORIES = ["zero", "one", "two", "few", "many", "other"];
/** The whole numbers tried to find an example for the catch-all form of a plural, best first. */
const EXAMPLE_COUNTS = [2, 5, 11, 100, 3, 4, 10, 0, 1, 1000000];

type Declaration = NonNullable<Message["nativeBundle"]>["declarations"][number];
type Annotation = {
	name: string;
	options?: { name: string; value: { type: string; value?: string; name?: string } }[];
};

/** A variable the forms of a message are chosen by - the layer has a value for it ("count"). */
export type SelectorInput = {
	/** the selector of the message ("countPlural" for `.local $countPlural = {$count :plural}`) */
	selector: string;
	/** the variable the layer has a value for ("count") */
	input: string;
	/** the value is a number: the plural rules of the language choose the category */
	plural?: {
		type: "cardinal" | "ordinal";
		/** the type is the value of this variable ("ordinal"), as i18next files with ordinals and cardinals have it */
		typeVariable?: string;
		offset: number;
	};
};

function declarationOf(name: string, declarations: readonly Declaration[] | undefined) {
	return declarations?.find((declaration) => declaration.name === name);
}

function resolveAnnotation(
	name: string,
	declarations: readonly Declaration[] | undefined,
	seen = new Set<string>(),
): Annotation | undefined {
	const declaration = declarationOf(name, declarations);
	if (!declaration || seen.has(name)) return undefined;
	seen.add(name);
	if (declaration.type === "input-variable")
		return declaration.annotation as Annotation | undefined;
	if (declaration.value.annotation) return declaration.value.annotation as Annotation;
	return declaration.value.arg.type === "variable-reference"
		? resolveAnnotation(declaration.value.arg.name, declarations, seen)
		: undefined;
}

function resolveInput(
	name: string,
	declarations: readonly Declaration[] | undefined,
	seen = new Set<string>(),
): string {
	const declaration = declarationOf(name, declarations);
	if (seen.has(name)) return name;
	seen.add(name);
	return declaration?.type === "local-variable" &&
		declaration.value.arg.type === "variable-reference"
		? resolveInput(declaration.value.arg.name, declarations, seen)
		: name;
}

function option(annotation: Annotation, name: string) {
	return annotation.options?.find((candidate) => candidate.name === name)?.value;
}

function literalOption(annotation: Annotation, name: string) {
	const value = option(annotation, name);
	return value?.type === "literal" ? value.value : undefined;
}

/**
 * The variables the forms of a message are chosen by, one per selector. A selector is a plural when it
 * is annotated `:plural`; a selector without annotation whose values are plural categories (`count=one`,
 * `count=other`, as the Inlang message format and i18next files can have them) is treated as one.
 */
export function selectorInputs(message: Message): SelectorInput[] {
	const declarations = message.nativeBundle?.declarations;
	return message.selectors.map(({ name }, index) => {
		const input = resolveInput(name, declarations);
		const annotation = resolveAnnotation(name, declarations);
		if (annotation?.name === "plural") {
			const offset = Number(literalOption(annotation, "offset") ?? 0);
			const type = option(annotation, "type");
			return {
				selector: name,
				input,
				plural: {
					type: type?.type === "literal" && type.value === "ordinal" ? "ordinal" : "cardinal",
					...(type?.type === "variable-reference" && type.name ? { typeVariable: type.name } : {}),
					offset: Number.isFinite(offset) ? offset : 0,
				},
			};
		}
		if (annotation === undefined) {
			const keys = message.variants.map((variant) => variant.match[index] ?? "*");
			const named = keys.filter((key) => key !== "*");
			// plural categories, next to exact numbers at most (`=0`, `one`, `other`)
			if (
				named.some((key) => PLURAL_CATEGORIES.includes(key)) &&
				named.every((key) => PLURAL_CATEGORIES.includes(key) || isNumeric(key))
			) {
				return { selector: name, input, plural: { type: "cardinal", offset: 0 } };
			}
		}
		return { selector: name, input };
	});
}

/** The variables a layer linked to this message has a value for (a plural's `count` once, even with an exact-number selector). */
export function layerVariables(message: Message): SelectorInput[] {
	const byInput = new Map<string, SelectorInput>();
	for (const selector of selectorInputs(message)) {
		const known = byInput.get(selector.input);
		if (!known || (!known.plural && selector.plural)) byInput.set(selector.input, selector);
	}
	return [...byInput.values()];
}

const isNumeric = (value: string) => /^-?\d+(\.\d+)?$/.test(value);
const sameKey = (a: string, b: string) =>
	a === b || (isNumeric(a) && isNumeric(b) && Number(a) === Number(b));

const pluralRulesCache = new Map<string, Intl.PluralRules | null>();
function pluralCategory(
	language: string,
	plural: NonNullable<SelectorInput["plural"]>,
	n: number,
	parameterValues: MessageParameterValues,
) {
	const type = plural.typeVariable
		? parameterValues[plural.typeVariable]?.value.trim() === "ordinal"
			? "ordinal"
			: "cardinal"
		: plural.type;
	const key = `${language}\u0000${type}`;
	if (!pluralRulesCache.has(key)) {
		try {
			pluralRulesCache.set(key, new Intl.PluralRules(language.replace(/_/g, "-"), { type }));
		} catch {
			pluralRulesCache.set(key, null);
		}
	}
	return pluralRulesCache.get(key)?.select(n - plural.offset);
}

/** The match values a layer prefers for a selector, best first. "other" and "*" (the catch-all) come last. */
function preferredKeys(
	input: SelectorInput,
	language: string,
	parameterValues: MessageParameterValues,
) {
	const catchAll = ["other", "*"];
	const text = parameterValues[input.input]?.value.trim();
	if (!text) return catchAll;
	const keys = [text];
	if (input.plural && isNumeric(text)) {
		const category = pluralCategory(language, input.plural, Number(text), parameterValues);
		if (category) keys.push(category);
	}
	return [...keys, ...catchAll];
}

/**
 * The form of a message a layer shows in a language: the one its variable values choose, else the
 * catch-all ("other") form. A message without selectors has one form per language. Undefined when the
 * language has no form that fits (it is not translated, or none of its forms takes the count): the
 * caller falls back to the reference language, see `htmlForLayer`.
 */
export function pickVariant(
	message: Message,
	language: string,
	parameterValues: MessageParameterValues = {},
): Variant | undefined {
	const variants = message.variants.filter((variant) => variant.languageTag === language);
	if (message.selectors.length === 0) return variants.find((variant) => variant.match.length === 0);

	const preferences = selectorInputs(message).map((input) =>
		preferredKeys(input, language, parameterValues),
	);
	let best: { variant: Variant; rank: number[] } | undefined;
	for (const variant of variants) {
		// where each match of the variant is in the preferences of its selector (-1: it never applies)
		const rank = preferences.map((keys, index) =>
			keys.findIndex((key) => sameKey(key, variant.match[index] ?? "*")),
		);
		if (rank.some((position) => position < 0)) continue;
		if (!best || isBetter(rank, best.rank)) best = { variant, rank };
	}
	return best?.variant;
}

/** The first selector decides first, then the next one. */
function isBetter(rank: number[], than: number[]) {
	for (const [index, position] of rank.entries()) {
		if (position !== than[index]) return position < than[index];
	}
	return false;
}

/**
 * The match values of the form a layer shows - to read or write that form. In a language without a
 * form (not translated yet) the form of the fallback language, else of any language.
 */
export function layerMatch(
	message: Message,
	language: string,
	parameterValues: MessageParameterValues = {},
	fallbackLanguage?: string,
) {
	if (message.selectors.length === 0) return [];
	const variant =
		pickVariant(message, language, parameterValues) ??
		(fallbackLanguage === undefined
			? undefined
			: pickVariant(message, fallbackLanguage, parameterValues)) ??
		message.variants[0];
	return message.selectors.map((_selector, index) => variant?.match[index] ?? "*");
}

/**
 * A whole number that makes a plural show the form it shows without a number (its catch-all "other"
 * form) in a language - the value a layer starts with, so it reads "2 items" instead of "count items".
 * Where no whole number does (Russian "other" is for fractions) 2 is used. Exact-number forms (`=2`) are skipped.
 */
export function exampleCount(message: Message, language: string, variable: SelectorInput) {
	const offset = variable.plural?.offset ?? 0;
	const defaultForm = JSON.stringify(pickVariant(message, language, {})?.match);
	const example = EXAMPLE_COUNTS.find((n) => {
		const value = String(n + offset);
		const form = pickVariant(message, language, {
			[variable.input]: { type: "string", value },
		})?.match;
		return JSON.stringify(form) === defaultForm;
	});
	return String((example ?? 2) + offset);
}

/**
 * The values a layer linked to a message starts with: an example number for every plural variable
 * that has no number yet (a layer linked before had the variable's name, "count"). A number stays when
 * the layer is switched to another language - the plural rules of that language choose the form for it.
 * A value the designer typed is kept; a select without a value shows its catch-all form.
 */
export function defaultVariableValues(
	message: Message,
	language: string,
	parameterValues: MessageParameterValues,
): MessageParameterValues {
	const defaults: MessageParameterValues = {};
	for (const variable of layerVariables(message)) {
		if (!variable.plural) continue;
		const current = parameterValues[variable.input];
		if (current && !(current.default && !isNumeric(current.value.trim()))) continue;
		defaults[variable.input] = {
			type: "string",
			value: exampleCount(message, language, variable),
			default: true,
		};
	}
	return defaults;
}

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * The values that make a form of the message read exactly like the text of a layer that is linked to
 * the message now: "7 items" for `{count} items` gives `count` = 7, so linking a layer keeps its number
 * (and its form) instead of showing the example number. A form without the number in its text ("One
 * item") gets an example number that chooses it. Only a form that the values choose again counts.
 * Empty when no form reads like the text.
 */
export function inferVariableValues(
	message: Message,
	language: string,
	layerHtml: string,
): MessageParameterValues {
	const inputs = layerVariables(message).map((variable) => variable.input);
	if (inputs.length === 0) return {};
	for (const variant of message.variants) {
		if (variant.languageTag !== language) continue;
		const names: string[] = [];
		let source = "^";
		for (const part of variant.pattern) {
			if (part.type === "Text") source += escapeRegExp(part.value);
			else {
				names.push(part.name);
				source += "(.+?)";
			}
		}
		const match = new RegExp(`${source}$`, "s").exec(layerHtml);
		if (!match) continue;
		const values: MessageParameterValues = {};
		let consistent = true;
		for (const [index, name] of names.entries()) {
			const value = match[index + 1]!;
			// the text of a layer is HTML: markup or an entity around the number is no value
			if (/[<&]/.test(value)) consistent = false;
			// the same variable twice must read the same
			if (values[name] && values[name].value !== value) consistent = false;
			values[name] = { type: "string", value, default: false };
		}
		if (!consistent) continue;
		// a form of an exact number ("No items" for =0) stands for that number
		for (const [index, { input }] of selectorInputs(message).entries()) {
			const key = variant.match[index];
			if (!values[input] && key !== undefined && isNumeric(key)) {
				values[input] = { type: "string", value: key, default: false };
			}
		}
		const chooses = (candidate: MessageParameterValues) =>
			JSON.stringify(pickVariant(message, language, candidate)?.match) ===
			JSON.stringify(variant.match);
		// a form without the number in its text ("One item") stands for a number that chooses it
		for (const { input, plural } of layerVariables(message)) {
			if (!plural || values[input]) continue;
			for (const n of [1, ...EXAMPLE_COUNTS]) {
				const value = String(n + plural.offset);
				const candidate = {
					...values,
					[input]: { type: "string" as const, value, default: false },
				};
				if (chooses(candidate)) {
					values[input] = candidate[input];
					break;
				}
			}
		}
		if (chooses(values)) return values;
	}
	return {};
}
