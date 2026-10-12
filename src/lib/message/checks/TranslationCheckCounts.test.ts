import { afterEach, describe, expect, test } from "vitest";
import { TranslationChecks } from "./TranslationChecks";
import { legacyMessageToBundle } from "../store/LegacyMessageBundleConverter";
import { InlangV3Project } from "../store/InlangV3Project";
import MessageStoreMemory from "../store/MessageStoreMemory";
import type { Message, Pattern } from "../LegacyMessage";

const settings = { locales: ["en", "de"], referenceLocale: "en" };

const plain = (id: string, texts: Record<string, Pattern>): Message => ({
	id,
	selectors: [],
	variants: Object.entries(texts).map(([languageTag, pattern]) => ({
		languageTag,
		match: [],
		pattern,
	})),
});
const t = (value: string) => ({ type: "Text" as const, value });
const v = (name: string) => ({ type: "VariableReference" as const, name });

/** exactly what InlangV3Project feeds the checks */
const checksFor = (messages: Message[]) =>
	new TranslationChecks(settings, messages.map(legacyMessageToBundle));

describe("translation checks of Parrot's HTML texts", () => {
	test("plain texts, variables, literal braces and blank texts are classified correctly", () => {
		const checks = checksFor([
			plain("ok", { en: [t("Hello "), v("name")], de: [t("Hallo "), v("name")] }),
			plain("braces", { en: [t("Use {curly} braces")], de: [t("Nutze {geschweifte} Klammern")] }),
			plain("entities", { en: [t("Tom &amp; Jerry")], de: [t("Tom &amp; Jerry")] }),
			plain("lost_var", { en: [t("Hello "), v("name")], de: [t("Hallo")] }),
			plain("blank", { en: [t("Yes")], de: [t("")] }),
			plain("no_pattern", { en: [t("No")], de: [] }),
			plain("spaces", { en: [t("Ok")], de: [t("   ")] }),
			plain("lines", { en: [t("Two<br>lines")], de: [t("Eine Zeile")] }),
		]);
		expect([...checks.missing("de")].sort()).toEqual(["blank", "no_pattern", "spaces"]);
		expect([...checks.problems("de")]).toEqual(["lost_var"]);
	});

	test("formatting of the reference that a translation lost is a problem", () => {
		const checks = checksFor([
			plain("bold", { en: [t("First <strong>bold</strong> word")], de: [t("Erstes fettes Wort")] }),
			plain("kept", {
				en: [t("First <strong>bold</strong> word")],
				de: [t("Erstes <strong>fettes</strong> Wort")],
			}),
		]);
		expect([...checks.problems("de")]).toEqual(["bold"]);
		expect(checks.get("bold").map((d) => d.checkId)).toContain("missing-markup");
	});

	test("only formatting is markup: <b> and <strong> are the same, other tags are text", () => {
		const checks = checksFor([
			plain("same", { en: [t("<b>Hi</b>")], de: [t("<strong>Hallo</strong>")] }),
			plain("literal", { en: [t("Use <name> here")], de: [t("Nutze &lt;name&gt; hier")] }),
			plain("list", {
				en: [t("<ul><li>One</li><li>Two</li></ul>")],
				de: [t("<ul><li>Eins</li><li>Zwei</li></ul>")],
			}),
			plain("lost_list", { en: [t("<ul><li>One</li></ul>")], de: [t("Eins")] }),
		]);
		expect([...checks.problems("de")]).toEqual(["lost_list"]);
		expect(checks.get("lost_list").map((d) => (d as { name?: string }).name)).toEqual(["list"]);
	});

	test("a text of only &nbsp; is missing", () => {
		const checks = checksFor([plain("nbsp", { en: [t("Hi")], de: [t("&nbsp;")] })]);
		expect([...checks.missing("de")]).toEqual(["nbsp"]);
	});
});

describe("message counts per language", () => {
	let project: InlangV3Project | undefined;
	afterEach(async () => {
		await project?.close();
		project = undefined;
	});

	test("an empty translation is not counted as translated (Import, Export and Setup)", async () => {
		project = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en", "de"], modules: [] },
			messages: [
				plain("a", { en: [t("A")], de: [t("A de")] }),
				plain("b", { en: [t("B")], de: [t("")] }),
				plain("c", { en: [], de: [t("C de")] }),
			],
		});
		// MessageStoreMemory's constructor needs `window` - only the counts are used
		const store = Object.assign(Object.create(MessageStoreMemory.prototype), {
			inlangProject: project,
		}) as MessageStoreMemory;
		expect(store.countTranslated("de" as any)).toBe(2);
		expect(store.countTranslated("en" as any)).toBe(2);
		expect(store.countMissing("en" as any)).toBe(1);
	});
});
