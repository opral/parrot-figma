import { describe, expect, it } from "vitest";
import MessageStoreMemory from "./MessageStoreMemory";
import { TranslationChecks } from "../checks/TranslationChecks";
import { legacyMessageToBundle } from "./LegacyMessageBundleConverter";
import type { Locale } from "../variants/Locale";

describe("MessageStoreMemory.toQueryObject", () => {
	it("keeps dots and dashes of a message name filter (show linked message)", () => {
		const query = MessageStoreMemory.toQueryObject("name:member.login-title");
		expect(query.name).toBe("member.login-title");
		expect(query.text).toBe("");
	});

	it("parses a name filter followed by search text", () => {
		const query = MessageStoreMemory.toQueryObject("name:nav.home.title hello");
		expect(query.name).toBe("nav.home.title");
		expect(query.text).toBe("hello");
	});

	it("still supports the wildcard name", () => {
		const query = MessageStoreMemory.toQueryObject("name:* hello");
		expect(query.name).toBe("*");
		expect(query.text).toBe("hello");
	});
});

describe("MessageStoreMemory.htmlForPatternWithFallback", () => {
	const message = (variants: { languageTag: string; pattern: any[] }[]) =>
		({ id: "m", selectors: [], variants: variants.map((v) => ({ ...v, match: [] })) }) as any;
	const text = (value: string) => [{ type: "Text", value }];

	it("returns the translation when there is one", () => {
		const m = message([
			{ languageTag: "en", pattern: text("Hello") },
			{ languageTag: "de", pattern: text("Hallo") },
		]);
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "de", "en", [])).toBe("Hallo");
	});

	it("falls back to the reference language when the translation is missing", () => {
		const m = message([{ languageTag: "en", pattern: text("Hello") }]);
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "de", "en", [])).toBe("Hello");
	});

	it("falls back to the reference language when the translation was cleared", () => {
		const m = message([
			{ languageTag: "en", pattern: text("Hello") },
			{ languageTag: "de", pattern: [] },
		]);
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "de", "en", [])).toBe("Hello");
	});

	it("shows the text that exists when the message has neither the translation nor the reference text", () => {
		// created from a layer of a German frame: only a `de` variant
		const m = message([{ languageTag: "de", pattern: text("Hallo") }]);
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "fr", "en", [])).toBe("Hallo");
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "en", "en", [])).toBe("Hallo");
	});

	it("does not invent text when there is no fallback", () => {
		const m = message([{ languageTag: "en", pattern: text("Hello") }]);
		expect(MessageStoreMemory.htmlForPatternWithFallback(m, "de", undefined, [])).toBeUndefined();
	});
});

describe("MessageStoreMemory.getOrderedLanguages", () => {
	const store = (refLanguage: string | undefined, enabledLanguages: string[]) => {
		const instance = Object.create(MessageStoreMemory.prototype) as MessageStoreMemory;
		(instance as any).config = { refLanguage, enabledLanguages };
		return instance;
	};

	it("puts the reference language first and keeps the Setup order of the others", () => {
		expect(store("en", ["de", "fr", "en", "es"]).getOrderedLanguages()).toEqual([
			"en",
			"de",
			"fr",
			"es",
		]);
	});

	it("lists the reference language once, also when it is not part of the enabled languages", () => {
		expect(store("en", ["de", "fr"]).getOrderedLanguages()).toEqual(["en", "de", "fr"]);
		expect(store(undefined, ["de"]).getOrderedLanguages()).toEqual(["de"]);
	});
});

describe("MessageStoreMemory missing translation filter", () => {
	const message = (id: string, variants: { languageTag: string; pattern: any[] }[]) =>
		({ id, selectors: [], variants: variants.map((v) => ({ ...v, match: [] })) }) as any;
	const text = (value: string) => [{ type: "Text", value }];
	const messages = [
		message("complete", [
			{ languageTag: "en", pattern: text("Hi") },
			{ languageTag: "de", pattern: text("Hallo") },
		]),
		message("no_de", [{ languageTag: "en", pattern: text("Bye") }]),
		message("empty_de", [
			{ languageTag: "en", pattern: text("Yes") },
			{ languageTag: "de", pattern: text(" ") },
		]),
		message("variable_de", [
			{ languageTag: "en", pattern: [{ type: "VariableReference", name: "count" }] },
			{ languageTag: "de", pattern: [{ type: "VariableReference", name: "count" }] },
		]),
		message("typo_de", [
			{
				languageTag: "en",
				pattern: [{ type: "VariableReference", name: "total" }, ...text(" left")],
			},
			{
				languageTag: "de",
				pattern: [{ type: "VariableReference", name: "totl" }, ...text(" übrig")],
			},
		]),
	];
	const store = () => {
		const instance = Object.create(MessageStoreMemory.prototype) as MessageStoreMemory;
		(instance as any).config = { refLanguage: "en", enabledLanguages: ["en", "de"] };
		(instance as any).inlangProject = {
			getAllReadonly: () => messages,
			checks: new TranslationChecks(
				{ locales: ["en", "de"], referenceLocale: "en" },
				messages.map(legacyMessageToBundle),
			),
		};
		return instance;
	};
	const find = (search: string) => [
		...store().findMessages(MessageStoreMemory.toQueryObject(search)).matchingNames,
	];

	it("parses a language and round-trips it into the search string", () => {
		const query = MessageStoreMemory.toQueryObject("missing_translation:de hello");
		expect(query.missingTranslation).toBe(true);
		expect(query.missingTranslationLanguage).toBe("de");
		expect(MessageStoreMemory.toSearchString(query)).toBe("missing_translation:de hello");
	});

	it("lists messages without a (non-blank) text in the language", () => {
		expect(find("missing_translation:de ")).toEqual(["no_de", "empty_de"]);
	});

	it("checks every configured language for missing_translation:true", () => {
		expect(find("missing_translation:true ")).toEqual(["no_de", "empty_de"]);
		expect(find("missing_translation:false ")).toEqual(["complete", "variable_de", "typo_de"]);
	});

	it("combines with the text search", () => {
		expect(find("missing_translation:de bye")).toEqual(["no_de"]);
	});

	it("lists translations with problems and counts from the prepared checks", () => {
		expect(find("problems:true ")).toEqual(["typo_de"]);
		expect(
			MessageStoreMemory.toSearchString(MessageStoreMemory.toQueryObject("problems:true x")),
		).toBe("problems:true x");
		const instance = store();
		expect(instance.countMissing()).toBe(2);
		expect(instance.countMissing("de" as Locale)).toBe(2);
		expect(instance.countMissing("en" as Locale)).toBe(0);
		expect(instance.countProblems()).toBe(1);
		expect(instance.getDiagnostics("typo_de").map((d) => d.checkId)).toEqual([
			"missing-variable",
			"unknown-variable",
		]);
	});
});
