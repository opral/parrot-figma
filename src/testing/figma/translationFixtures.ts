import type { BundleNested } from "@inlang/sdk/browser";
import {
	FakeFigmaDocument,
	FakeFrameNode,
	FakeTextNode,
	createTextRange,
} from "./FakeFigma";

export function createTranslationFixture() {
	const figma = new FakeFigmaDocument();
	figma.availableFonts.push(
		{ family: "Inter", style: "Bold" },
		{ family: "Inter", style: "Italic" },
	);
	const page = figma.addPage("Checkout", "1:0");
	const frameA = page.appendChild(new FakeFrameNode("Checkout A", "2:0")) as FakeFrameNode;
	const frameB = page.appendChild(new FakeFrameNode("Checkout B", "3:0")) as FakeFrameNode;
	const richText = frameA.appendChild(
		new FakeTextNode("Hello Sam\nRead more", "Greeting", "4:0", [
			createTextRange(0, 9, { fontName: { family: "Inter", style: "Bold" } }),
			createTextRange(9, 19, {
				fontName: { family: "Inter", style: "Italic" },
				textDecoration: "UNDERLINE",
				hyperlink: { type: "URL", value: "https://example.com" },
				listOptions: { type: "UNORDERED" },
				indentation: 1,
			}),
		]),
	) as FakeTextNode;
	const sibling = frameB.appendChild(
		new FakeTextNode("Hello Sam", "Sibling greeting", "5:0"),
	) as FakeTextNode;
	richText.setPluginData("mn", "checkout.greeting");
	sibling.setPluginData("mn", "checkout.greeting");
	page.selection = [frameA];
	figma.mutations.length = 0;
	figma.counters.mutations = 0;

	const bundle: BundleNested = {
		id: "checkout.greeting",
		declarations: [
			{
				type: "input-variable",
				name: "count",
				annotation: {
					type: "function-reference",
					name: "plural",
					options: [{ name: "offset", value: { type: "literal", value: "0" } }],
				},
			},
			{ type: "input-variable", name: "name" },
			{
				type: "local-variable",
				name: "audience",
				value: {
					type: "expression",
					arg: { type: "literal", value: "member" },
				},
			},
		],
		messages: [
			{
				id: "checkout.greeting_en",
				bundleId: "checkout.greeting",
				locale: "en",
				selectors: [
					{ type: "variable-reference", name: "count" },
					{ type: "variable-reference", name: "audience" },
				],
				variants: [
					{
						id: "checkout.greeting_en_one_member",
						messageId: "checkout.greeting_en",
						matches: [
							{ type: "literal-match", key: "count", value: "one" },
							{ type: "literal-match", key: "audience", value: "member" },
						],
						pattern: [
							{ type: "text", value: "Hello " },
							{ type: "markup-start", name: "strong" },
							{
								type: "expression",
								arg: { type: "variable-reference", name: "name" },
								annotation: {
									type: "function-reference",
									name: "string",
									options: [],
								},
							},
							{ type: "markup-end", name: "strong" },
							{ type: "markup-standalone", name: "br" },
						],
					},
					{
						id: "checkout.greeting_en_fallback",
						messageId: "checkout.greeting_en",
						matches: [
							{ type: "catchall-match", key: "count" },
							{ type: "catchall-match", key: "audience" },
						],
						pattern: [{ type: "text", value: "Hello" }],
					},
				],
			},
		],
	};

	return { figma, page, frameA, frameB, richText, sibling, bundle };
}
