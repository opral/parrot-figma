import { expect, test } from "vitest";
import { fromRows, toRows } from "./BundleRows";
import { bundleToLegacyMessage, legacyMessageToBundle } from "./LegacyMessageBundleConverter";

test("guidance survives row adapters, legacy text edits and added locales", () => {
	const bundle = {
		id: "save",
		description: "Shopping CTA",
		declarations: [],
		messages: [
			{
				id: "save_en",
				bundleId: "save",
				locale: "en",
				selectors: [],
				variants: [
					{
						id: "save_en_1",
						messageId: "save_en",
						matches: [],
						pattern: [{ type: "text" as const, value: "Save" }],
					},
				],
			},
		],
	};
	expect(fromRows(toRows(bundle))).toEqual(bundle);
	const legacy = bundleToLegacyMessage(bundle);
	expect(legacy.nativeBundle?.description).toBe("Shopping CTA");
	legacy.variants[0]!.pattern = [{ type: "Text", value: "Save now" }];
	legacy.variants.push({
		languageTag: "de",
		match: [],
		pattern: [{ type: "Text", value: "Sparen" }],
	});
	expect(legacyMessageToBundle(legacy).description).toBe("Shopping CTA");
});
