import { useEffect, useMemo, useRef, useState } from "react";
import type { Message } from "../../../lib/message/LegacyMessage";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../../../lib/message/store/LegacyMessageBundleConverter";
import {
	addChoiceValue,
	addMessageSelector,
	removeChoiceValue,
	removeMessageSelector,
	selectableInputs,
	selectorChoices,
	type SelectorChoice,
} from "../../../lib/message/editor/Selectors";
import Drawer from "../../compontents/drawer/Drawer";
import "./SelectorDrawer.css";

type Kind = "plural" | "select";

/** The label of an exact number ("=0") or a select value ("female"). */
const valueLabel = (choice: SelectorChoice, value: string) =>
	choice.kind === "Select" ? value : `=${value}`;

/**
 * A small input that adds an exact number / a select value. Enter adds, Escape cancels - handled on
 * the input itself, so the drawer's own Enter (add plural) and Escape (close) do not run.
 */
function ValueInput({
	choice,
	disabled,
	onAdd,
	onCancel,
}: {
	choice: SelectorChoice;
	disabled: boolean;
	onAdd: (value: string) => void;
	onCancel: () => void;
}) {
	const input = useRef<HTMLInputElement>(null);
	const [value, setValue] = useState("");
	const callbacks = useRef({ onAdd, onCancel, value });
	callbacks.current = { onAdd, onCancel, value };
	useEffect(() => {
		const element = input.current!;
		element.focus();
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key !== "Enter" && event.key !== "Escape") return;
			event.stopPropagation();
			event.preventDefault();
			if (event.key === "Escape") callbacks.current.onCancel();
			else if (callbacks.current.value.trim()) callbacks.current.onAdd(callbacks.current.value);
		};
		element.addEventListener("keydown", onKeyDown);
		return () => element.removeEventListener("keydown", onKeyDown);
	}, []);
	const plural = choice.kind !== "Select";
	return (
		<span className="selector-drawer-value-input">
			<input
				ref={input}
				className="link-review-input"
				value={value}
				inputMode={plural ? "decimal" : undefined}
				placeholder={plural ? "e.g. 0" : "e.g. diverse"}
				aria-label={
					plural ? `Exact number of ${choice.variable}` : `New value of ${choice.variable}`
				}
				spellCheck={false}
				onChange={(e) => setValue(e.target.value)}
			/>
			<button
				type="button"
				className="selector-drawer-action"
				disabled={disabled || !value.trim()}
				onClick={() => onAdd(value)}
			>
				Add
			</button>
		</span>
	);
}

/**
 * "Plural & select" of a message: shows what the translations of the message are chosen by (a number,
 * a gender, ...), removes such a choice again and makes the message plural / a select. The selector is
 * added to every language of the message at once.
 */
/**
 * The exact numbers of a plural (=0, =1: a form of their own before the plural categories) or the
 * values of a select (female, male), each with a delete button, and "+ Exact number" / "+ Value".
 */
function ChoiceValues({
	choice,
	busy,
	removing,
	adding,
	onStartAdd,
	onCancelAdd,
	onAdd,
	onStartRemove,
	onCancelRemove,
	onRemove,
}: {
	choice: SelectorChoice;
	busy: boolean;
	/** the value whose removal waits for confirmation */
	removing: string | undefined;
	adding: boolean;
	onStartAdd: () => void;
	onCancelAdd: () => void;
	onAdd: (value: string) => void;
	onStartRemove: (value: string) => void;
	onCancelRemove: () => void;
	onRemove: (value: string) => void;
}) {
	const plural = choice.kind !== "Select";
	if (removing !== undefined)
		return (
			<span className="selector-drawer-values">
				<span className="selector-drawer-confirm">
					Deletes the “{valueLabel(choice, removing)}” form of every language.
				</span>
				<button type="button" className="selector-drawer-action" onClick={onCancelRemove}>
					Cancel
				</button>
				<button
					type="button"
					className="selector-drawer-action selector-drawer-action--danger"
					disabled={busy}
					onClick={() => onRemove(removing)}
				>
					Delete
				</button>
			</span>
		);
	return (
		<span
			className="selector-drawer-values"
			role="group"
			aria-label={plural ? `Exact numbers of ${choice.variable}` : `Values of ${choice.variable}`}
		>
			{choice.values.map((value) => (
				<span key={value} className="selector-drawer-value">
					{valueLabel(choice, value)}
					<button
						type="button"
						className="selector-drawer-value-remove"
						aria-label={`Delete the ${valueLabel(choice, value)} form`}
						title="Delete this form in every language"
						disabled={busy}
						onClick={() => onStartRemove(value)}
					>
						<span aria-hidden="true">×</span>
					</button>
				</span>
			))}
			{adding ? (
				<ValueInput choice={choice} disabled={busy} onAdd={onAdd} onCancel={onCancelAdd} />
			) : (
				<button
					type="button"
					className="selector-drawer-action selector-drawer-add-value"
					title={
						plural
							? "A form of its own for one number, e.g. =0 “No items”, in every language"
							: "One more value with a form of its own, in every language"
					}
					onClick={onStartAdd}
				>
					{plural ? "+ Exact number" : "+ Value"}
				</button>
			)}
		</span>
	);
}

export default function SelectorDrawer({
	message,
	baseLocale,
	onSave,
	onClose,
	onFormAdded,
}: {
	message: Message;
	baseLocale: string;
	/**
	 * Saves a change of the message. The change is applied to the message as it is when it is saved
	 * (with text typed just before that is still being saved), not to the message the drawer shows.
	 */
	onSave: (change: (message: Message) => Message) => Promise<unknown>;
	onClose: () => void;
	/** a form was added to the reference language: the editor selects it so that it can be typed right away */
	onFormAdded?: (locale: string, variantId: string) => void;
}) {
	const loaded = useMemo(() => {
		try {
			return { bundle: legacyMessageToBundle(message) };
		} catch (e) {
			return { error: e instanceof Error ? e.message : String(e) };
		}
	}, [message]);
	const bundle = loaded.bundle;
	const choices = bundle ? selectorChoices(bundle, baseLocale) : [];
	const inputs = bundle ? selectableInputs(bundle, baseLocale) : [];

	const [variable, setVariable] = useState<string>();
	const [kind, setKind] = useState<Kind>("plural");
	const [values, setValues] = useState("");
	const [removing, setRemoving] = useState<SelectorChoice>();
	// the exact number / select value whose forms are about to be deleted, and the choice being added to
	const [removingValue, setRemovingValue] = useState<{ names: string; value: string }>();
	const [adding, setAdding] = useState<string>();
	const [error, setError] = useState<string>();
	const [busy, setBusy] = useState(false);

	const chosen = variable !== undefined && inputs.includes(variable) ? variable : inputs[0];
	const selectValues = values
		.split(",")
		.map((value) => value.trim())
		.filter(Boolean);
	const canAdd = chosen !== undefined && !busy;

	async function apply(
		change: (bundle: NonNullable<typeof loaded.bundle>) => NonNullable<typeof loaded.bundle>,
		/** removing exact numbers and select values one after the other: the drawer stays open */
		close = true,
	): Promise<boolean> {
		if (!bundle) return false;
		setBusy(true);
		setError(undefined);
		try {
			await onSave((saved) => bundleToLegacyMessage(change(legacyMessageToBundle(saved)), true));
			if (close) {
				onClose();
				return true;
			}
			setAdding(undefined);
			setRemovingValue(undefined);
			setBusy(false);
			return true;
		} catch (e) {
			setError(e instanceof Error ? e.message : String(e));
			setBusy(false);
			return false;
		}
	}

	/** an exact number / select value: the new (empty) reference form is typed next, the drawer closes */
	async function addValue(choice: SelectorChoice, value: string) {
		let variantId: string | undefined;
		const saved = await apply((current) => {
			const result = addChoiceValue(current, choice, value, baseLocale);
			variantId = result.variantId;
			return result.bundle;
		});
		if (saved && variantId) onFormAdded?.(baseLocale, variantId);
	}

	const add = () =>
		canAdd &&
		void apply((current) =>
			addMessageSelector(
				current,
				{
					variable: chosen,
					kind,
					values: kind === "select" ? selectValues : undefined,
				},
				baseLocale,
			),
		);

	return (
		<Drawer
			position="top"
			className="selector-drawer"
			shown
			onCancel={onClose}
			buttons={[
				{ type: "secondary", text: "Close", key: "escape", callback: onClose },
				...(inputs.length > 0
					? [
							{
								type: "primary" as const,
								text: kind === "plural" ? "Add plural" : "Add select",
								key: "enter" as const,
								disabled: !canAdd || !!removing,
								callback: add,
							},
						]
					: []),
			]}
		>
			<div className="drawer-header">Plural &amp; select · {message.id}</div>
			<div className="drawer-body selector-drawer-body">
				{loaded.error && <p role="alert">{loaded.error}</p>}
				{bundle && (
					<>
						{choices.length > 0 && (
							<ul className="selector-drawer-list" aria-label="Current choices">
								{choices.map((choice) => (
									<li key={choice.names.join()} className="selector-drawer-item">
										<span className="selector-drawer-variable">{choice.variable}</span>
										<span className="selector-drawer-kind">{choice.kind}</span>
										{removing?.names.join() === choice.names.join() ? (
											<>
												<span className="selector-drawer-confirm">
													Keeps the “other” form of every language, deletes the rest.
												</span>
												<button
													type="button"
													className="selector-drawer-action"
													onClick={() => setRemoving(undefined)}
												>
													Cancel
												</button>
												<button
													type="button"
													className="selector-drawer-action selector-drawer-action--danger"
													disabled={busy}
													onClick={() =>
														void apply((current) => removeMessageSelector(current, choice))
													}
												>
													Remove
												</button>
											</>
										) : (
											<button
												type="button"
												className="selector-drawer-action selector-drawer-action--danger selector-drawer-remove"
												aria-label={`Remove ${choice.kind.toLowerCase()} on ${choice.variable}`}
												onClick={() => setRemoving(choice)}
											>
												Remove
											</button>
										)}
										<ChoiceValues
											choice={choice}
											busy={busy}
											removing={
												removingValue?.names === choice.names.join()
													? removingValue.value
													: undefined
											}
											adding={adding === choice.names.join()}
											onStartAdd={() => {
												setRemovingValue(undefined);
												setError(undefined);
												setAdding(choice.names.join());
											}}
											onCancelAdd={() => {
												setAdding(undefined);
												setError(undefined);
											}}
											onAdd={(value) => void addValue(choice, value)}
											onStartRemove={(value) => {
												setAdding(undefined);
												setRemovingValue({ names: choice.names.join(), value });
											}}
											onCancelRemove={() => setRemovingValue(undefined)}
											onRemove={(value) =>
												void apply((current) => removeChoiceValue(current, choice, value), false)
											}
										/>
									</li>
								))}
							</ul>
						)}
						{inputs.length === 0 ? (
							<p>
								{choices.length > 0
									? "Every variable of this message is used already."
									: "This message has no variable yet. Type one into the text, e.g. {count}, then make it plural."}
							</p>
						) : (
							<div className="selector-drawer-add">
								<p>
									{kind === "plural"
										? "Plural: a form for every plural category of each language (one, other, …)."
										: "Select: a form for each value of the variable (e.g. female, male)."}
								</p>
								<label className="selector-drawer-field">
									<span>Variable</span>
									<select
										className="link-review-input"
										value={chosen}
										onChange={(e) => setVariable(e.target.value)}
									>
										{inputs.map((name) => (
											<option key={name} value={name}>
												{name}
											</option>
										))}
									</select>
								</label>
								<div className="selector-drawer-field">
									<span>Type</span>
									<div className="selector-drawer-kinds" role="group" aria-label="Type">
										{(["plural", "select"] as const).map((value) => (
											<button
												key={value}
												type="button"
												aria-pressed={kind === value}
												className={kind === value ? "selected" : ""}
												onClick={() => setKind(value)}
											>
												{value === "plural" ? "Plural" : "Select"}
											</button>
										))}
									</div>
								</div>
								{kind === "select" && (
									<label className="selector-drawer-field">
										<span>Values</span>
										<input
											className="link-review-input"
											value={values}
											placeholder="female, male"
											spellCheck={false}
											onChange={(e) => setValues(e.target.value)}
										/>
									</label>
								)}
							</div>
						)}
					</>
				)}
				{error && <p role="alert">{error}</p>}
			</div>
		</Drawer>
	);
}
