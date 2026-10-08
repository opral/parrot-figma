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
