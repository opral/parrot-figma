import { describe, expect, it } from "vitest";
import type { Message } from "./LegacyMessage";
import type { MessageParameterValues } from "./MessageParameterValues";
import { Locale } from "./variants/Locale";
import MessageStoreMemory from "./store/MessageStoreMemory";
import { MessageExtension } from "./MessageExtnesions";
import { importWithPlugin } from "../import/InlangPluginImporter";
import { translationPlugins } from "../transfer/TranslationFormats";
import { getVariant } from "./LegacyMessage";
import {
	defaultVariableValues,
	exampleCount,
	inferVariableValues,
	layerMatch,
	layerVariables,
	pickVariant,
	selectorInputs,
} from "./LayerVariant";

const pluralDeclarations = [
	{ type: "input-variable", name: "count" },
	{
		type: "local-variable",
		name: "countPlural",
		value: {
			type: "expression",
			arg: { type: "variable-reference", name: "count" },
			annotation: { type: "function-reference", name: "plural", options: [] },
		},
	},
];

const count = { type: "VariableReference" as const, name: "count" };
const text = (value: string) => ({ type: "Text" as const, value });

/** `checkout.items` with a plural `count` - how the Inlang message format and i18next files import. */
function items(
	forms: Record<string, [string, "plural" | "count"]>,
	otherMatch: "other" | "*" = "other",
): Message {
	const selector = Object.values(forms)[0]?.[1] === "count" ? "count" : "countPlural";
	return {
		id: "checkout.items",
		...(selector === "countPlural"
			? {
					nativeBundle: {
						id: "checkout.items",
						declarations: pluralDeclarations,
						messages: [],
					} as any,
				}
			: {}),
		selectors: [{ type: "VariableReference", name: selector }],
		variants: Object.entries(forms).flatMap(([key, [pattern]]) => {
			const [language, form] = key.split(":");
			return [
				{
					languageTag: language,
					match: [form === "other" ? otherMatch : form],
					pattern: [count, text(` ${pattern}`)],
				},
			];
		}),
	};
}

const english = items({
	"en:one": ["item", "plural"],
	"en:other": ["items", "plural"],
});
const values = (value?: string, isDefault = false): MessageParameterValues =>
	value === undefined ? {} : { count: { type: "string", value, default: isDefault } };

describe("pickVariant for a plural", () => {
	it("shows the catch-all form without a count (the form a match of [] never found for a literal 'other')", () => {
		expect(getVariant(english, { where: { languageTag: "en", match: [] } })).toBeUndefined();
		expect(pickVariant(english, "en", {})?.match).toEqual(["other"]);
		expect(
			pickVariant(items({ "en:one": ["a", "plural"], "en:other": ["b", "plural"] }, "*"), "en")
				?.match,
		).toEqual(["*"]);
	});

	it("chooses the form of the stored count by the plural rules of the language", () => {
		expect(pickVariant(english, "en", values("1"))?.match).toEqual(["one"]);
		expect(pickVariant(english, "en", values("2"))?.match).toEqual(["other"]);
		expect(pickVariant(english, "en", values("0"))?.match).toEqual(["other"]);
		expect(pickVariant(english, "en", values("1.0"))?.match).toEqual(["one"]);
	});

	it("never ends up with nothing: a value no form fits and a message without catch-all", () => {
		expect(pickVariant(english, "en", values("many"))?.match).toEqual(["other"]);
		const polish = items({ "pl:one": ["x", "plural"], "pl:few": ["y", "plural"] });
		expect(pickVariant(polish, "pl", values("5"))?.match).toEqual(["one"]);
		expect(pickVariant(polish, "de", values("5"))).toBeUndefined();
	});

	it("follows the language: Russian has few and many", () => {
		const message: Message = {
			...english,
			variants: [
				...english.variants,
				...["one", "few", "many", "other"].map((form) => ({
					languageTag: "ru",
					match: [form],
					pattern: [text(form)],
				})),
			],
		};
		expect(pickVariant(message, "ru", values("1"))?.pattern).toEqual([text("one")]);
		expect(pickVariant(message, "ru", values("2"))?.pattern).toEqual([text("few")]);
		expect(pickVariant(message, "ru", values("5"))?.pattern).toEqual([text("many")]);
		expect(pickVariant(message, "en", values("2"))?.match).toEqual(["other"]);
	});

	it("treats a selector without annotation whose forms are plural categories as a plural", () => {
		const direct = items({ "en:one": ["item", "count"], "en:other": ["items", "count"] });
		expect(selectorInputs(direct)).toEqual([
			{ selector: "count", input: "count", plural: { type: "cardinal", offset: 0 } },
		]);
		expect(pickVariant(direct, "en", values("1"))?.match).toEqual(["one"]);
		expect(pickVariant(direct, "en", values("7"))?.match).toEqual(["other"]);
	});

	it("takes ICU exact numbers before the plural categories", () => {
		const exact = (name: string) => ({ type: "VariableReference" as const, name });
		const message: Message = {
			id: "inbox",
			nativeBundle: {
				id: "inbox",
				declarations: [
					...pluralDeclarations,
					{
						type: "local-variable",
						name: "countPluralExact",
						value: { type: "expression", arg: { type: "variable-reference", name: "count" } },
					},
				],
				messages: [],
			} as any,
			selectors: [exact("countPluralExact"), exact("countPlural")],
			variants: [
				{ languageTag: "en", match: ["0", "*"], pattern: [text("No messages")] },
				{ languageTag: "en", match: ["*", "one"], pattern: [text("One message")] },
				{ languageTag: "en", match: ["*", "*"], pattern: [text("Many messages")] },
			],
		};
		expect(layerVariables(message).map((variable) => variable.input)).toEqual(["count"]);
		expect(pickVariant(message, "en", values("0"))?.pattern).toEqual([text("No messages")]);
		expect(pickVariant(message, "en", values("1"))?.pattern).toEqual([text("One message")]);
		expect(pickVariant(message, "en", values("3"))?.pattern).toEqual([text("Many messages")]);
		expect(pickVariant(message, "en", {})?.pattern).toEqual([text("Many messages")]);
	});

	it("chooses a select by its value and falls back to the catch-all form", () => {
		const message: Message = {
			id: "invite",
			selectors: [{ type: "VariableReference", name: "gender" }],
			variants: [
				{ languageTag: "en", match: ["female"], pattern: [text("She")] },
				{ languageTag: "en", match: ["male"], pattern: [text("He")] },
				{ languageTag: "en", match: ["*"], pattern: [text("They")] },
			],
		};
		const gender = (value: string) => ({ gender: { type: "string" as const, value } });
		expect(pickVariant(message, "en", gender("female"))?.pattern).toEqual([text("She")]);
		expect(pickVariant(message, "en", gender("nonbinary"))?.pattern).toEqual([text("They")]);
		expect(pickVariant(message, "en", {})?.pattern).toEqual([text("They")]);
		// a select is not a plural: its value is not turned into a number category
		expect(selectorInputs(message)).toEqual([{ selector: "gender", input: "gender" }]);
	});

	it("keeps a message without selectors as it was", () => {
		const plain: Message = {
			id: "plain",
			selectors: [],
			variants: [{ languageTag: "en", match: [], pattern: [text("Hi")] }],
		};
		expect(pickVariant(plain, "en", {})?.pattern).toEqual([text("Hi")]);
		expect(pickVariant(plain, "de", {})).toBeUndefined();
		expect(layerMatch(plain, "en")).toEqual([]);
		expect(defaultVariableValues(plain, "en", {})).toEqual({});
	});
});

describe("layer values", () => {
	it("starts a plural with an example number of the catch-all form, and keeps what the designer typed", () => {
		expect(defaultVariableValues(english, "en", {})).toEqual({
			count: { type: "string", value: "2", default: true },
		});
		// linked before: the variable's name was the value
		expect(defaultVariableValues(english, "en", values("count", true))).toEqual({
			count: { type: "string", value: "2", default: true },
		});
		expect(defaultVariableValues(english, "en", values("1", false))).toEqual({});
		expect(exampleCount("en", { type: "cardinal", offset: 0 })).toBe("2");
		expect(exampleCount("ru", { type: "cardinal", offset: 0 })).not.toBe("");
		// an ICU offset shifts the example: "offset:1" -> 2 - 1 = the "other" example of the plural
		expect(exampleCount("en", { type: "cardinal", offset: 1 })).toBe("3");
	});

	it("gives the match of the form a layer shows, also in a language that is not translated", () => {
		expect(layerMatch(english, "en", values("1"))).toEqual(["one"]);
		expect(layerMatch(english, "de", values("1"), "en")).toEqual(["one"]);
		expect(layerMatch(english, "de", values("1"))).toEqual(["one"]);
	});
});

describe("htmlForLayer", () => {
	it("is what the layer shows: never blank for a plural, formatting and fallbacks as before", () => {
		// the old lookup with match [] found no form at all - the layer was blank
		expect(MessageStoreMemory.htmlForPatternWithFallback(english, "en", "en", [])).toBeUndefined();
		expect(MessageStoreMemory.htmlForLayer(english, "en", "en", {})).toBe("<ph>count</ph> items");
		expect(MessageStoreMemory.htmlForLayer(english, "en", "en", values("1"))).toBe(
			"<ph>count</ph> item",
		);
		// a language without the message shows the reference form of the same count
		expect(MessageStoreMemory.htmlForLayer(english, "fr", "en", values("1"))).toBe(
			"<ph>count</ph> item",
		);
		// nothing to show only when the message has no form at all
		expect(
			MessageStoreMemory.htmlForLayer({ ...english, variants: [] }, "en", "en", {}),
		).toBeUndefined();
	});
});

// The shapes the real plugins import (the message that was blank in the production build)
describe("imported plurals", () => {
	const importFile = async (label: string, content: object) =>
		(
			await importWithPlugin({
				plugin: translationPlugins.find((format) => format.label === label)!.plugin,
				content: JSON.stringify(content),
				fileName: "en.json",
				locale: "en",
			})
		)[0]!;

	it.each([
		[
			"Inlang Message Format",
			{
				"checkout.items": [
					{
						declarations: ["input count", "local countPlural = count: plural"],
						selectors: ["countPlural"],
						match: { "countPlural=one": "{count} item", "countPlural=other": "{count} items" },
					},
				],
			},
		],
		[
			"Inlang Message Format",
			{
				"checkout.items": [
					{
						declarations: ["input count"],
						selectors: ["count"],
						match: { "count=one": "{count} item", "count=other": "{count} items" },
					},
				],
			},
		],
		["i18next JSON", { items_one: "{{count}} item", items_other: "{{count}} items" }],
		["ICU MessageFormat", { items: "{count, plural, one {# item} other {# items}}" }],
		["next-intl JSON", { items: "{count, plural, one {# item} other {# items}}" }],
	])("%s: the layer shows a form for every count", async (label, content) => {
		const message = await importFile(label, content);
		expect(MessageStoreMemory.htmlForLayer(message, "en", "en", {})).toBe("<ph>count</ph> items");
		expect(MessageStoreMemory.htmlForLayer(message, "en", "en", values("1"))).toBe(
			"<ph>count</ph> item",
		);
		expect(MessageStoreMemory.htmlForLayer(message, "en", "en", values("12"))).toBe(
			"<ph>count</ph> items",
		);
		expect(layerVariables(message).map((variable) => variable.input)).toEqual(["count"]);
		expect(defaultVariableValues(message, "en", {}).count?.value).toBe("2");
	});
});

describe("MessageExtension.getParameter", () => {
	it("does not need the catch-all form when the text of a layer overrides a form", () => {
		// the Layers tab edits the text of a layer linked to a plural: there is no form for a match of []
		const parameters = (match?: string[]) =>
			MessageExtension.getParameter(english, {
				locale: Locale.EN,
				parameterValues: {},
				variantHtml: "<ph>count</ph> pieces",
				match,
			}).map((parameter) => parameter.name);
		expect(parameters()).toEqual(["count"]);
		expect(parameters(["one"])).toEqual(["count"]);
	});
});

describe("inferVariableValues", () => {
	it("reads the count from a layer text that is a form of the message", () => {
		expect(inferVariableValues(english, "en", "1 item")).toEqual({
			count: { type: "string", value: "1", default: false },
		});
		expect(inferVariableValues(english, "en", "12 items")).toEqual({
			count: { type: "string", value: "12", default: false },
		});
	});

	it("only counts a form that its count chooses again", () => {
		// "5 item" reads like the "one" form, but 5 chooses "other"
		expect(inferVariableValues(english, "en", "5 item")).toEqual({});
		expect(inferVariableValues(english, "en", "Your cart")).toEqual({});
		expect(inferVariableValues(english, "de", "1 item")).toEqual({});
		expect(
			inferVariableValues({ ...english, selectors: [], variants: [] }, "en", "1 item"),
		).toEqual({});
	});

	it("takes an exact number from its form and other variables of the text", () => {
		const message: Message = {
			id: "inbox",
			nativeBundle: {
				id: "inbox",
				declarations: [
					...pluralDeclarations,
					{
						type: "local-variable",
						name: "countPluralExact",
						value: { type: "expression", arg: { type: "variable-reference", name: "count" } },
					},
				],
				messages: [],
			} as any,
			selectors: [
				{ type: "VariableReference", name: "countPluralExact" },
				{ type: "VariableReference", name: "countPlural" },
			],
			variants: [
				{ languageTag: "en", match: ["0", "*"], pattern: [text("No messages")] },
				{
					languageTag: "en",
					match: ["*", "one"],
					pattern: [text("One message from "), { type: "VariableReference", name: "sender" }],
				},
				{ languageTag: "en", match: ["*", "*"], pattern: [count, text(" messages")] },
			],
		};
		expect(inferVariableValues(message, "en", "No messages").count?.value).toBe("0");
		// the "one" form has no number in its text: an example number that chooses it
		expect(inferVariableValues(message, "en", "One message from Ana")).toEqual({
			sender: { type: "string", value: "Ana", default: false },
			count: { type: "string", value: "1", default: true },
		});
		expect(inferVariableValues(message, "en", "7 messages").count?.value).toBe("7");
	});

	it("is escaped: a form with regular expression characters", () => {
		const message: Message = {
			...english,
			variants: [
				{ languageTag: "en", match: ["one"], pattern: [count, text(" (item)?")] },
				{ languageTag: "en", match: ["other"], pattern: [count, text(" (items)?")] },
			],
		};
		expect(inferVariableValues(message, "en", "1 (item)?").count?.value).toBe("1");
		expect(inferVariableValues(message, "en", "1 item")).toEqual({});
	});
});
