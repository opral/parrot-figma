import { expect, test } from "vitest";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
	mergeImportedMessage,
} from "./LegacyMessageBundleConverter";
import type { Message } from "../LegacyMessage";

const english: Message = {
	id: "welcome",
	selectors: [],
	variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Welcome" }] }],
};
const german: Message = {
	id: "welcome",
	selectors: [],
	variants: [{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Willkommen" }] }],
};

test("a message without Inlang metadata can still be edited after an import merged a language into it", () => {
	// importing a second language keeps the merged bundle on the message
	const merged = mergeImportedMessage(english, german, "de");
	expect(merged.nativeBundle).toBeDefined();

	// machine translation / the Layers tab add or change variants through the legacy view
	const translated: Message = {
		...merged,
		variants: [
			...merged.variants,
			{ languageTag: "zh", match: [], pattern: [{ type: "Text", value: "欢迎" }] },
		],
	};
	const bundle = legacyMessageToBundle(translated);
	expect(bundle.messages.map((message) => message.locale).sort()).toEqual(["de", "en", "zh"]);
	expect(bundleToLegacyMessage(bundle).variants).toHaveLength(3);
});

test("a message with Inlang metadata must be edited in the Messages tab", () => {
	const plural = bundleToLegacyMessage({
		id: "items",
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
		messages: [
			{
				id: "items_en",
				bundleId: "items",
				locale: "en",
				selectors: [{ type: "variable-reference", name: "countPlural" }],
				variants: [
					{
						id: "items_en_1",
						messageId: "items_en",
						matches: [{ type: "catchall-match", key: "countPlural" }],
						pattern: [{ type: "text", value: "items" }],
					},
				],
			},
		],
	} as any);
	expect(plural.nativeBundle).toBeDefined();
	const edited = {
		...plural,
		variants: [{ ...plural.variants[0], pattern: [{ type: "Text" as const, value: "x" }] }],
	};
	expect(() => legacyMessageToBundle(edited)).toThrow("Messages tab");
});
