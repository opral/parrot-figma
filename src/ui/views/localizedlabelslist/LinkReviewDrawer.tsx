import * as React from "react";
import { ReactNode, useEffect, useState } from "react";
import Drawer from "../../compontents/drawer/Drawer";
import { UILocalizedLabel } from "../../../lib/localizedlabels/UILocalizedLabel";
import { findKeyConflicts, isValidMessageKey } from "../../../lib/localizedlabels/LinkSuggestions";

export type LinkReviewRow = {
	label: UILocalizedLabel;
	/** the proposed key - "" if the user has to choose one of `keyOptions` */
	key: string;
	/** several messages have this text: the user picks one */
	keyOptions?: string[];
	/** the key is an existing message (the layer is linked to it, nothing is created) */
	existing: boolean;
	/** the key can be edited (new keys) */
	editable: boolean;
};

type LinkReviewDrawerProps = {
	shown: boolean;
	title: string;
	description: ReactNode;
	rows: LinkReviewRow[];
	/** show the frame of each layer (rows from several frames) */
	showFrame: boolean;
	existingKeys: ReadonlySet<string>;
	onConfirm: (links: { label: UILocalizedLabel; messageName: string }[]) => Promise<void>;
	onCancel: () => void;
};

/** Review proposed links of text layers to messages before they are made - a table of layer, key. */
export default function LinkReviewDrawer({
	shown,
	title,
	description,
	rows,
	showFrame,
	existingKeys,
	onConfirm,
	onCancel,
}: LinkReviewDrawerProps) {
	const [keys, setKeys] = useState<string[]>([]);
	const [checked, setChecked] = useState<boolean[]>([]);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		setKeys(rows.map((row) => row.key));
		// a row without a key (ambiguous text) is only linked once the user picked a message
		setChecked(rows.map((row) => row.key !== ""));
		setBusy(false);
	}, [rows]);

	const checkedCount = checked.filter(Boolean).length;
	// rows without a key (ambiguous text) cannot be selected before a message is chosen
	const selectableCount = rows.filter((_, i) => keys[i] !== "").length;
	const invalidKey = rows.map((_, i) => checked[i] && !isValidMessageKey(keys[i] ?? ""));
	// new messages: two different texts must not get the same key
	const creating = rows
		.map((row, i) => ({ row, i }))
		.filter(({ row, i }) => checked[i] && row.editable && !existingKeys.has(keys[i] ?? ""));
	const conflict = rows.map(() => false);
	findKeyConflicts(
		creating.map(({ row, i }) => ({ key: keys[i] ?? "", characters: row.label.characters })),
	).forEach((isConflict, n) => {
		conflict[creating[n].i] = isConflict;
	});
	const invalid = rows.map((_, i) => invalidKey[i] || conflict[i]);
	const canConfirm = checkedCount > 0 && !invalid.some(Boolean) && !busy;

	async function confirm() {
		if (!canConfirm) return;
		setBusy(true);
		try {
			await onConfirm(
				rows
					.map((row, i) => ({ label: row.label, messageName: keys[i], include: checked[i] }))
					.filter((link) => link.include)
					.map(({ label, messageName }) => ({ label, messageName })),
			);
		} finally {
			setBusy(false);
		}
	}

	const layers = (count: number) => (count === 1 ? "1 layer" : `${count} layers`);

	return (
		<Drawer
			className="link-review-drawer"
			position="top"
			shown={shown}
			buttons={[
				{ type: "secondary", text: "Cancel", key: "escape", disabled: busy, callback: onCancel },
				{
					type: "primary",
					text: busy ? "Linking…" : `Link ${layers(checkedCount)}`,
					key: "enter",
					disabled: !canConfirm,
					callback: confirm,
				},
			]}
		>
			<div className="drawer-header">{title}</div>
			<div className="drawer-body">
				<p>{description}</p>
				<div className="link-review-table" role="table">
					<div className="link-review-row link-review-head" role="row">
						<label className="link-review-check" role="columnheader">
							<input
								type="checkbox"
								aria-label="Select all"
								ref={(input) => {
									if (input)
										input.indeterminate = checkedCount > 0 && checkedCount < selectableCount;
								}}
								checked={checkedCount > 0 && checkedCount === selectableCount}
								onChange={(e) => setChecked(rows.map((_, i) => e.target.checked && keys[i] !== ""))}
							/>
						</label>
						<span role="columnheader">Text</span>
						<span role="columnheader">Message key</span>
					</div>
					{rows.map((row, i) => {
						const key = keys[i] ?? "";
						const linksExisting =
							row.existing || (row.editable && key !== row.key && existingKeys.has(key));
						return (
							<div
								className={`link-review-row${checked[i] ? "" : " link-review-row--off"}`}
								role="row"
								key={row.label.nodeId}
							>
								<label className="link-review-check">
									<input
										type="checkbox"
										aria-label={`Link “${row.label.characters}”`}
										checked={checked[i] ?? false}
										disabled={key === ""}
										onChange={(e) =>
											setChecked((values) =>
												values.map((value, j) => (j === i ? e.target.checked : value)),
											)
										}
									/>
								</label>
								<span className="link-review-text" title={row.label.characters}>
									<span className="link-review-label">
										{row.label.characters.replace(/\s+/g, " ").trim()}
									</span>
									{showFrame && (
										<span className="link-review-frame">{row.label.rootFrameName}</span>
									)}
								</span>
								<span className="link-review-key">
									{row.keyOptions && row.keyOptions.length > 1 ? (
										<select
											className="link-review-input"
											value={key}
											aria-label="Message"
											onChange={(e) => {
												const value = e.target.value;
												setKeys((values) => values.map((v, j) => (j === i ? value : v)));
												setChecked((values) => values.map((v, j) => (j === i ? value !== "" : v)));
											}}
										>
											<option value="">Choose a message…</option>
											{row.keyOptions.map((option) => (
												<option key={option} value={option}>
													{option}
												</option>
											))}
										</select>
									) : row.editable ? (
										<input
											className={`link-review-input${invalid[i] ? " link-review-input--invalid" : ""}`}
											value={key}
											spellCheck={false}
											aria-label="Message key"
											aria-invalid={invalid[i]}
											onChange={(e) => {
												const value = e.target.value.replace(/ /g, "_");
												setKeys((values) => values.map((v, j) => (j === i ? value : v)));
											}}
										/>
									) : (
										<span className="link-review-static" title={key}>
											{key}
										</span>
									)}
									{linksExisting && (
										<span
											className="link-review-tag"
											data-tooltip-content="A message with this key exists - the layer is linked to it"
										>
											existing
										</span>
									)}
								</span>
							</div>
						);
					})}
				</div>
				{invalidKey.some(Boolean) ? (
					<p className="link-review-error" role="alert">
						Keys can contain letters, digits, “.”, “_” and “-” and must end with a letter or digit.
					</p>
				) : (
					conflict.some(Boolean) && (
						<p className="link-review-error" role="alert">
							Different texts need different keys.
						</p>
					)
				)}
			</div>
		</Drawer>
	);
}
