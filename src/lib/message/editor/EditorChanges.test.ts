import { expect, test } from "vitest";
import { applyEditorChanges } from "./EditorChanges";
import { importWithPlugin } from "../../import/InlangPluginImporter";
import { exportWithPlugin } from "../../transfer/ExportWithPlugin";
import { translationPlugins } from "../../transfer/TranslationFormats";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
	mergeImportedMessage,
} from "../store/LegacyMessageBundleConverter";
import { InlangV3Project } from "../store/InlangV3Project";
import { fromRows, toRows } from "../store/BundleRows";
const icu = translationPlugins.find((p) => p.label === "ICU MessageFormat")!.plugin;

async function imported(pattern: string, locale = "en") {
	return (
		await importWithPlugin({
			plugin: icu,
			content: JSON.stringify({ price: pattern }),
			fileName: `${locale}.json`,
			locale,
		})
	)[0];
}

test("text edits preserve currency options across SDK storage and export", async () => {
	const original = await imported("Total {amount, number, currency/USD}");
	const bundle = toRows(legacyMessageToBundle(original));
	const variant = bundle.messages[0].variants[0];
	const next = applyEditorChanges(bundle, [
		{
			entity: "variant",
			entityId: variant.id,
			newData: {
				...variant,
				pattern: [
					{ type: "text", value: "Pay " },
					{ type: "expression", arg: { type: "variable-reference", name: "amount" } },
				],
			},
		},
	]);
	const updated = bundleToLegacyMessage(fromRows(next), true);
	const session = await InlangV3Project.open({
		settings: { baseLocale: "en", locales: ["en"], modules: [] },
		messages: [original],
	});
	try {
		await session.upsert(updated);
		const exported = await exportWithPlugin(icu, [session.get("price")!], "en");
		expect(JSON.parse(exported.content).price).toBe("Pay {amount, number, currency/USD}");
	} finally {
		await session.close();
	}
});

test("plural variant edits preserve the plural declaration and number sign", async () => {
	const original = await imported("{count, plural, one {# item} other {# items}}");
	const bundle = toRows(legacyMessageToBundle(original));
	const variant = bundle.messages[0].variants[0];
	const next = applyEditorChanges(bundle, [
		{
			entity: "variant",
			entityId: variant.id,
			newData: {
				...variant,
				pattern: [
					{ type: "expression", arg: { type: "variable-reference", name: "count" } },
					{ type: "text", value: " product" },
				],
			},
		},
	]);
	expect(next.declarations).toEqual(bundle.declarations);
	const exported = await exportWithPlugin(icu, [bundleToLegacyMessage(fromRows(next), true)], "en");
	expect(JSON.parse(exported.content).price).toContain("one {# product}");
});

test("legacy text editing keeps the formatter of a variable", async () => {
	const message = await imported("Total {amount, number}");
	message.variants[0].pattern = [
		{ type: "Text", value: "Sum " },
		{ type: "VariableReference", name: "amount" },
	];
	const saved = legacyMessageToBundle(message);
	expect(saved.messages[0]!.variants[0]!.pattern).toEqual([
		{ type: "text", value: "Sum " },
		message.nativeBundle!.messages[0]!.variants[0]!.pattern.find((e) => e.type === "expression"),
	]);
	const exported = await exportWithPlugin(icu, [bundleToLegacyMessage(saved, true)], "en");
	expect(JSON.parse(exported.content).price).toBe("Sum {amount, number}");
});

test("locale imports preserve other locale selectors and declarations", async () => {
	const english = await imported("Hello {name}");
	const german = await imported("{count, plural, one {# Artikel} other {# Artikel}}", "de");
	const merged = mergeImportedMessage(english, german, "de");
	const en = await exportWithPlugin(icu, [merged], "en");
	const de = await exportWithPlugin(icu, [merged], "de");
	expect(JSON.parse(en.content).price).toBe("Hello {name}");
	expect(JSON.parse(de.content).price).toContain("plural");
});

test("selector removal is applied as a single valid batch", async () => {
	const bundle = toRows(
		legacyMessageToBundle(await imported("{gender, select, female {She} other {They}}")),
	);
	const message = bundle.messages[0];
	const next = applyEditorChanges(bundle, [
		...message.variants.map((v) => ({
			entity: "variant" as const,
			entityId: v.id,
			newData: { ...v, matches: [] },
		})),
		{
			entity: "message",
			entityId: message.id,
			newData: { id: message.id, bundle_id: bundle.id, locale: message.locale, selectors: [] },
		},
	]);
	expect(next.messages[0].selectors).toEqual([]);
});

test("deleting a referenced declaration cannot save a broken bundle", async () => {
	const bundle = toRows(legacyMessageToBundle(await imported("Total {amount, number}")));
	expect(() =>
		applyEditorChanges(bundle, [
			{ entity: "bundle", entityId: bundle.id, newData: { id: bundle.id, declarations: [] } },
		]),
	).toThrow("still referenced");
});

test("typing a new placeholder declares it in the same edit", async () => {
	const bundle = toRows(legacyMessageToBundle(await imported("Hello")));
	const variant = bundle.messages[0].variants[0];
	const next = applyEditorChanges(bundle, [
		{
			entity: "variant",
			entityId: variant.id,
			newData: {
				...variant,
				pattern: [{ type: "expression", arg: { type: "variable-reference", name: "name" } }],
			},
		},
	]);
	expect(next.declarations).toContainEqual({ type: "input-variable", name: "name" });
});

test("a locale can replace its own declaration without changing another locale", async () => {
	const old = await imported("Total {countPlural}", "de");
	const plural = await imported("{count, plural, one {# Artikel} other {# Artikel}}", "de");
	const merged = mergeImportedMessage(old, plural, "de");
	expect(merged.nativeBundle?.declarations).toContainEqual(
		expect.objectContaining({ name: "countPlural", type: "local-variable" }),
	);
});
