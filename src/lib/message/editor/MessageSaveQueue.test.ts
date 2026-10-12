import { describe, expect, it } from "vitest";
import type { ChangeEventDetail } from "@inlang/editor-component";
import type { Message } from "../LegacyMessage";
import { MessageSaveQueue, type SaveOptions } from "./MessageSaveQueue";
import { applyEditorEdit } from "./EditorChanges";
import {
	addChoiceValue,
	addMessageSelector,
	removeMessageSelector,
	selectorChoices,
} from "./Selectors";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../store/LegacyMessageBundleConverter";

const plain = (en: string, de?: string): Message => ({
	id: "cart",
	selectors: [],
	variants: [
		{ languageTag: "en", match: [], pattern: [{ type: "Text", value: en }] },
		...(de === undefined
			? []
			: [{ languageTag: "de", match: [], pattern: [{ type: "Text" as const, value: de }] }]),
	],
});

const text = (message: Message, language: string) =>
	message.variants
		.filter((variant) => variant.languageTag === language)
		.map((variant) =>
			variant.pattern
				.map((part) => (part.type === "Text" ? part.value : `{${part.name}}`))
				.join(""),
		);

/** A save that takes `ms` and records what was saved. */
function recorder(ms = 5) {
	const saves: { message: Message; options: SaveOptions }[] = [];
	const save = async (message: Message, options: SaveOptions) => {
		await new Promise((resolve) => setTimeout(resolve, ms));
		saves.push({ message, options });
	};
	return { saves, save };
}

/** What a keystroke in the editor's field of a variant queues. */
function typing(queue: MessageSaveQueue, variantId: string, value: string) {
	const change = {
		entity: "variant",
		entityId: variantId,
		newData: { id: variantId, pattern: [{ type: "text", value }] },
	} as unknown as ChangeEventDetail;
	return queue.edit(
		(saved) =>
			applyEditorEdit(saved, [change], {
				fromPatternEditor: true,
				locales: ["en", "de"],
				baseLocale: "en",
			}).message,
	);
}

type Bundle = ReturnType<typeof legacyMessageToBundle>;

/** What the "Plural & select" drawer queues. */
function drawer(queue: MessageSaveQueue, change: (bundle: Bundle) => Bundle) {
	return queue.edit((saved) => bundleToLegacyMessage(change(legacyMessageToBundle(saved)), true), {
		undoStep: true,
	});
}

const countMessage = (): Message => ({
	id: "cart",
	selectors: [],
	variants: [
		{
			languageTag: "en",
			match: [],
			pattern: [
				{ type: "VariableReference", name: "count" },
				{ type: "Text", value: " items" },
			],
		},
	],
});

describe("MessageSaveQueue", () => {
	it("merges typing that arrives during a save and saves a change of the forms on its own", async () => {
		const { saves, save } = recorder();
		const queue = new MessageSaveQueue(plain("a"), save);
		const edits = [
			typing(queue, "cart_en_1", "a1"),
			typing(queue, "cart_en_1", "a12"),
			// a structural edit: a language added
			queue.edit(
				(m) => ({ ...m, variants: [...m.variants, ...plain("x", "Wagen").variants.slice(1)] }),
				{
					undoStep: true,
				},
			),
			typing(queue, "cart_en_1", "a123"),
			typing(queue, "cart_en_1", "a1234"),
		];
		await Promise.all(edits);
		expect(saves.map((s) => [s.options.undoStep, text(s.message, "en")[0]])).toEqual([
			[false, "a12"],
			[true, "a12"],
			[false, "a1234"],
		]);
		// the structural edit is kept by the typing after it
		expect(text(saves[2].message, "de")).toEqual(["Wagen"]);
		expect(queue.busy).toBe(false);
	});

	it("a drawer change while a text save runs keeps the text, text typed after it keeps the change", async () => {
		const { saves, save } = recorder(20);
		const queue = new MessageSaveQueue(countMessage(), save);
		// typing: the first save starts
		const first = typing(queue, "cart_en_1", "Items");
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(queue.busy).toBe(true);
		// while it runs: more typing, then the drawer makes the message plural, then more typing
		const second = typing(queue, "cart_en_1", "Items in cart");
		const plural = drawer(queue, (bundle) =>
			addMessageSelector(bundle, { variable: "count", kind: "plural" }, "en"),
		);
		await Promise.all([first, second, plural]);

		const afterDrawer = queue.message;
		expect(afterDrawer.selectors.map((s) => s.name)).toEqual(["countPlural"]);
		// the drawer's change was made on top of the text typed before it
		expect(text(afterDrawer, "en")).toEqual(["Items in cart"]);

		// typing into the "other" form after the drawer change keeps the plural
		await typing(queue, "cart_en_1", "Many items in cart");
		const last = saves[saves.length - 1].message;
		expect(last.selectors.map((s) => s.name)).toEqual(["countPlural"]);
		expect(text(last, "en")).toEqual(["Many items in cart"]);
		expect(saves.map((s) => s.options.undoStep)).toEqual([false, false, true, false]);
	});

	it("drops text typed into a form that a drawer change deleted before it was saved", async () => {
		const { save } = recorder();
		const queue = new MessageSaveQueue(countMessage(), save);
		await drawer(queue, (bundle) =>
			addMessageSelector(bundle, { variable: "count", kind: "plural" }, "en"),
		);
		// "+ Exact number" =0: a form of its own
		let zero = "";
		await drawer(queue, (bundle) => {
			const added = addChoiceValue(bundle, selectorChoices(bundle, "en")[0], "0", "en");
			zero = added.variantId!;
			return added.bundle;
		});
		expect(zero).not.toBe("");
		// typing into the =0 form, and removing the plural before that text was saved
		const typed = typing(queue, zero, "No items");
		const removed = drawer(queue, (bundle) =>
			removeMessageSelector(bundle, selectorChoices(bundle, "en")[0]),
		);
		await Promise.all([typed, removed]);
		const after = legacyMessageToBundle(queue.message);
		expect(after.messages[0].selectors).toEqual([]);
		expect(after.messages[0].variants).toHaveLength(1);
		// typing into the remaining form works as before
		await typing(queue, after.messages[0].variants[0].id, "{count} things");
		expect(legacyMessageToBundle(queue.message).messages[0].variants).toHaveLength(1);
	});

	it("a failed save leaves the message as it was, later edits start from it", async () => {
		let fail = true;
		const saved: string[] = [];
		const queue = new MessageSaveQueue(plain("a"), async (message) => {
			if (fail) throw new Error("offline");
			saved.push(text(message, "en")[0]);
		});
		await expect(typing(queue, "cart_en_1", "ab")).rejects.toThrow("offline");
		expect(text(queue.message, "en")).toEqual(["a"]);
		fail = false;
		await queue.edit((m) => ({ ...m, alias: { x: "1" } }), { undoStep: true });
		expect(text(queue.message, "en")).toEqual(["a"]);
		expect(saved).toEqual(["a"]);
	});

	it("an edit that cannot be applied fails alone, the edits merged with it are saved", async () => {
		const { saves, save } = recorder();
		const queue = new MessageSaveQueue(plain("a"), save);
		const results = await Promise.allSettled([
			typing(queue, "cart_en_1", "ab"),
			queue.edit(() => {
				throw new Error("invalid");
			}),
			typing(queue, "cart_en_1", "abc"),
		]);
		expect(results.map((r) => r.status)).toEqual(["fulfilled", "rejected", "fulfilled"]);
		expect(saves).toHaveLength(1);
		expect(text(saves[0].message, "en")).toEqual(["abc"]);
	});

	it("takes a message changed elsewhere only while nothing is queued", async () => {
		const { save } = recorder();
		const queue = new MessageSaveQueue(plain("a"), save);
		const pending = typing(queue, "cart_en_1", "ab");
		// the store echoes an older state of our own edit while it is saved
		queue.sync(plain("a"));
		await pending;
		expect(text(queue.message, "en")).toEqual(["ab"]);
		// undo on the canvas
		queue.sync(plain("undone"));
		await typing(queue, "cart_en_1", "undone!");
		expect(text(queue.message, "en")).toEqual(["undone!"]);
	});

	it("types into a language that had no text yet", async () => {
		const { save } = recorder();
		const queue = new MessageSaveQueue(plain("Cart"), save);
		await typing(queue, "cart_de_1", "Warenkorb");
		expect(text(queue.message, "de")).toEqual(["Warenkorb"]);
		expect(text(queue.message, "en")).toEqual(["Cart"]);
	});
});
