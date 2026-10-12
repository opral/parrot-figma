import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
	InlangMessageForms,
	InlangPatternEditor,
	type AddVariantEventDetail,
	type ChangeEventDetail,
	type SelectVariantEventDetail,
} from "@inlang/editor-component";
import type { BundleNested } from "@inlang/sdk/browser";
import type { Message } from "../../../lib/message/LegacyMessage";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../../../lib/message/store/LegacyMessageBundleConverter";
import { applyEditorChanges, saveGroups } from "../../../lib/message/editor/EditorChanges";
import { draftMessages } from "../../../lib/message/editor/DraftMessages";
import { addExactNumbersOfReference } from "../../../lib/message/editor/Selectors";
import { fromEditorBundle, toEditorBundle } from "../../../lib/message/editor/HtmlText";
import { TranslationProblems, useTranslationProblems } from "./TranslationProblems";
import "./InlangEditor.css";

type EditorMessage = BundleNested["messages"][number];
type EditorVariant = EditorMessage["variants"][number];
type Declarations = BundleNested["declarations"];

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

function isEmpty(variant: EditorVariant | undefined) {
	return !variant || variant.pattern.every((e) => e.type === "text" && e.value.trim() === "");
}

/**
 * Formatted text (bold, lists, …) of a text layer: shown as it looks, never rewritten here - it is
 * edited on the canvas or in the Layers tab, so the formatting cannot get lost.
 */
function RichPreview({ variant }: { variant: EditorVariant }) {
	const host = useRef<HTMLDivElement>(null);
	useLayoutEffect(() => {
		const html = variant.pattern
			.map((e) =>
				e.type === "text"
					? e.value
					: e.type === "expression" && e.arg.type === "variable-reference"
						? `{${e.arg.name}}`
						: "",
			)
			.join("");
		const content = document.createElement("div");
		content.className = "inlang-rich-preview-content";
		appendRichContent(content, new DOMParser().parseFromString(html, "text/html").body);
		host.current!.replaceChildren(content);
	}, [variant]);
	return (
		<div
			ref={host}
			className="inlang-rich-preview"
			title="This text has formatting (bold, lists, …). It is edited on the canvas or in the Layers tab so that the formatting is not lost."
		/>
	);
}

/** `<inlang-pattern-editor>` for one variant. Edits bubble up as `change` events to the editor root. */
function PatternField({
	variant,
	declarations,
	label,
	external,
	fields,
}: {
	variant: EditorVariant;
	declarations: Declarations;
	label: string;
	/** the variant was changed outside of this field (e.g. Cmd+Z), not echoed from its own edit */
	external: boolean;
	/** the pattern editors by variant id, to focus a form that was just added */
	fields: Map<string, InlangPatternEditor>;
}) {
	const host = useRef<HTMLDivElement>(null);
	const editor = useRef<InlangPatternEditor>(undefined);
	const given = useRef<string>(undefined);
	useLayoutEffect(() => {
		const element = new InlangPatternEditor();
		element.placeholder = "Enter translation…";
		host.current!.append(element);
		editor.current = element;
		fields.set(variant.id, element);
		return () => {
			if (fields.get(variant.id) === element) fields.delete(variant.id);
			element.remove();
		};
	}, []);
	useLayoutEffect(() => {
		const element = editor.current!;
		element.setAttribute("aria-label", label);
		element.declarations = declarations;
		element.variables = declarations.map((d) => ({ name: d.name }));
		// The same text again (the message is rendered several times per save) is no news: the editor
		// treats a text that is not one of its pending edits as a change from elsewhere and would
		// overwrite what is being typed.
		const text = JSON.stringify(variant.pattern);
		if (text === given.current && !external) return;
		given.current = text;
		// the editor ignores variants it emitted itself; an undo can bring such a text back
		if (external) element.forgetEdits();
		element.variant = variant;
	}, [variant, declarations, label, external]);
	return <div ref={host} className="inlang-field" />;
}

/** `<inlang-message-forms>`: the variants (plural forms, …) of a message, to pick the one to edit. */
function MessageForms({
	message,
	declarations,
	referenceVariants,
	selectedVariantId,
	onSelect,
	onAdd,
}: {
	message: EditorMessage;
	declarations: Declarations;
	/** variants of the reference language: a translation is asked for the same select values */
	referenceVariants: EditorVariant[] | undefined;
	selectedVariantId: string;
	onSelect: (variantId: string) => void;
	onAdd: (matches: EditorVariant["matches"]) => void;
}) {
	const host = useRef<HTMLDivElement>(null);
	const forms = useRef<InlangMessageForms>(undefined);
	const callbacks = useRef({ onSelect, onAdd });
	callbacks.current = { onSelect, onAdd };
	useLayoutEffect(() => {
		const element = new InlangMessageForms();
		element.addEventListener("select-variant", (event) =>
			callbacks.current.onSelect((event as CustomEvent<SelectVariantEventDetail>).detail.variantId),
		);
		element.addEventListener("add-variant", (event) =>
			callbacks.current.onAdd(
				(event as CustomEvent<AddVariantEventDetail>).detail.matches as EditorVariant["matches"],
			),
		);
		host.current!.append(element);
		forms.current = element;
		return () => element.remove();
	}, []);
	useLayoutEffect(() => {
		const element = forms.current!;
		element.message = message;
		element.variants = message.variants;
		element.declarations = declarations;
		element.referenceVariants = referenceVariants;
		element.locale = message.locale;
		element.selectedVariantId = selectedVariantId;
	}, [message, declarations, referenceVariants, selectedVariantId]);
	return <div ref={host} className="inlang-forms" />;
}

export default function InlangEditor({
	message,
	locales,
	baseLocale,
	onSave,
	onTranslate,
	focusForm,
}: {
	message: Message;
	locales: string[];
	baseLocale: string;
	/** `undoStep`: the save changes the forms and is an undo step of its own */
	onSave: (message: Message, options?: { undoStep?: boolean }) => Promise<void>;
	/** Fills the (empty) translation of a locale from the reference language. */
	onTranslate?: (locale: string) => Promise<void>;
	/** a form added elsewhere (a new exact number, a select value): selected and focused once it is rendered */
	focusForm?: { locale: string; variantId: string };
}) {
	const root = useRef<HTMLDivElement>(null);
	// the message as stored (HTML text), as the editors show it, and the variants with formatting
	const { stored, bundle, rich } = useMemo(() => {
		const storedBundle = legacyMessageToBundle(message);
		return { stored: storedBundle, ...toEditorBundle(storedBundle) };
	}, [message]);
	const localesKey = locales.join("|");
	const drafts = useMemo(
		() => draftMessages(bundle, locales, baseLocale),
		[bundle, localesKey, baseLocale],
	);
	const problems = useTranslationProblems(stored, locales, baseLocale);

	// The state the editors were last given. A new `message` whose text differs from it was changed
	// elsewhere (undo, the canvas, an import) and replaces what the editor shows.
	const current = useRef<BundleNested>(bundle);
	// Texts the pattern editors reported per variant, and whether a save is queued or running. While
	// the user types, saves finish one after the other and each renders an older text than the field
	// shows: those renders are echoes of our own edits, not changes from elsewhere.
	const emitted = useRef(new Map<string, string[]>());
	const busy = useRef(false);
	const external = useMemo(() => {
		const changed = new Set<string>();
		if (busy.current) return changed;
		const before = new Map(
			current.current.messages.flatMap((m) => m.variants).map((v) => [v.id, v]),
		);
		for (const variant of bundle.messages.flatMap((m) => m.variants)) {
			const previous = before.get(variant.id);
			const text = JSON.stringify(variant.pattern);
			if (
				previous &&
				JSON.stringify(previous.pattern) !== text &&
				!emitted.current.get(variant.id)?.includes(text)
			)
				changed.add(variant.id);
		}
		current.current = bundle;
		return changed;
	}, [bundle]);

	// Forms added here, shown (and focused) right away instead of once they are saved, so text typed
	// right after "+ Add form" goes into the new form.
	const [adding, setAdding] = useState<EditorVariant[]>([]);
	useEffect(() => {
		if (!adding.length) return;
		const saved = new Set(bundle.messages.flatMap((m) => m.variants.map((v) => v.id)));
		setAdding((list) => {
			const rest = list.filter((v) => !saved.has(v.id));
			return rest.length === list.length ? list : rest;
		});
	}, [bundle]);
	// the pattern editors by variant id, and the form to focus once its editor exists
	const fields = useRef(new Map<string, InlangPatternEditor>());
	const focusVariant = useRef<string>(undefined);
	useLayoutEffect(() => {
		const field = focusVariant.current && fields.current.get(focusVariant.current);
		if (!field) return;
		focusVariant.current = undefined;
		// the editor focuses once it has rendered: before the next key press
		field.focus();
	});

	const latest = useRef({ stored, rich, drafts, onSave });
	latest.current = { stored, rich, drafts, onSave };
	const [selected, setSelected] = useState<Record<string, string>>({});
	const [error, setError] = useState<string>();
	const enqueue = useRef<(changes: ChangeEventDetail[], fromPatternEditor: boolean) => void>(
		() => undefined,
	);

	useEffect(() => {
		let pending: { change: ChangeEventDetail; fromPatternEditor: boolean }[] = [];
		let queued = false;
		let saving = Promise.resolve();
		// Saving an edit also rewrites the linked layers (~100 ms) and typing is faster than that: edits
		// that arrive while a save runs are merged into the next one.
		const save = async (batch: typeof pending, undoStep: boolean) => {
			{
				const previous = structuredClone(current.current);
				const changes = batch.map(({ change, fromPatternEditor: fromEditor }) => {
					if (!fromEditor) return change;
					// the pattern editor only knows the text: keep the variant's own matches
					const variant = previous.messages
						.flatMap((m) => m.variants)
						.find((v) => v.id === change.entityId);
					const edited = change.newData as EditorVariant | undefined;
					return variant && edited
						? { ...change, newData: { ...variant, pattern: edited.pattern } }
						: change;
				});
				for (const draft of latest.current.drafts) {
					if (
						changes.some(
							(change) =>
								change.entityId === draft.id ||
								(change.newData as EditorVariant | undefined)?.message_id === draft.id ||
								draft.variants.some((v) => v.id === change.entityId),
						) &&
						!previous.messages.some((m) => m.id === draft.id)
					) {
						previous.messages.push(structuredClone(draft));
					}
				}
				try {
					const next = applyEditorChanges(previous, changes);
					// set before saving: the save renders the new message, which is this edit, not an external one
					current.current = next;
					await latest.current.onSave(
						bundleToLegacyMessage(
							fromEditorBundle(next, latest.current.rich, latest.current.stored),
							true,
						),
						{ undoStep },
					);
					setError(undefined);
				} catch (e) {
					current.current = previous;
					// a form that could not be added is not shown
					const failed = new Set(batch.map(({ change }) => change.entityId));
					setAdding((list) => list.filter((v) => !failed.has(v.id)));
					setError(e instanceof Error ? e.message : String(e));
				}
			}
		};
		enqueue.current = (changes, fromPatternEditor) => {
			pending.push(...changes.map((change) => ({ change, fromPatternEditor })));
			busy.current = true;
			if (queued) return;
			queued = true;
			saving = saving.then(async () => {
				queued = false;
				const batch = pending;
				pending = [];
				// typing is merged into one save, a form added or deleted is a save (and undo step) of its own
				for (const group of saveGroups(batch)) await save(group.edits, group.structural);
				busy.current = queued || pending.length > 0;
			});
		};
		const element = root.current!;
		const onChange = (event: Event) => {
			if (!(event instanceof CustomEvent) || !event.detail?.entity) return;
			event.stopPropagation();
			const edited = event.detail.newData as EditorVariant | undefined;
			if (event.target instanceof InlangPatternEditor && edited) {
				const texts = emitted.current.get(event.detail.entityId) ?? [];
				emitted.current.set(event.detail.entityId, [
					...texts.slice(-49),
					JSON.stringify(edited.pattern),
				]);
			}
			enqueue.current(
				[event.detail as ChangeEventDetail],
				event.target instanceof InlangPatternEditor,
			);
		};
		element.addEventListener("change", onChange);
		return () => element.removeEventListener("change", onChange);
	}, []);

	// select and focus a form added elsewhere, once the saved message that contains it is rendered
	const focusedForm = useRef<typeof focusForm>(undefined);
	useEffect(() => {
		if (!focusForm || focusedForm.current === focusForm) return;
		const exists = bundle.messages.some(
			(m) => m.locale === focusForm.locale && m.variants.some((v) => v.id === focusForm.variantId),
		);
		if (!exists) return;
		focusedForm.current = focusForm;
		setSelected((s) => ({ ...s, [focusForm.locale]: focusForm.variantId }));
		focusVariant.current = focusForm.variantId;
	}, [focusForm, bundle]);

	const reference = bundle.messages.find((m) => m.locale === baseLocale);
	const referenceHasText =
		reference?.selectors.length === 0 &&
		reference.variants.length === 1 &&
		!isEmpty(reference.variants[0]);

	return (
		<div className="figma-inlang-editor" ref={root}>
			{locales.map((locale) => {
				const shown =
					bundle.messages.find((m) => m.locale === locale) ??
					drafts.find((m) => m.locale === locale)!;
				const added = adding.filter(
					(v) => v.message_id === shown.id && !shown.variants.some((w) => w.id === v.id),
				);
				const data = added.length ? { ...shown, variants: [...shown.variants, ...added] } : shown;
				const withForms = data.selectors.length > 0 || data.variants.length > 1;
				const variant = data.variants.find((v) => v.id === selected[locale]) ?? data.variants[0];
				return (
					<div className="inlang-row" key={locale} data-locale={locale}>
						<div className="inlang-row-locale">
							<span>{locale}</span>
							{locale === baseLocale && <span className="inlang-ref-tag">ref</span>}
						</div>
						<div className="inlang-row-body">
							{withForms && (
								<MessageForms
									message={data}
									declarations={bundle.declarations}
									referenceVariants={locale === baseLocale ? undefined : reference?.variants}
									selectedVariantId={variant?.id ?? ""}
									onSelect={(variantId) => setSelected((s) => ({ ...s, [locale]: variantId }))}
									onAdd={(matches) => {
										const id = crypto.randomUUID();
										const variant = { id, message_id: data.id, matches, pattern: [] };
										focusVariant.current = id;
										// rendered (and focused) before the click's task ends, so no key typed right after it is lost
										flushSync(() => {
											setAdding((list) => [...list, variant]);
											setSelected((s) => ({ ...s, [locale]: id }));
										});
										enqueue.current(
											[{ entity: "variant", entityId: id, newData: structuredClone(variant) }],
											false,
										);
									}}
								/>
							)}
							{variant &&
								(rich.has(variant.id) ? (
									<RichPreview variant={variant} />
								) : (
									<div className={`inlang-field-row${withForms ? " inlang-field-row--forms" : ""}`}>
										<PatternField
											key={variant.id}
											variant={variant}
											declarations={bundle.declarations}
											label={`${locale} translation`}
											external={external.has(variant.id)}
											fields={fields.current}
										/>
										{/* inside the empty field, so that every field of a message is equally wide */}
										{onTranslate &&
											locale !== baseLocale &&
											!withForms &&
											referenceHasText &&
											isEmpty(variant) && (
												<button
													type="button"
													className="inlang-row-action inlang-row-action--inside"
													onClick={() => void onTranslate(locale)}
													title="Machine translation is available on request"
												>
													Translate from {baseLocale}
												</button>
											)}
										{/* a column of its own in every row of a message with forms (empty when there is nothing to delete) */}
										{withForms && (
											<span className="inlang-row-slot">
												{data.variants.length > 1 && (
													<button
														type="button"
														className="inlang-row-delete"
														aria-label={`Delete this ${locale} form`}
														title="Delete this form"
														onClick={() =>
															enqueue.current(
																[{ entity: "variant", entityId: variant.id, newData: undefined }],
																false,
															)
														}
													>
														<span className="svg-container trash-svg" />
													</button>
												)}
											</span>
										)}
									</div>
								))}
							<TranslationProblems
								problems={problems.get(locale)}
								message={data}
								declarations={bundle.declarations}
								variants={data.variants}
								selectedVariantId={variant?.id}
								onSelect={(variantId) => setSelected((s) => ({ ...s, [locale]: variantId }))}
								onAddExactNumbers={(input, values) => {
									setError(undefined);
									void latest.current
										.onSave(
											bundleToLegacyMessage(
												addExactNumbersOfReference(
													latest.current.stored,
													input,
													values,
													baseLocale,
												),
												true,
											),
											{ undoStep: true },
										)
										.catch((e) => setError(e instanceof Error ? e.message : String(e)));
								}}
							/>
						</div>
					</div>
				);
			})}
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
