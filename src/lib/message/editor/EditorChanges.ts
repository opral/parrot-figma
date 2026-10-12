import type { ChangeEventDetail } from "@inlang/editor-component";
import type { VariantRow as Variant } from "@inlang/sdk/browser";
import { fromRows, type BundleRows as BundleNested } from "../store/BundleRows";
import { validateBundleNested } from "../store/FigmaBundleStore";
import type { Message } from "../LegacyMessage";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../store/LegacyMessageBundleConverter";
import { draftMessages } from "./DraftMessages";
import { fromEditorBundle, toEditorBundle } from "./HtmlText";

/** The published plain-text editor omits annotations. Restore them by variable identity. */
export function preservePatternMetadata(
	previous: Variant["pattern"],
	next: Variant["pattern"],
): Variant["pattern"] {
	const expressions = previous.filter((e) => e.type === "expression");
	if (
		previous.some(
			(e) => e.type !== "text" && (e.type !== "expression" || e.arg.type !== "variable-reference"),
		)
	) {
		if (JSON.stringify(previous) !== JSON.stringify(next))
			throw new Error("This pattern cannot be edited in the text editor yet.");
		return next;
	}
	return next.map((element) => {
		if (
			element.type !== "expression" ||
			element.arg.type !== "variable-reference" ||
			element.annotation
		)
			return element;
		const name = element.arg.name;
		const candidates = expressions.filter(
			(e) => e.arg.type === "variable-reference" && e.arg.name === name,
		);
		if (new Set(candidates.map((e) => JSON.stringify(e.annotation))).size > 1) {
			throw new Error(
				`Variable "${name}" has multiple formats. It cannot be edited in the text editor yet.`,
			);
		}
		const annotation = candidates[0]?.annotation;
		return annotation ? { ...element, annotation: structuredClone(annotation) } : element;
	});
}

/** Selector actions emit several synchronous events; validate after applying the complete batch. */
export function applyEditorChanges(
	bundle: BundleNested,
	changes: ChangeEventDetail[],
): BundleNested {
	const next = structuredClone(bundle);
	for (const change of changes) {
		if (change.entity === "bundle") {
			if (!change.newData || change.entityId !== next.id) throw new Error("Invalid bundle edit");
			Object.assign(next, change.newData, { messages: next.messages });
		} else if (change.entity === "message") {
			const old = next.messages.find((m) => m.id === change.entityId);
			if (!change.newData) next.messages = next.messages.filter((m) => m.id !== change.entityId);
			else {
				const data = change.newData as Omit<BundleNested["messages"][number], "variants">;
				if (data.bundle_id !== next.id || data.id !== change.entityId)
					throw new Error("Invalid message edit");
				if (old) Object.assign(old, data, { variants: old.variants });
				else next.messages.push({ ...data, variants: [] });
			}
		} else {
			const data = change.newData as Variant | undefined;
			const parent = next.messages.find((m) =>
				data ? m.id === data.message_id : m.variants.some((v) => v.id === change.entityId),
			);
			if (!parent) throw new Error("Missing variant parent");
			const old = parent.variants.find((v) => v.id === change.entityId);
			if (!data) parent.variants = parent.variants.filter((v) => v.id !== change.entityId);
			else {
				if (data.id !== change.entityId) throw new Error("Invalid variant edit");
				const updated = {
					...data,
					pattern: old ? preservePatternMetadata(old.pattern, data.pattern) : data.pattern,
				};
				if (old) Object.assign(old, updated);
				else parent.variants.push(updated);
			}
		}
	}
	// Typing a new placeholder declares an input variable in the same save.
	for (const change of changes.filter((c) => c.entity === "variant" && c.newData)) {
		const variant = change.newData as Variant;
		for (const element of variant.pattern) {
			if (element.type === "expression" && element.arg.type === "variable-reference") {
				const name = element.arg.name;
				if (!next.declarations.some((d) => d.name === name))
					next.declarations.push({ type: "input-variable", name });
			}
		}
	}
	validateBundleNested(fromRows(next));
	return next;
}

/**
 * Applies edits of the message editor to a saved message - the message with every edit saved or queued
 * before them (e.g. a change of the "Plural & select" drawer), not the message the editor showed when
 * the edit was made.
 * - `fromPatternEditor`: the edits are typing. The pattern editor only knows the text: the variant keeps
 *   its own matches, and text of a form that an earlier edit deleted is dropped with the form.
 * - languages without a message yet get one (the editor shows a draft row for them).
 * @returns the saved message and the editor's view of it
 */
export function applyEditorEdit(
	saved: Message,
	changes: ChangeEventDetail[],
	options: { fromPatternEditor: boolean; locales: string[]; baseLocale: string },
): { message: Message; editorBundle: BundleNested } {
	const storedBundle = legacyMessageToBundle(saved);
	const editor = toEditorBundle(storedBundle);
	const previous = structuredClone(editor.bundle);
	const drafts = draftMessages(previous, options.locales, options.baseLocale);
	const variants = new Map(
		[...previous.messages, ...drafts].flatMap((m) => m.variants).map((v) => [v.id, v]),
	);
	const edits = changes.flatMap((change) => {
		if (!options.fromPatternEditor) return [change];
		const variant = variants.get(change.entityId);
		if (!variant) return [];
		const edited = change.newData as Variant | undefined;
		return edited ? [{ ...change, newData: { ...variant, pattern: edited.pattern } }] : [change];
	});
	for (const draft of drafts) {
		if (
			edits.some(
				(change) =>
					change.entityId === draft.id ||
					(change.newData as Variant | undefined)?.message_id === draft.id ||
					draft.variants.some((v) => v.id === change.entityId),
			)
		) {
			previous.messages.push(structuredClone(draft));
		}
	}
	const next = applyEditorChanges(previous, edits);
	return {
		message: bundleToLegacyMessage(fromEditorBundle(next, editor.rich, storedBundle), true),
		editorBundle: next,
	};
}
