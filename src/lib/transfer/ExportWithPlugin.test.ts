import { expect, test } from "vitest";
import { translationPlugins } from "./TranslationFormats";
import { exportWithPlugin } from "./ExportWithPlugin";
import { importWithPlugin } from "../import/InlangPluginImporter";
import type { Message } from "../message/LegacyMessage";

for (const { label, plugin, pathPattern } of translationPlugins) {
	test(`${label} round trips keys and empty translations in one locale`, async () => {
		const source: Message[] = [
			{
				id: "checkout.title",
				selectors: [],
				variants: [
					{
						languageTag: "en",
						match: [],
						pattern: [
							{ type: "Text", value: "Hello " },
							{ type: "VariableReference", name: "name" },
						],
					},
					{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
				],
			},
			{
				id: "blank",
				selectors: [],
				variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "" }] }],
			},
			{
				id: "german.only",
				selectors: [],
				variants: [
					{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Nur Deutsch" }] },
				],
			},
		];
		if (!pathPattern.endsWith(".json"))
			source[0].variants[0].pattern = [{ type: "Text", value: "Hello" }];
		const file = await exportWithPlugin(plugin, source, "en");
		expect(file.fileName).toBe(pathPattern.replace("{locale}", "en").split("/").pop());
		const parsed = await importWithPlugin({
			plugin,
			fileName: file.fileName,
			content: file.content,
			locale: "en",
		});
		expect(parsed.map((message) => message.id).sort()).toEqual(["blank", "checkout.title"]);
		expect(parsed.find((message) => message.id === "checkout.title")?.variants).toEqual([
			source[0].variants[0],
		]);
		expect(
			parsed
				.find((message) => message.id === "blank")
				?.variants[0].pattern.map((element) => (element.type === "Text" ? element.value : ""))
				.join(""),
		).toBe("");
		expect(source[0].variants).toHaveLength(2);
	});
}

test("a catalog exported for a target language keeps the design file language as its source language", async () => {
	const plugin = translationPlugins.find(
		(format) => format.label === "Apple String Catalog",
	)!.plugin;
	const german: Message[] = [
		{
			id: "greeting",
			selectors: [],
			variants: [{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] }],
		},
	];
	const catalog = JSON.parse((await exportWithPlugin(plugin, german, "de", "en")).content);
	expect(catalog.sourceLanguage).toBe("en");
	expect(Object.keys(catalog.strings.greeting.localizations)).toEqual(["de"]);
});

test("next-intl export writes nested objects because next-intl rejects dots in keys", async () => {
	const plugin = translationPlugins.find((format) => format.label === "next-intl JSON")!.plugin;
	const message = (id: string, value: string): Message => ({
		id,
		selectors: [],
		variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value }] }],
	});
	const exported = await exportWithPlugin(
		plugin,
		[
			message("checkout.title", "Checkout"),
			message("checkout.pay.now", "Pay"),
			message("home", "Home"),
		],
		"en",
	);
	expect(JSON.parse(exported.content)).toEqual({
		checkout: { title: "Checkout", pay: { now: "Pay" } },
		home: "Home",
	});
	// and the nested file is read back into the dotted keys
	const imported = await importWithPlugin({
		plugin,
		fileName: exported.fileName,
		content: exported.content,
		locale: "en",
	});
	expect(imported.map((m) => m.id).sort()).toEqual(["checkout.pay.now", "checkout.title", "home"]);

	// "checkout" next to "checkout.title" cannot be nested - keep exporting instead of failing
	const clash = await exportWithPlugin(
		plugin,
		[message("checkout", "Checkout"), message("checkout.title", "Title")],
		"en",
	);
	expect(JSON.parse(clash.content)).toEqual({ checkout: "Checkout", "checkout.title": "Title" });
});

test("HTML in an i18next text keeps its tags and can be exported to every other format", async () => {
	const i18next = translationPlugins.find((format) => format.label === "i18next JSON")!.plugin;
	const json = translationPlugins.find((format) => format.label === "inlang JSON")!.plugin;
	const imported = await importWithPlugin({
		plugin: i18next,
		fileName: "en.json",
		content: JSON.stringify({ esc: "Say <b>bold</b> & {{name}}" }),
		locale: "en",
	});
	const text = imported[0].variants[0].pattern
		.map((element) => (element.type === "Text" ? element.value : `{${element.name}}`))
		.join("");
	expect(text).toBe("Say <b>bold</b> & {name}");
	// a bundle that still carries markup nodes (stored by an older build) is written as text as well
	const withMarkup: Message = {
		...imported[0],
		nativeBundle: {
			id: "esc",
			declarations: [],
			messages: [
				{
					id: "esc_en",
					bundleId: "esc",
					locale: "en",
					selectors: [],
					variants: [
						{
							id: "esc_en_1",
							messageId: "esc_en",
							matches: [],
							pattern: [
								{ type: "text", value: "Say " },
								{ type: "markup-start", name: "b", options: [], attributes: [] },
								{ type: "text", value: "bold" },
								{ type: "markup-end", name: "b", options: [], attributes: [] },
							],
						},
					],
				},
			],
		} as any,
		variants: [
			{
				languageTag: "en",
				match: [],
				pattern: [{ type: "Text", value: "Say <b>bold</b>" }],
			},
		],
	};
	const file = await exportWithPlugin(json, [withMarkup], "en");
	expect(JSON.parse(file.content)).toEqual({ esc: "Say <b>bold</b>" });
});

test("an export that a format cannot represent names the messages that block it", async () => {
	const strings = translationPlugins.find((format) => format.label === "Apple strings")!.plugin;
	const messages: Message[] = [
		{
			id: "plain",
			selectors: [],
			variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hi" }] }],
		},
		{
			id: "items",
			selectors: [{ type: "VariableReference", name: "count" }],
			variants: [
				{ languageTag: "en", match: ["one"], pattern: [{ type: "Text", value: "1 item" }] },
				{ languageTag: "en", match: ["*"], pattern: [{ type: "Text", value: "many items" }] },
			],
		},
	];
	await expect(exportWithPlugin(strings, messages, "en")).rejects.toThrow(
		/Affected messages: items\./,
	);
});

test("exported keys are sorted so files do not change order between sessions", async () => {
	const plugin = translationPlugins.find((format) => format.label === "inlang JSON")!.plugin;
	const message = (id: string): Message => ({
		id,
		selectors: [],
		variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: id }] }],
	});
	const file = await exportWithPlugin(plugin, [message("b"), message("c"), message("a")], "en");
	expect(Object.keys(JSON.parse(file.content))).toEqual(["a", "b", "c"]);
});

test("Apple strings read back their own output for texts with backslashes", async () => {
	const plugin = translationPlugins.find((format) => format.label === "Apple strings")!.plugin;
	const texts = [
		"C:\\temp\\new",
		"a \\ b",
		"end\\",
		"\\\\x",
		'quote " and \\" done',
		"tab\tline\nbreak",
	];
	const source: Message[] = texts.map((text, index) => ({
		id: `key${index}`,
		selectors: [],
		variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: text }] }],
	}));
	const file = await exportWithPlugin(plugin, source, "en");
	const parsed = await importWithPlugin({
		plugin,
		fileName: file.fileName,
		content: file.content,
		locale: "en",
	});
	const byId = new Map(
		parsed.map((message) => [
			message.id,
			message.variants[0].pattern.map((e) => (e.type === "Text" ? e.value : "")).join(""),
		]),
	);
	texts.forEach((text, index) => expect(byId.get(`key${index}`)).toBe(text));
	// hand written files too
	const handWritten = await importWithPlugin({
		plugin,
		fileName: "Localizable.strings",
		content: '"path" = "C:\\\\Users\\\\me";\n"unicode" = "caf\\u00e9 \\\\n stays";\n',
		locale: "en",
	});
	expect(handWritten.map((m) => (m.variants[0].pattern[0] as any).value)).toEqual([
		"C:\\Users\\me",
		"café \\n stays",
	]);
});
