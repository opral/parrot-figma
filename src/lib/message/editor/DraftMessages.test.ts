import { expect, test } from "vitest";
import type { BundleRows as BundleNested } from "../store/BundleRows";
import { draftMessages } from "./DraftMessages";
import { applyEditorChanges } from "./EditorChanges";

function bundle(selectors: BundleNested["messages"][number]["selectors"]): BundleNested {
	return {
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
				bundle_id: "items",
				locale: "en",
				selectors,
				variants: [
					{
						id: "items_en_1",
						message_id: "items_en",
						matches: selectors.map((s) => ({ type: "catchall-match", key: s.name })),
						pattern: [{ type: "text", value: "items" }],
					},
				],
			},
		],
	};
}

test("a language without text of a plain message gets one empty variant", () => {
	const drafts = draftMessages(bundle([]), ["en", "de"], "en");
	expect(drafts).toHaveLength(1);
	expect(drafts[0]).toMatchObject({ id: "items_de", locale: "de", selectors: [] });
	expect(drafts[0].variants).toEqual([
		{ id: "items_de_1", message_id: "items_de", matches: [], pattern: [] },
	]);
});

test("a language without text of a plural message starts with the selectors and no forms", () => {
	const selectors = [{ type: "variable-reference", name: "countPlural" } as const];
	const source = bundle([...selectors]);
	const drafts = draftMessages(source, ["en", "de"], "en");
	expect(drafts[0].selectors).toEqual(selectors);
	expect(drafts[0].selectors).not.toBe(source.messages[0].selectors);
	expect(drafts[0].variants).toEqual([]);
	// the first form added to it is stored as a message of its language with the shared selectors
	const next = applyEditorChanges({ ...source, messages: [...source.messages, drafts[0]] }, [
		{
			entity: "variant",
			entityId: "form",
			newData: {
				id: "form",
				message_id: "items_de",
				matches: [{ type: "literal-match", key: "countPlural", value: "one" }],
				pattern: [{ type: "text", value: "Artikel" }],
			},
		},
	]);
	expect(next.messages.find((m) => m.locale === "de")?.variants).toHaveLength(1);
});
