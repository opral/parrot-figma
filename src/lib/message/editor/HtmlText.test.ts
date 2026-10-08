import { expect, test } from "vitest";
import {
	fromEditorBundle,
	htmlToPlainText,
	isRichHtml,
	plainTextToHtml,
	toEditorBundle,
} from "./HtmlText";
import { legacyMessageToBundle } from "../store/LegacyMessageBundleConverter";
import type { Message } from "../LegacyMessage";

test("markup is rich, entities and stray angle brackets are not", () => {
	expect(isRichHtml("First <strong>bold</strong> word")).toBe(true);
	expect(isRichHtml('<ol><li data-list="ordered"><span class="ql-ui"></span>One</li></ol>')).toBe(
		true,
	);
	expect(isRichHtml("Tom &amp; Jerry &lt;b&gt;")).toBe(false);
	expect(isRichHtml("5 < 6 and 7 > 3")).toBe(false);
	expect(isRichHtml("a <3 b")).toBe(false);
});

test("plain text round trips through the editor representation", () => {
	for (const stored of [
		"Tom &amp; Jerry",
		"He said &lt;b&gt;hi&lt;/b&gt; &amp; left",
		"&amp;lt; is the literal text &lt;",
		"price&nbsp;9&nbsp;EUR",
		"Fish &quot;n&quot; chips &#169; &copy;",
		"line one\nline two",
		"plain",
	]) {
		expect(plainTextToHtml(htmlToPlainText(stored))).toBe(stored);
	}
	expect(htmlToPlainText("Tom &amp; Jerry &lt;3")).toBe("Tom & Jerry <3");
	expect(htmlToPlainText("&amp;lt;")).toBe("&lt;");
});

test("typed text is encoded so that the canvas shows what was typed", () => {
	expect(plainTextToHtml("Tom & Jerry")).toBe("Tom &amp; Jerry");
	expect(plainTextToHtml("a <b> c")).toBe("a &lt;b&gt; c");
	// something that already looks like an entity is left to the HTML parser
	expect(plainTextToHtml("R&D; AT&T")).toBe("R&D; AT&amp;T");
});

function message(text: string, de: string): Message {
	return {
		id: "m",
		alias: {},
		selectors: [],
		variants: [
			{ languageTag: "en", match: [], pattern: [{ type: "Text", value: text }] },
			{
				languageTag: "de",
				match: [],
				pattern: [
					{ type: "Text", value: de },
					{ type: "VariableReference", name: "name" },
				],
			},
		],
	};
}

test("editor bundle decodes plain variants and leaves formatted variants as stored", () => {
	const stored = legacyMessageToBundle(message("Tom &amp; Jerry", "Hallo <strong>Welt</strong> "));
	const { bundle, rich } = toEditorBundle(stored);
	expect([...rich]).toEqual(["m_de_1"]);
	const en = bundle.messages.find((m) => m.locale === "en")!.variants[0]!;
	expect(en.pattern).toEqual([{ type: "text", value: "Tom & Jerry" }]);
	const de = bundle.messages.find((m) => m.locale === "de")!.variants[0]!;
	expect(de.pattern[0]).toEqual({ type: "text", value: "Hallo <strong>Welt</strong> " });

	// an edit of the plain text is stored encoded, the formatted variant is restored byte by byte
	const edited = structuredClone(bundle);
	edited.messages.find((m) => m.locale === "en")!.variants[0]!.pattern = [
		{ type: "text", value: "Tom & Jerry <3" },
	];
	edited.messages.find((m) => m.locale === "de")!.variants[0]!.pattern = [
		{ type: "text", value: "overwritten" },
	];
	const saved = fromEditorBundle(edited, rich, stored);
	expect(saved.messages.find((m) => m.locale === "en")!.variants[0]!.pattern).toEqual([
		{ type: "text", value: "Tom &amp; Jerry &lt;3" },
	]);
	expect(saved.messages.find((m) => m.locale === "de")!.variants).toEqual(
		stored.messages.find((m) => m.locale === "de")!.variants,
	);
});
