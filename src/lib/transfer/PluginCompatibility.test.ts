import { expect, test } from "vitest";
import { translationPlugins } from "./TranslationFormats";
import { importWithPlugin } from "../import/InlangPluginImporter";
import { exportWithPlugin } from "./ExportWithPlugin";
import type { Message } from "../message/LegacyMessage";
import { mergeImportedMessage } from "../message/store/LegacyMessageBundleConverter";

const icu = translationPlugins.find((format) => format.label === "ICU MessageFormat")!.plugin;

test("ICU select variants survive import and export", async () => {
	const content = JSON.stringify({
		greeting: "{gender, select, female {She} male {He} other {They}} arrived",
	});
	const imported = await importWithPlugin({
		plugin: icu,
		content,
		fileName: "en.json",
		locale: "en",
	});
	expect(imported[0].selectors).toEqual([{ type: "VariableReference", name: "gender" }]);
	expect(imported[0].variants).toHaveLength(3);
	const exported = await exportWithPlugin(icu, imported, "en");
	const reimported = await importWithPlugin({
		plugin: icu,
		content: exported.content,
		fileName: exported.fileName,
		locale: "en",
	});
	expect(reimported).toEqual(imported);
});

test.each([
	"{count, plural, one {# item} other {# items}}",
	"Total {amount, number, currency/USD}",
])("ICU metadata survives storage and export: %s", async (pattern) => {
	const imported = await importWithPlugin({
		plugin: icu,
		content: JSON.stringify({ item: pattern }),
		fileName: "en.json",
		locale: "en",
	});
	const { parseBundle, serializeBundle } = await import("../message/store/FigmaBundleStore");
	const { bundleToLegacyMessage, legacyMessageToBundle } =
		await import("../message/store/LegacyMessageBundleConverter");
	const stored = bundleToLegacyMessage(
		parseBundle(serializeBundle(legacyMessageToBundle(imported[0]))),
	);
	const exported = await exportWithPlugin(icu, [stored], "en");
	expect(JSON.parse(exported.content).item).toBe(pattern);
});

test("Apple catalogs import only the chosen language", async () => {
	const plugin = translationPlugins.find(
		(format) => format.label === "Apple String Catalog",
	)!.plugin;
	const content = JSON.stringify({
		sourceLanguage: "en",
		version: "1.0",
		strings: {
			greeting: {
				localizations: {
					en: { stringUnit: { state: "translated", value: "Hello" } },
					de: { stringUnit: { state: "translated", value: "Hallo" } },
				},
			},
		},
	});
	const messages = await importWithPlugin({
		plugin,
		content,
		fileName: "Localizable.xcstrings",
		locale: "de",
	});
	expect(messages[0].variants).toEqual([
		{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
	]);
	await expect(
		importWithPlugin({ plugin, content, fileName: "Localizable.xcstrings", locale: "fr" }),
	).rejects.toThrow("selected language");
});

// ICU MessageFormat 1 through Parrot: import (one file per language) -> merged message in the store ->
// export, compared by what `intl-messageformat` displays, as a translator's repository would use them.
const icuFiles: Record<string, Record<string, string>> = {
	en: {
		inbox:
			"{count, plural, offset:1 =0 {No messages} =1 {One message from {sender}} one {{sender} and # other wrote} other {{sender} and # others wrote}}",
		invite:
			"{gender, select, female {She invited you} male {He invited you} other {They invited you}}",
		cart: "{count, plural, one {{gender, select, female {She has} other {They have}} # item} other {{gender, select, female {She has} other {They have}} # items}}",
		party:
			"{host, select, female {{guests, plural, offset:1 =0 {She stays home.} =1 {She invites {guest}.} one {She invites {guest} and one other.} other {She invites {guest} and # others.}}} other {{guests, plural, offset:1 =0 {They stay home.} =1 {They invite {guest}.} one {They invite {guest} and one other.} other {They invite {guest} and # others.}}}}",
		rank: "You finished {place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}}",
		escape: "It''s '{'literal'}' {n, plural, one {'#' # tag} other {'#' # tags}}",
		total: "Total: {amount, number}",
		due: "Due {due, date, short}",
	},
	de: {
		inbox:
			"{count, plural, offset:1 one {{sender} und # weitere Person haben geschrieben} other {{sender} und # weitere haben geschrieben}}",
		invite:
			"{gender, select, female {Sie hat dich eingeladen} male {Er hat dich eingeladen} other {Sie haben dich eingeladen}}",
		cart: "{count, plural, one {{gender, select, female {Sie hat} other {Sie haben}} # Artikel} other {{gender, select, female {Sie hat} other {Sie haben}} # Artikel}}",
		party:
			"{host, select, female {{guests, plural, offset:1 =0 {Sie bleibt zu Hause.} =1 {Sie lädt jemanden ein.} other {Sie lädt {guest} und # weitere ein.}}} other {{guests, plural, offset:1 =0 {Sie bleiben zu Hause.} =1 {Sie laden {guest} ein.} other {Sie laden {guest} und # weitere ein.}}}}",
		rank: "Du bist {place, selectordinal, other {#.}} geworden",
		escape: "Das ist '{'wörtlich'}' {n, plural, one {'#' # Tag} other {'#' # Tags}}",
		total: "Summe: {amount, number}",
		due: "Fällig {due, date, short}",
	},
	ru: {
		inbox:
			"{count, plural, offset:1 =0 {Нет сообщений} =1 {Одно сообщение от {sender}} one {{sender} и ещё # человек написали} few {{sender} и ещё # человека написали} many {{sender} и ещё # человек написали} other {{sender} и ещё # человека написали}}",
		invite: "{gender, select, female {Она пригласила вас} male {} other {Они пригласили вас}}",
		cart: "{count, plural, one {{gender, select, female {У неё} other {У них}} # товар} few {{gender, select, female {У неё} other {У них}} # товара} many {{gender, select, female {У неё} other {У них}} # товаров} other {{gender, select, female {У неё} other {У них}} # товара}}",
		party:
			"{host, select, female {{guests, plural, offset:1 =0 {Она остаётся дома.} =1 {Она приглашает {guest}.} one {Она приглашает {guest} и ещё # гостя.} other {Она приглашает {guest} и ещё # гостей.}}} other {{guests, plural, offset:1 =0 {Они остаются дома.} =1 {Они приглашают {guest}.} one {Они приглашают {guest} и ещё # гостя.} other {Они приглашают {guest} и ещё # гостей.}}}}",
		rank: "Вы заняли {place, selectordinal, other {#-е}} место",
		escape:
			"Это '{'буквально'}' {n, plural, one {'#' # тег} few {'#' # тега} many {'#' # тегов} other {'#' # тега}}",
		total: "Итого: {amount, number}",
		due: "Срок {due, date, short}",
	},
};

const icuValues = [0, 1, 2, 3, 4, 5, 11, 21, 22, 101].flatMap((count) =>
	["female", "male", "other"].map((gender) => ({
		count,
		n: count,
		place: count,
		guests: count,
		gender,
		host: gender,
		sender: "Ana",
		guest: "Bo",
		amount: 1234.5,
		due: new Date(Date.UTC(2026, 9, 9)),
	})),
);

/** Imports the files language by language into one store, as the Import tab does. */
async function importIcu(files: Record<string, Record<string, string>>) {
	const { mergeImportedMessage, legacyMessageToBundle, bundleToLegacyMessage } =
		await import("../message/store/LegacyMessageBundleConverter");
	const { parseBundle, serializeBundle } = await import("../message/store/FigmaBundleStore");
	const store = new Map<string, Message>();
	for (const [locale, file] of Object.entries(files)) {
		for (const message of await importWithPlugin({
			plugin: icu,
			content: JSON.stringify(file),
			fileName: `${locale}.json`,
			locale,
		})) {
			const merged = mergeImportedMessage(store.get(message.id), message, locale);
			// what the Figma file stores and reads back
			store.set(
				message.id,
				bundleToLegacyMessage(parseBundle(serializeBundle(legacyMessageToBundle(merged))), true),
			);
		}
	}
	return store;
}

test("ICU files keep their meaning through import, the store and export, and export byte-stable", async () => {
	const { IntlMessageFormat } = await import("intl-messageformat");
	const store = await importIcu(icuFiles);
	expect([...store.keys()].sort()).toEqual(Object.keys(icuFiles.en).sort());
	for (const [locale, source] of Object.entries(icuFiles)) {
		const exported = await exportWithPlugin(icu, [...store.values()], locale, "en");
		expect(exported.fileName).toBe(`${locale}.json`);
		const output = JSON.parse(exported.content) as Record<string, string>;
		expect(Object.keys(output).sort()).toEqual(Object.keys(source).sort());
		for (const [key, pattern] of Object.entries(source)) {
			const before = new IntlMessageFormat(pattern, locale);
			const after = new IntlMessageFormat(output[key]!, locale);
			for (const values of icuValues)
				expect(after.format(values), `${locale} ${key} ${JSON.stringify(values)}`).toBe(
					before.format(values),
				);
		}
		// exporting again, and exporting what the exported file imports as, gives the same bytes
		expect((await exportWithPlugin(icu, [...store.values()], locale, "en")).content).toBe(
			exported.content,
		);
		const reimported = await importIcu({ [locale]: output });
		expect((await exportWithPlugin(icu, [...reimported.values()], locale)).content).toBe(
			exported.content,
		);
	}
});

test("ICU escapes, offsets and formatters export as expected", async () => {
	const store = await importIcu({ en: icuFiles.en });
	const output = JSON.parse((await exportWithPlugin(icu, [...store.values()], "en")).content);
	expect(output.inbox).toBe(icuFiles.en.inbox);
	expect(output.rank).toBe(icuFiles.en.rank);
	expect(output.total).toBe(icuFiles.en.total);
	expect(output.due).toBe(icuFiles.en.due);
	// the text both forms share moves before the plural, where "#" needs no quote
	expect(output.escape).toBe("It''s '{'literal'}' # {n, plural, one {# tag} other {# tags}}");
	const inbox = store.get("inbox")!.nativeBundle!;
	// `#` of a plural with an offset displays count - offset
	expect(
		inbox.messages[0]!.variants.flatMap((v) => v.pattern).find(
			(e) => e.type === "expression" && e.annotation,
		),
	).toMatchObject({
		annotation: { name: "icu:pound", options: [{ name: "offset", value: { value: "1" } }] },
	});
});

test("ICU messages: the legacy view (canvas, machine translation) shows each language's catch-all form", async () => {
	const { getVariant } = await import("../message/LegacyMessage");
	// German has no =0/=1 and was merged first: its message comes before the English one
	const store = await importIcu({ de: icuFiles.de, en: icuFiles.en, ru: icuFiles.ru });
	const inbox = store.get("inbox")!;
	const text = (locale: string) =>
		getVariant(inbox, { where: { languageTag: locale, match: [] } })!
			.pattern.map((e) => (e.type === "Text" ? e.value : `{${e.name}}`))
			.join("");
	expect(text("en")).toBe("{sender} and {count} others wrote");
	expect(text("de")).toBe("{sender} und {count} weitere haben geschrieben");
	expect(text("ru")).toBe("{sender} и ещё {count} человека написали");
});

test("ICU messages: problems, and an exact number and a select value added in Plural & select", async () => {
	const { checkBundle } = await import("@inlang/sdk/browser");
	const { legacyMessageToBundle, bundleToLegacyMessage } =
		await import("../message/store/LegacyMessageBundleConverter");
	const { selectorChoices, addChoiceValue, addExactNumbersOfReference } =
		await import("../message/editor/Selectors");
	const files = structuredClone(icuFiles);
	files.de.party = files.de.party.replace("{Sie laden {guest} ein.}", "{Sie laden jemanden ein.}");
	const store = await importIcu(files);
	const problems = (bundle: ReturnType<typeof legacyMessageToBundle>) =>
		checkBundle({ bundle, locales: ["en", "de", "ru"], referenceLocale: "en" }).map(
			(d) =>
				`${d.locale} ${d.checkId}${"name" in d ? ` ${d.name}` : ""}${"values" in d ? ` ${d.values}` : ""}`,
		);
	expect(problems(legacyMessageToBundle(store.get("party")!))).toContain(
		"de missing-variable guest",
	);
	expect(problems(legacyMessageToBundle(store.get("invite")!))).toEqual(["ru empty-variant"]);

	// German inbox has no =0/=1: "No form for =0, =1"; adding =0 in the drawer asks German for it
	let inbox = legacyMessageToBundle(store.get("inbox")!);
	expect(problems(inbox)).toEqual(["de missing-selector count 0,1"]);
	// "No form for =0, =1 – Add them" below the German text does the same in one click
	expect(problems(addExactNumbersOfReference(inbox, "count", ["0", "1"], "en"))).toEqual([
		"de missing-variant",
		"de missing-variant",
	]);
	inbox = addChoiceValue(inbox, selectorChoices(inbox, "en")[0]!, "0", "en").bundle;
	expect(problems(inbox)).toEqual(["de missing-variant", "de missing-variant"]);
	const de = inbox.messages.find((m) => m.locale === "de")!;
	de.variants.unshift({
		id: "de-0",
		messageId: de.id,
		matches: [
			{ type: "literal-match", key: de.selectors[0]!.name, value: "0" },
			{ type: "catchall-match", key: de.selectors[1]!.name },
		],
		pattern: [{ type: "text", value: "Keine Nachrichten" }],
	});
	const exportedDe = JSON.parse(
		(await exportWithPlugin(icu, [bundleToLegacyMessage(inbox, true)], "de", "en")).content,
	);
	expect(exportedDe.inbox).toBe(
		"{count, plural, offset:1 =0 {Keine Nachrichten} one {{sender} und # weitere Person haben geschrieben} other {{sender} und # weitere haben geschrieben}}",
	);

	// a select value: an empty English form, missing in the translations
	let invite = legacyMessageToBundle(store.get("invite")!);
	invite = addChoiceValue(invite, selectorChoices(invite, "en")[0]!, "nonbinary", "en").bundle;
	expect(problems(invite)).toEqual([
		"en empty-variant",
		"de missing-variant",
		"ru empty-variant",
		"ru missing-variant",
	]);
	const exportedEn = JSON.parse(
		(await exportWithPlugin(icu, [bundleToLegacyMessage(invite, true)], "en")).content,
	);
	expect(exportedEn.invite).toBe(
		"{gender, select, female {She invited you} male {He invited you} nonbinary {} other {They invited you}}",
	);
});

test.each([
	["{count, plural, one {# item} other {# items}}", "{count} Dinge"],
	["{count} items", "{count, plural, one {# Ding} other {# Dinge}}"],
	["Total {amount, number}", "Summe {amount}"],
])("ICU: a plain and a native language of one key merge (%s / %s)", async (en, de) => {
	const plugin = translationPlugins.find((f) => f.label === "ICU MessageFormat")!.plugin;
	const [existing] = await importWithPlugin({
		plugin,
		fileName: "en.json",
		content: JSON.stringify({ k: en }),
		locale: "en",
	});
	const [incoming] = await importWithPlugin({
		plugin,
		fileName: "de.json",
		content: JSON.stringify({ k: de }),
		locale: "de",
	});
	const merged = mergeImportedMessage(existing, incoming!, "de");
	expect(new Set(merged.variants.map((v) => v.languageTag))).toEqual(new Set(["en", "de"]));
});
