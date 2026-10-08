import { describe, expect, test } from "vitest";
import { importPlugins, importWithPlugin } from "./InlangPluginImporter";

describe("Inlang plugin import", () => {
	test("imports flat dotted keys, nested single-child objects and empty strings", async () => {
		const messages = await importWithPlugin({
			plugin: importPlugins[0].plugin,
			fileName: "en.json",
			locale: "en",
			content: JSON.stringify({
				"checkout.title": "Checkout",
				account: { name: "Name" },
				blank: "",
			}),
		});
		expect(messages.map((message) => message.id).sort()).toEqual([
			"account.name",
			"blank",
			"checkout.title",
		]);
		expect(messages.find((message) => message.id === "blank")?.variants[0].languageTag).toBe("en");
	});

	test("uses the i18next plugin for interpolation", async () => {
		const messages = await importWithPlugin({
			plugin: importPlugins[1].plugin,
			fileName: "de.json",
			locale: "de",
			content: JSON.stringify({ greeting: "Hallo {{name}}" }),
		});
		expect(
			messages.find((message) => message.id === "greeting")?.variants[0].pattern,
		).toContainEqual({ type: "VariableReference", name: "name" });
	});

	test("preserves imported plural rules", async () => {
		const messages = await importWithPlugin({
			plugin: importPlugins[1].plugin,
			fileName: "de.json",
			locale: "de",
			content: '{"item_one":"Ein Artikel","item_other":"Artikel"}',
		});
		expect(messages[0].nativeBundle?.declarations).toContainEqual(
			expect.objectContaining({ type: "local-variable" }),
		);
	});

	test("reports malformed files without importing partial data", async () => {
		await expect(
			importWithPlugin({
				plugin: importPlugins[0].plugin,
				fileName: "broken.json",
				locale: "en",
				content: "{",
			}),
		).rejects.toThrow("broken.json");
	});
});
