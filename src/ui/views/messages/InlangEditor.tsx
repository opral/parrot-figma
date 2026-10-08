import { useEffect, useRef, useState } from "react";
import {
	InlangBundle,
	InlangMessage,
	InlangVariant,
	InlangPatternEditor,
	InlangAddSelector,
	type ChangeEventDetail,
} from "@inlang/editor-component";
import type { BundleNested } from "@inlang/sdk/browser";
import type { Message } from "../../../lib/message/LegacyMessage";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../../../lib/message/store/LegacyMessageBundleConverter";
import { applyEditorChanges } from "../../../lib/message/editor/EditorChanges";
import "./InlangEditor.css";

const shadowTheme = `
* {
 --sl-input-color: var(--figma-color-text) !important;
 --sl-input-background-color: var(--figma-color-bg) !important;
 --sl-input-border-color: var(--figma-color-border) !important;
 --sl-input-placeholder-color: var(--figma-color-text-secondary) !important;
 --sl-color-primary-600: var(--figma-color-bg-brand) !important;
 --sl-color-neutral-700: var(--figma-color-text) !important;
 --sl-color-neutral-0: var(--figma-color-bg) !important;
 --sl-panel-background-color: var(--figma-color-bg) !important;
 --sl-panel-border-color: var(--figma-color-border) !important;
}
sl-button::part(base) { color: var(--figma-color-text-brand) !important; }
.header { background: var(--figma-color-bg) !important; }

:host { font-family: Inter, sans-serif; color: var(--figma-color-text); }
div, span, p { font-size: 11px !important; }
.header-left, .header-right, .variables-wrapper, .variables, .header, .message-header, .selector-container, .selector, .language-container, .new-variant, .variant, .match, .actions { min-height: 32px !important; }
.header, .selector, .actions { height: 32px !important; }
.header-left { display: none; }
.header { justify-content: flex-start; padding: 2px 8px !important; height: auto !important; min-height: 28px !important; }
.header-right, .variables-wrapper, .variables { min-height: 24px !important; min-width: 0; max-width: 100%; height: auto; }
.header-right { flex: 1; }
.variables-wrapper { flex: 1; flex-wrap: wrap; gap: 4px; padding: 2px 0; }
.variables { flex-wrap: wrap; gap: 4px; }
.variable-tag::part(base) { height: 24px; min-height: 24px; line-height: 16px; max-width: 100%; padding: 0 6px; color: var(--figma-color-text) !important; background: var(--figma-color-bg-secondary); border-color: var(--figma-color-border); }
.variable-tag::part(label) { line-height: 16px; display: flex; align-items: center; overflow: hidden; text-overflow: ellipsis; }
.variables sl-dropdown { min-width: 0; max-width: 100%; }
.button-wrapper { height: 24px !important; }
.text-button::part(base) { min-height: 24px; height: 24px; }
.message-body { min-width: 0; }
.variant { min-width: 0; }
sl-input::part(base) { background: var(--figma-color-bg); color: var(--figma-color-text); }
.ref-tag::part(base) { background: var(--figma-color-bg-tertiary); color: var(--figma-color-text-secondary); border: 1px solid var(--figma-color-border); }

.language-container { width: 72px; padding: 8px; }
.selector, .match { width: 104px; }
.new-variant { padding-left: 8px; }
sl-button::part(base), sl-input::part(input), sl-tag::part(base) { font-family: Inter, sans-serif; font-size: 11px; border-radius: 2px; }
.match::part(base), .match::part(input) { min-height: 32px !important; }
.ref-tag::part(base) { height: 16px; font-size: 9px; }
.dropdown-container { padding: 8px !important; gap: 8px !important; }
.dropdown-title { margin: 0 !important; font-size: 11px !important; }
.dropdown-item { gap: 4px !important; }
.dropdown-header, .help-text { min-height: 0 !important; }
.help-text { gap: 4px !important; }
.help-text svg { width: 14px; height: 14px; }
.help-text p { font-size: 10px !important; line-height: 14px !important; }
sl-select::part(form-control-label), sl-select::part(display-input), sl-option::part(label), sl-menu-item::part(label) { font: 11px/16px Inter, sans-serif !important; }
sl-select::part(combobox), sl-input::part(base), .option::part(base), .add-selector::part(base) { min-height: 24px !important; height: 24px !important; font-size: 11px !important; }
.selector-container { min-height: 24px !important; }
.selector { height: 24px !important; min-height: 24px !important; padding: 4px 8px !important; }
.actions { height: auto !important; min-height: 24px !important; }
.message-header { min-height: 24px !important; }
sl-button::part(base) { min-height: 24px !important; height: 24px !important; line-height: 16px !important; padding: 0 8px !important; }
sl-button::part(label) { line-height: 16px !important; display: flex; align-items: center; }
.message-actions, .add-selector-container { height: 24px !important; padding: 0 4px !important; }

`;
async function theme(element: HTMLElement & { updateComplete: Promise<unknown> }) {
	await element.updateComplete;
	if (!element.shadowRoot) return;
	const sheet = new CSSStyleSheet();
	sheet.replaceSync(shadowTheme);
	element.shadowRoot.adoptedStyleSheets = [...element.shadowRoot.adoptedStyleSheets, sheet];
	for (const nested of element.shadowRoot.querySelectorAll("inlang-add-variable")) {
		void theme(nested as HTMLElement & { updateComplete: Promise<unknown> });
	}
}

export default function InlangEditor({
	message,
	locales,
	baseLocale,
	onSave,
}: {
	message: Message;
	locales: string[];
	baseLocale: string;
	onSave: (message: Message) => Promise<void>;
}) {
	const container = useRef<HTMLDivElement>(null);
	const current = useRef<BundleNested>(legacyMessageToBundle(message));
	const save = useRef(onSave);
	const drafts = useRef<BundleNested["messages"]>([]);
	save.current = onSave;
	const [error, setError] = useState<string>();
	const [reset, setReset] = useState(0);
	useEffect(() => {
		const root = container.current!;
		const bundle = legacyMessageToBundle(message);
		current.current = bundle;
		drafts.current = locales
			.filter((locale) => !bundle.messages.some((m) => m.locale === locale))
			.map((locale) => {
				const id = `${bundle.id}_${locale}`;
				return {
					id,
					bundleId: bundle.id,
					locale,
					selectors: [],
					variants: [{ id: `${id}_1`, messageId: id, matches: [], pattern: [] }],
				};
			});
		const renderedMessages = [...bundle.messages, ...drafts.current];
		const structure = JSON.stringify([
			bundle.declarations,
			locales,
			baseLocale,
			reset,
			renderedMessages.map((m) => [
				m.id,
				m.selectors,
				m.variants.map((v) => [
					v.id,
					v.pattern
						.filter((e) => e.type !== "text")
						.map((e) => (e.type === "expression" ? [e.arg.type, e.annotation] : e)),
				]),
			]),
		]);
		const existing = root.querySelector("inlang-bundle") as InlangBundle | null;
		if (existing) {
			existing.bundle = { id: bundle.id, declarations: bundle.declarations };
			for (const element of root.querySelectorAll("inlang-message")) {
				const component = element as InlangMessage;
				const data = renderedMessages.find((m) => m.id === component.message?.id);
				if (data) {
					component.message = data;
					component.variants = data.variants;
				}
			}
			for (const element of root.querySelectorAll("inlang-variant")) {
				const component = element as InlangVariant;
				const variant = bundle.messages
					.flatMap((m) => m.variants)
					.find((v) => v.id === component.variant?.id);
				if (variant) {
					component.variant = variant;
					const editor = component.querySelector(
						"inlang-pattern-editor",
					) as InlangPatternEditor | null;
					if (editor && !editor.contains(document.activeElement)) editor.variant = variant;
				}
			}
			// Structural edits need a new slot tree; normal text edits retain focus.
			for (const element of root.querySelectorAll("inlang-add-selector")) {
				const component = element as InlangAddSelector;
				const data = renderedMessages.find((m) => m.id === component.message?.id);
				if (data) {
					component.bundle = existing.bundle;
					component.message = data;
					component.variants = data.variants;
				}
			}
			if (root.dataset.structure === structure) return;
		}
		root.replaceChildren();
		root.dataset.structure = structure;
		const bundleElement = new InlangBundle();
		bundleElement.bundle = { id: bundle.id, declarations: bundle.declarations };
		root.append(bundleElement);
		void theme(bundleElement);
		for (const locale of locales) {
			const data = renderedMessages.find((m) => m.locale === locale)!;
			const messageElement = new InlangMessage();
			messageElement.slot = "message";
			messageElement.message = data;
			messageElement.variants = data.variants;
			messageElement.settings = { baseLocale, locales, modules: [] };
			bundleElement.append(messageElement);
			void theme(messageElement);
			if (bundle.declarations.length && !drafts.current.some((m) => m.id === data.id)) {
				const details = document.createElement("details");
				details.slot = "variant";
				details.className = "inlang-selector-details";
				const summary = document.createElement("summary");
				summary.textContent = "Add selector";
				details.append(summary);
				const addSelector = new InlangAddSelector();
				addSelector.bundle = bundleElement.bundle;
				addSelector.message = data;
				addSelector.variants = data.variants;
				details.append(addSelector);
				messageElement.append(details);
				void theme(addSelector);
			}
			for (const variant of data.variants) {
				const element = new InlangVariant();
				element.slot = "variant";
				element.variant = variant;
				messageElement.append(element);
				void theme(element);
				const representable = variant.pattern.every(
					(e) =>
						e.type === "text" || (e.type === "expression" && e.arg.type === "variable-reference"),
				);
				if (representable) {
					const editor = new InlangPatternEditor();
					editor.variant = variant;
					editor.slot = "pattern-editor";
					element.append(editor);
					void editor.updateComplete.then(() => {
						const placeholder = editor.querySelector(".inlang-pattern-editor-placeholder");
						if (placeholder) placeholder.textContent = "Enter translation…";
						const field = editor.querySelector("[contenteditable]");
						field?.setAttribute("role", "textbox");
						field?.setAttribute("aria-label", `${locale} translation`);
					});
				}
				if (!representable) {
					const preview = document.createElement("div");
					preview.slot = "pattern-editor";
					preview.className = "inlang-structured-preview";
					preview.textContent = variant.pattern
						.map((e) =>
							e.type === "text"
								? e.value
								: e.type === "expression"
									? e.arg.type === "literal"
										? e.arg.value
										: `{${e.arg.name}}`
									: "",
						)
						.join("");
					preview.title = "This translation uses formatting that the text editor cannot edit yet.";
					element.append(preview);
				}
			}
		}
	}, [message, baseLocale, locales.join("|"), reset]);
	useEffect(() => {
		const root = container.current!;
		let pending: ChangeEventDetail[] = [];
		let queued = false;
		let saving = Promise.resolve();
		const handler = (event: Event) => {
			if (!(event instanceof CustomEvent) || !event.detail?.entity) return;
			pending.push(event.detail);
			event.stopPropagation();
			if (queued) return;
			queued = true;
			queueMicrotask(() => {
				queued = false;
				const changes = pending;
				pending = [];
				saving = saving.then(async () => {
					const previous = structuredClone(current.current);
					for (const draft of drafts.current) {
						if (
							changes.some(
								(change) =>
									change.entityId === draft.id ||
									draft.variants.some((v) => v.id === change.entityId),
							) &&
							!previous.messages.some((m) => m.id === draft.id)
						) {
							previous.messages.push(structuredClone(draft));
						}
					}
					try {
						const next = applyEditorChanges(previous, changes);
						await save.current(bundleToLegacyMessage(next, true));
						current.current = next;
						setError(undefined);
					} catch (e) {
						setError(e instanceof Error ? e.message : String(e));
						setReset((v) => v + 1);
					}
				});
			});
		};
		root.addEventListener("change", handler);
		return () => root.removeEventListener("change", handler);
	}, []);
	return (
		<div className="figma-inlang-editor">
			<div ref={container} />
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
