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
import { fromEditorBundle, toEditorBundle } from "../../../lib/message/editor/HtmlText";
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
sl-button[variant="primary"]::part(base) { color: var(--figma-color-text-onbrand, #fff) !important; }
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

.language-container { box-sizing: border-box; width: 72px; padding: 9px 8px; display: flex; flex-wrap: wrap; align-content: flex-start; gap: 2px 4px; line-height: 16px; color: var(--figma-color-text-secondary); font-weight: 500; }
.header { position: absolute !important; top: 0; right: 36px; z-index: 3; min-height: 28px !important; height: 28px !important; padding: 0 !important; pointer-events: none; opacity: var(--parrot-add-variable-opacity, 0); transition: opacity 0.1s; background: transparent !important; }
.header:focus-within { opacity: 1; }
.header sl-button, .header sl-tooltip, .header inlang-add-variable { pointer-events: auto; }
.selector, .match { width: 104px; }
.new-variant { padding-left: 8px; }
sl-button::part(base), sl-input::part(input), sl-tag::part(base) { font-family: Inter, sans-serif; font-size: 11px; border-radius: 2px; }
.match::part(base), .match::part(input) { min-height: 32px !important; }
.match::part(base) { box-sizing: border-box; height: 24px !important; min-height: 24px !important; margin: 4px 0 4px 8px; width: calc(100% - 8px); border: 1px solid var(--figma-color-border); border-radius: 2px; }
.match::part(base):hover { border-color: var(--figma-color-border-strong); }
.match:focus-within::part(base) { border-color: var(--figma-color-border-brand-strong); outline: 1px solid var(--figma-color-border-brand-strong); outline-offset: -1px; }
.match::part(input)::placeholder { color: var(--figma-color-text-secondary); opacity: 1; }
.match::part(input) { height: 22px !important; min-height: 0 !important; padding: 0 6px; line-height: 16px; }
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

/* no table: each text field has its own border, so rows and cells need no lines or grey cells */
:host(inlang-message), :host(inlang-variant) { border: none !important; }
.language-container, .match, .message-header, .new-variant { border: none !important; background-color: transparent !important; }

/* selector message: without the table lines the selector is a small chip (it opens the "Delete selector" menu) and the
   match inputs are a narrow column in front of the text field */
.selector-container { min-height: 0 !important; }
.selector, .match { width: 80px; }
.selector { position: relative; box-sizing: border-box; display: block !important; width: auto !important; min-width: 72px; max-width: 160px; flex: none; height: 24px !important; min-height: 24px !important; margin: 4px 0 0 8px; padding: 0 20px 0 6px !important; line-height: 22px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; background-color: transparent !important; border: 1px solid var(--figma-color-border) !important; border-radius: 2px; }
.selector::after { content: ""; position: absolute; right: 7px; top: 7px; width: 4px; height: 4px; border: solid var(--figma-color-icon-secondary); border-width: 0 1px 1px 0; transform: rotate(45deg); }
.selector:hover { background-color: var(--figma-color-bg-hover) !important; border-color: var(--figma-color-border-strong) !important; }
.new-variant { box-sizing: border-box; min-height: 24px !important; margin: 2px 8px 6px 8px; padding: 0 6px !important; width: auto !important; border-radius: 2px; }
.new-variant:hover { background-color: var(--figma-color-bg-hover) !important; }
/* a plain row with the "Add selector" line above its field: the language label follows the field */
.language-container { padding-top: calc(9px + var(--parrot-label-offset, 0px)); }

`;
async function theme(element: HTMLElement & { updateComplete: Promise<unknown> }) {
	await element.updateComplete;
	if (!element.shadowRoot) return;
	const sheet = new CSSStyleSheet();
	sheet.replaceSync(shadowTheme);
	element.shadowRoot.adoptedStyleSheets = [...element.shadowRoot.adoptedStyleSheets, sheet];
	// the match cell of a selector variant is an input: say so (it is an empty cell for a new variant)
	for (const match of element.shadowRoot.querySelectorAll("sl-input.match")) {
		match.setAttribute("placeholder", "match");
		match.setAttribute(
			"title",
			"The value of the selector this text is used for. * matches every other value.",
		);
	}
	// the selector chip is cut off when its name is long
	for (const selector of element.shadowRoot.querySelectorAll(".selector")) {
		selector.setAttribute("title", selector.textContent?.trim() ?? "");
	}
	for (const nested of element.shadowRoot.querySelectorAll("inlang-add-variable")) {
		void theme(nested as HTMLElement & { updateComplete: Promise<unknown> });
	}
}

/** The message component renders a header row (selectors, "Add selector" button) above the variants. */
function hasMessageHeader(message: { selectors: unknown[]; variants: unknown[] }) {
	return message.selectors.length > 0 || message.variants.length > 1;
}

/**
 * The pattern editor renders a light DOM <style> with the global selectors `div` and `p`
 * (`div { font-size: 14px }`). While a message editor is mounted that restyles every div of the
 * plugin (the tab bar jumps from 11px to 14px). Scope those two rules to the editor itself.
 */
function scopePatternEditorStyles(editor: HTMLElement) {
	for (const style of editor.querySelectorAll("style")) {
		const text = style.textContent ?? "";
		if (!/(^|\})\s*(div|p)\s*\{/.test(text)) continue;
		style.textContent = text.replace(
			/(^|\})(\s*)(div|p)(\s*\{)/g,
			"$1$2inlang-pattern-editor $3$4",
		);
	}
}

/**
 * Replaces the text of a field the user is not typing in. When the field had a selection before (the
 * user typed in it once) the Lexical editor of the component focuses it again after every external
 * change (e.g. Cmd+Z in Figma, a late save): the focus - and the key presses of the field the user had
 * moved on to - were taken, and Figma lost the keyboard.
 */
async function setVariantWithoutFocus(editor: InlangPatternEditor, variant: EditorVariant) {
	const field = editor.querySelector<HTMLElement>("[contenteditable]");
	if (field) field.focus = () => undefined;
	try {
		editor.variant = variant;
		await editor.updateComplete;
	} finally {
		if (field) delete (field as Partial<HTMLElement>).focus;
	}
}

type EditorVariant = BundleNested["messages"][number]["variants"][number];

/** Only plain text and plain variable references can be edited in the text editor. */
function isRepresentable(variant: EditorVariant, rich: ReadonlySet<string>) {
	return (
		!rich.has(variant.id) &&
		variant.pattern.every(
			(e) => e.type === "text" || (e.type === "expression" && e.arg.type === "variable-reference"),
		)
	);
}

const richTags = new Set([
	"strong",
	"b",
	"em",
	"i",
	"u",
	"s",
	"strike",
	"br",
	"ol",
	"ul",
	"li",
	"p",
]);

/** Copies the formatting that a text layer can have (nothing else, in particular no attributes). */
function appendRichContent(target: Element, source: Node) {
	for (const child of Array.from(source.childNodes)) {
		if (child.nodeType === Node.TEXT_NODE) {
			target.append(document.createTextNode(child.textContent ?? ""));
		} else if (child instanceof HTMLElement) {
			const tag = child.tagName.toLowerCase();
			if (tag === "script" || tag === "style" || child.classList.contains("ql-ui")) continue;
			if (!richTags.has(tag) && tag !== "a") {
				appendRichContent(target, child);
				continue;
			}
			const element = document.createElement(tag === "a" ? "u" : tag);
			if (tag === "li")
				element.dataset.list = child.dataset.list === "ordered" ? "ordered" : "bullet";
			appendRichContent(element, child);
			target.append(element);
		}
	}
}

/** Read-only, formatted view of a variant whose text contains markup. */
function renderRichPreview(preview: HTMLElement, variant: EditorVariant) {
	const html = variant.pattern.map((e) => (e.type === "text" ? e.value : elementText(e))).join("");
	const content = document.createElement("div");
	content.className = "inlang-rich-preview-content";
	appendRichContent(content, new DOMParser().parseFromString(html, "text/html").body);
	preview.replaceChildren(content);
}

function elementText(element: EditorVariant["pattern"][number]) {
	return element.type === "expression"
		? element.arg.type === "literal"
			? element.arg.value
			: `{${element.arg.name}}`
		: "";
}

function previewText(variant: EditorVariant) {
	return variant.pattern.map((e) => (e.type === "text" ? e.value : elementText(e))).join("");
}

/** "Translate" is only offered for an empty translation whose reference text is a single plain message. */
function syncTranslateButtons(
	root: HTMLElement,
	messages: BundleNested["messages"],
	baseLocale: string,
) {
	const reference = messages.find((m) => m.locale === baseLocale);
	const hasReferenceText =
		reference?.variants.length === 1 &&
		reference.selectors.length === 0 &&
		reference.variants[0]!.pattern.some((e) => e.type !== "text" || e.value.trim() !== "");
	for (const button of root.querySelectorAll<HTMLButtonElement>(".inlang-translate-variant")) {
		const variant = messages
			.flatMap((m) => m.variants)
			.find((v) => v.id === button.dataset.variantId);
		const isEmpty =
			!variant || variant.pattern.every((e) => e.type === "text" && e.value.trim() === "");
		button.hidden = !(isEmpty && hasReferenceText);
	}
}

export default function InlangEditor({
	message,
	locales,
	baseLocale,
	onSave,
	onTranslate,
}: {
	message: Message;
	locales: string[];
	baseLocale: string;
	onSave: (message: Message) => Promise<void>;
	/** Fills the (empty) translation of a locale from the reference language by machine translation. */
	onTranslate?: (locale: string) => Promise<void>;
}) {
	const container = useRef<HTMLDivElement>(null);
	// both are set by the effect below, before any edit can happen
	const current = useRef<BundleNested>(undefined as never);
	// the message as stored (HTML text) and the variants that contain markup (see HtmlText.ts)
	const stored = useRef<BundleNested>(undefined as never);
	const richVariants = useRef<ReadonlySet<string>>(new Set());
	const save = useRef(onSave);
	const translate = useRef(onTranslate);
	translate.current = onTranslate;
	const drafts = useRef<BundleNested["messages"]>([]);
	save.current = onSave;
	const [error, setError] = useState<string>();
	const [reset, setReset] = useState(0);
	useEffect(() => {
		const root = container.current!;
		stored.current = legacyMessageToBundle(message);
		const { bundle, rich } = toEditorBundle(stored.current);
		richVariants.current = rich;
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
		// Only changes that need a new slot tree may rebuild the editors. A rebuild drops the focus, so
		// typing a {variable} (which changes the pattern and the declarations) must be updated in place.
		const structure = JSON.stringify([
			locales,
			baseLocale,
			reset,
			// the order of the messages changes when a draft (empty locale) becomes a real message
			renderedMessages
				.map((m) => [m.id, m.selectors, m.variants.map((v) => [v.id, isRepresentable(v, rich)])])
				.sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
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
					component.toggleAttribute("data-header", hasMessageHeader(data));
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
					if (editor && !editor.contains(document.activeElement)) {
						void setVariantWithoutFocus(editor, variant);
					}
					const preview = component.querySelector<HTMLElement>(".inlang-structured-preview");
					if (preview) preview.textContent = previewText(variant);
					const richPreview = component.querySelector<HTMLElement>(".inlang-rich-preview");
					if (richPreview) renderRichPreview(richPreview, variant);
				}
			}
			syncTranslateButtons(root, renderedMessages, baseLocale);
			for (const details of root.querySelectorAll("details.inlang-selector-details")) {
				(details as HTMLDetailsElement).hidden = !bundle.declarations.length;
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
			messageElement.toggleAttribute("data-header", hasMessageHeader(data));
			bundleElement.append(messageElement);
			void theme(messageElement);
			if (!drafts.current.some((m) => m.id === data.id)) {
				const details = document.createElement("details");
				// selectors need a variable: declaring the first one only has to reveal this element
				details.hidden = !bundle.declarations.length;
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
				// the editor has no built-in way to remove a variant (e.g. after its selector was deleted)
				if (data.variants.length > 1) {
					const remove = document.createElement("button");
					remove.slot = "variant-action";
					remove.type = "button";
					remove.className = "inlang-delete-variant";
					remove.textContent = "Delete";
					remove.title = "Delete this variant";
					remove.setAttribute("aria-label", `Delete ${locale} variant`);
					remove.addEventListener("click", () =>
						remove.dispatchEvent(
							new CustomEvent<ChangeEventDetail>("change", {
								bubbles: true,
								composed: true,
								detail: { entityId: variant.id, entity: "variant" },
							}),
						),
					);
					element.append(remove);
				}
				// machine translation fills an empty translation from the reference language
				if (translate.current && locale !== baseLocale && data.variants.length === 1) {
					const button = document.createElement("button");
					button.slot = "variant-action";
					button.type = "button";
					button.className = "inlang-translate-variant";
					button.dataset.locale = locale;
					button.dataset.variantId = variant.id;
					button.textContent = `Translate from ${baseLocale}`;
					button.title = "Machine translation is available on request";
					button.addEventListener("click", () => {
						button.disabled = true;
						button.textContent = "Translating…";
						void (translate.current?.(locale) ?? Promise.resolve()).finally(() => {
							button.disabled = false;
							button.textContent = `Translate from ${baseLocale}`;
						});
					});
					element.append(button);
				}
				if (isRepresentable(variant, rich)) {
					const editor = new InlangPatternEditor();
					editor.variant = variant;
					editor.slot = "pattern-editor";
					element.append(editor);
					void editor.updateComplete.then(() => {
						scopePatternEditorStyles(editor);
						const placeholder = editor.querySelector(".inlang-pattern-editor-placeholder");
						if (placeholder) placeholder.textContent = "Enter translation…";
						const field = editor.querySelector("[contenteditable]");
						field?.setAttribute("role", "textbox");
						field?.setAttribute("aria-label", `${locale} translation`);
					});
				}
				if (rich.has(variant.id)) {
					// formatted text: shown as it looks, never rewritten by the plain-text editor
					const preview = document.createElement("div");
					preview.slot = "pattern-editor";
					preview.className = "inlang-rich-preview";
					preview.title =
						"This text has formatting (bold, lists, ...). The Messages tab shows it read-only so that the formatting is not lost - edit it on the canvas or in the Layers tab.";
					renderRichPreview(preview, variant);
					element.append(preview);
				} else if (!isRepresentable(variant, rich)) {
					const preview = document.createElement("div");
					preview.slot = "pattern-editor";
					preview.className = "inlang-structured-preview";
					preview.textContent = previewText(variant);
					preview.title = "This translation uses formatting that the text editor cannot edit yet.";
					element.append(preview);
				}
			}
		}
		syncTranslateButtons(root, renderedMessages, baseLocale);
	}, [message, baseLocale, locales.join("|"), reset]);
	useEffect(() => {
		const root = container.current!;
		let pending: ChangeEventDetail[] = [];
		const fromPatternEditor = new Set<ChangeEventDetail>();
		let queued = false;
		let saving = Promise.resolve();
		// Saving an edit also rewrites the linked layers (~100 ms) and typing is faster than that: edits
		// that arrive while a save runs are merged into the next one. Replaying every keystroke kept the
		// rows busy for seconds after typing, and each late result (an older text) was pushed back into the
		// row, which took the focus from the field the user had already moved on to.
		const handler = (event: Event) => {
			if (!(event instanceof CustomEvent) || !event.detail?.entity) return;
			pending.push(event.detail);
			// The pattern editor reports the whole variant but only knows the text: its copy of the
			// matches can be stale (e.g. right after a match was edited while it had the focus).
			if (event.target instanceof InlangPatternEditor) fromPatternEditor.add(event.detail);
			event.stopPropagation();
			if (queued) return;
			queued = true;
			saving = saving.then(async () => {
				queued = false;
				const batch = pending;
				pending = [];
				const previous = structuredClone(current.current);
				const changes = batch.map((change) => {
					if (!fromPatternEditor.delete(change)) return change;
					const variant = previous.messages
						.flatMap((m) => m.variants)
						.find((v) => v.id === change.entityId);
					const edited = change.newData as BundleNested["messages"][number]["variants"][number];
					return variant && edited
						? { ...change, newData: { ...variant, pattern: edited.pattern } }
						: change;
				});
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
					await save.current(
						bundleToLegacyMessage(
							fromEditorBundle(next, richVariants.current, stored.current),
							true,
						),
					);
					current.current = next;
					setError(undefined);
				} catch (e) {
					setError(e instanceof Error ? e.message : String(e));
					setReset((v) => v + 1);
				}
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
