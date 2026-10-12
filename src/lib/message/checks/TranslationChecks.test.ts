import { describe, expect, it } from "vitest";
import type { BundleNested } from "../store/FigmaBundleStore";
import { TranslationChecks } from "./TranslationChecks";

const v = (name: string) => ({
	type: "expression" as const,
	arg: { type: "variable-reference" as const, name },
});
const t = (value: string) => ({ type: "text" as const, value });
type Pattern = BundleNested["messages"][number]["variants"][number]["pattern"];

/** A plain message (no forms) with a text per language. */
function bundle(id: string, texts: Record<string, Pattern>): BundleNested {
	return {
		id,
		declarations: [
			{ type: "input-variable", name: "total" },
			{ type: "input-variable", name: "totl" },
		],
		messages: Object.entries(texts).map(([locale, pattern]) => ({
			id: `${id}_${locale}`,
			bundleId: id,
			locale,
			selectors: [],
			variants: [{ id: `${id}_${locale}_1`, messageId: `${id}_${locale}`, matches: [], pattern }],
		})),
	};
}

/** A plural message with the given forms per language. */
function plural(id: string, forms: Record<string, string[]>): BundleNested {
	return {
		id,
		declarations: [
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
		],
		messages: Object.entries(forms).map(([locale, keys]) => ({
			id: `${id}_${locale}`,
			bundleId: id,
			locale,
			selectors: [{ type: "variable-reference", name: "countPlural" }],
			variants: keys.map((key) => ({
				id: `${id}_${locale}_${key}`,
				messageId: `${id}_${locale}`,
				matches: [
					key === "*"
						? { type: "catchall-match", key: "countPlural" }
						: { type: "literal-match", key: "countPlural", value: key },
				],
				pattern: [v("count"), t(" x")],
			})),
		})),
	};
}

const settings = { locales: ["en", "de", "ru"], referenceLocale: "en" };

describe("TranslationChecks", () => {
	it("splits missing texts from problems, per language and in any language", () => {
		const checks = new TranslationChecks(settings, [
			bundle("ok", { en: [t("Hi")], de: [t("Hallo")], ru: [t("Привет")] }),
			bundle("no_ru", { en: [t("Bye")], de: [t("Tschüss")] }),
			bundle("blank_de", { en: [t("Yes")], de: [t("  ")], ru: [t("Да")] }),
			bundle("typo", { en: [v("total")], de: [v("totl")], ru: [v("total")] }),
			plural("files", { en: ["one", "*"], de: ["one", "*"], ru: ["one", "*"] }),
		]);
		expect([...checks.missing()]).toEqual(["no_ru", "blank_de"]);
		expect([...checks.missing("ru")]).toEqual(["no_ru"]);
		expect([...checks.missing("de")]).toEqual(["blank_de"]);
		expect([...checks.missing("en")]).toEqual([]);
		expect([...checks.problems()]).toEqual(["typo", "files"]);
		expect([...checks.problems("de")]).toEqual(["typo"]);
		// Russian needs the few and many forms too
		expect([...checks.problems("ru")]).toEqual(["files"]);
		expect(checks.get("typo")).toMatchObject([
			{ checkId: "missing-variable", locale: "de", name: "total", variantId: "typo_de_1" },
			{ checkId: "unknown-variable", locale: "de", name: "totl", suggestion: "total" },
		]);
	});

	it("an empty form next to filled ones is a problem, also in the reference language", () => {
		const files = plural("files", { en: ["one", "*"], de: ["0", "one", "*"] });
		// de "=0 {}": the 0 form has no text
		files.messages[1]!.variants[0]!.pattern = [];
		files.messages[0]!.variants[0]!.pattern = [t(" ")];
		const checks = new TranslationChecks({ locales: ["en", "de"], referenceLocale: "en" }, [files]);
		expect(checks.missing().size).toBe(0);
		expect([...checks.problems("de")]).toEqual(["files"]);
		expect([...checks.problems("en")]).toEqual(["files"]);
		expect(checks.get("files")).toMatchObject([
			{ checkId: "empty-variant", locale: "en", variantId: "files_en_one" },
			{ checkId: "empty-variant", locale: "de", variantId: "files_de_0" },
		]);
	});

	it("a translation without the reference's plural is a problem where the language needs it", () => {
		const files = plural("files", { en: ["one", "*"] });
		const single = (locale: string) => ({
			id: `files_${locale}`,
			bundleId: "files",
			locale,
			selectors: [],
			variants: [
				{
					id: `files_${locale}_1`,
					messageId: `files_${locale}`,
					matches: [],
					pattern: [v("count")],
				},
			],
		});
		files.messages.push(single("ru"), single("ja"));
		const checks = new TranslationChecks({ locales: ["en", "ru", "ja"], referenceLocale: "en" }, [
			files,
		]);
		expect(checks.get("files")).toMatchObject([
			{ checkId: "missing-selector", locale: "ru", name: "count", selector: "countPlural" },
		]);
		expect([...checks.problems("ja")]).toEqual([]);
	});

	it("re-checks only the changed bundle and forgets deleted ones", () => {
		const checks = new TranslationChecks(settings, [
			bundle("typo", { en: [v("total")], de: [v("totl")], ru: [v("total")] }),
			bundle("no_ru", { en: [t("Bye")], de: [t("Tschüss")] }),
		]);
		checks.update(bundle("typo", { en: [v("total")], de: [v("total")], ru: [v("total")] }));
		expect([...checks.problems()]).toEqual([]);
		expect(checks.get("typo")).toEqual([]);
		checks.update(bundle("no_ru", { en: [t("Bye")], de: [t("Tschüss")], ru: [t("Пока")] }));
		expect(checks.missing().size).toBe(0);
		checks.update(bundle("typo", { en: [v("total")], de: [t("")], ru: [v("total")] }));
		expect([...checks.missing("de")]).toEqual(["typo"]);
		checks.remove("typo");
		expect(checks.missing().size).toBe(0);
		expect(checks.missing("de").size).toBe(0);
	});

	it("checks every bundle again for other languages or another reference language", () => {
		const bundles = [bundle("en_only", { en: [t("Hi")] }), bundle("de_only", { de: [t("Hallo")] })];
		const checks = new TranslationChecks({ locales: ["en"], referenceLocale: "en" }, bundles);
		expect([...checks.missing()]).toEqual(["de_only"]);
		checks.setSettings({ locales: ["en", "de"], referenceLocale: "de" }, bundles);
		expect([...checks.missing("de")]).toEqual(["en_only"]);
		expect([...checks.missing("en")]).toEqual(["de_only"]);
	});

	it("keeps up with thousands of messages", () => {
		const bundles = Array.from({ length: 3400 }, (_, i) =>
			bundle(`key_${i}`, {
				en: [t("Total "), v("total")],
				de: [t("Summe "), v(i % 10 === 0 ? "totl" : "total")],
				ru: [t("Итого "), v("total")],
				...(i % 7 === 0 ? {} : { fr: [t("Total "), v("total")] }),
			}),
		);
		const fiveLocales = { locales: ["en", "de", "ru", "fr", "es"], referenceLocale: "en" };
		const start = performance.now();
		const checks = new TranslationChecks(fiveLocales, bundles);
		const initial = performance.now() - start;
		const editStart = performance.now();
		checks.update(bundles[1]!);
		const edit = performance.now() - editStart;
		expect(checks.missing("es").size).toBe(3400);
		expect(checks.problems("de").size).toBe(340);
		// generous bounds for CI; measured ~30 ms and well below 1 ms on a laptop
		expect(initial).toBeLessThan(1500);
		expect(edit).toBeLessThan(50);
	});
});
