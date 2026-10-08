import { expect, test } from "vitest";
import { Locale, RegionalLocales, SelectableLocales, languageDisplayName } from "./Locale";
import { Plural, getPluralFormsByLanguage } from "./Plural";

test("region and script locales are selectable next to their base language", () => {
	expect(SelectableLocales).toEqual(
		expect.arrayContaining(["pt-BR", "zh-Hans", "sr-Latn", "en-GB"]),
	);
	expect(new Set(SelectableLocales).size).toBe(SelectableLocales.length);
	const at = (tag: string) => SelectableLocales.indexOf(tag);
	expect(at("en-GB")).toBeGreaterThan(at("en"));
	expect(at("en-GB")).toBeLessThan(at("eo"));
	for (const tag of RegionalLocales) {
		// valid BCP-47 tags the SDK accepts and Intl can name
		expect(() => new Intl.DisplayNames("en", { type: "language" }).of(tag)).not.toThrow();
	}
});

test("region locales follow the plural rules of their base language", () => {
	expect(getPluralFormsByLanguage("pt-BR" as Locale)).toEqual(getPluralFormsByLanguage(Locale.PT));
	expect(getPluralFormsByLanguage("zh-Hans" as Locale)).toEqual([Plural.OTHER]);
});

test("every selectable language has its own name in the picker", () => {
	// Intl names the legacy tag `sh` "Serbian (Latin)" like `sr-Latn`: two identical entries
	expect(languageDisplayName("sh")).toBe("Serbo-Croatian");
	expect(languageDisplayName("sr-Latn")).toBe("Serbian (Latin)");
	expect(languageDisplayName("de")).toBe("German");
	const names = SelectableLocales.map((tag) => languageDisplayName(tag)).filter(
		(name) => name !== undefined,
	);
	expect(new Set(names).size).toBe(names.length);
});
