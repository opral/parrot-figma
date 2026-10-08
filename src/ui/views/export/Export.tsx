import * as React from "react";
import { useEffect, useState } from "react";
import Select from "../../compontents/select/select";
import { Locale } from "../../../lib/message/variants/Locale";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import "./Export.css";
import "../transfer/TransferPanel.css";

import {
	translationFormats as formats,
	translationPlugins,
} from "../../../lib/transfer/TranslationFormats";
import { exportWithPlugin } from "../../../lib/transfer/ExportWithPlugin";

export default function Export({ labelManager }: { labelManager: LocalizedLabelManagerUI }) {
	const store = labelManager.messageStore;
	const [format, setFormat] = useState(formats[0].value);
	const [messages, setMessages] = useState(store.getAllMessages() ?? []);
	const [notice, setNotice] = useState<string>();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	const baseLanguage = store.getRefLanugage();
	const languages = [...new Set([baseLanguage, ...store.getLanugages()!])].filter(
		(language): language is Locale => language !== undefined,
	);
	useEffect(() => {
		const update = () => setMessages(store.getAllMessages() ?? []);
		store.addEventListener("updated", update);
		return () => store.removeEventListener("updated", update);
	}, [store]);
	const download = async (language: Locale) => {
		if (busy) return;
		setBusy(true);
		setError(undefined);
		setNotice(undefined);
		let fileUrl: string | undefined;
		let link: HTMLAnchorElement | undefined;
		try {
			const selectedPlugin = translationPlugins.find(({ plugin }) => plugin.key === format);
			if (!selectedPlugin) throw new Error("Choose a supported export format.");
			const file = await exportWithPlugin(
				selectedPlugin.plugin,
				store.getAllMessages() ?? [],
				language,
			);
			if (!file) throw new Error("Choose a supported export format.");
			fileUrl = URL.createObjectURL(new Blob([file.content], { type: file.fileType }));
			link = document.createElement("a");
			link.href = fileUrl;
			link.download = file.fileName;
			document.body.appendChild(link);
			link.click();
			setNotice(`Download started: ${file.fileName}`);
		} catch (failure) {
			setError(failure instanceof Error ? failure.message : String(failure));
		} finally {
			setBusy(false);
			link?.remove();
			// Allow the browser to consume the download before releasing its object URL.
			if (fileUrl) {
				const url = fileUrl;
				window.setTimeout(() => URL.revokeObjectURL(url), 1000);
			}
		}
	};
	return (
		<div className="transfer-view">
			<div className="transfer-format">
				<span>Format</span>
				<Select
					checkmark
					placeholder="Choose format"
					isDisabled={busy}
					getOptions={() => formats}
					defaultValue={formats.find((option) => option.value === format)}
					onChange={(option) => setFormat(String(option.value))}
				/>
			</div>
			<p className="transfer-help">Choose a format, then export a file for its language.</p>
			<div className="transfer-languages">
				{languages.map((language) => {
					const count = messages.filter((message) =>
						message.variants.some((variant) => variant.languageTag === language),
					).length;
					return (
						<div className="transfer-language-row" key={language}>
							<div>
								<div className="transfer-language-name">
									{new Intl.DisplayNames("en", { type: "language" }).of(language)} · {language}
								</div>
								<div className="transfer-language-detail">
									{language === baseLanguage ? "Reference · " : ""}
									{count} {count === 1 ? "message" : "messages"}
								</div>
							</div>
							<button
								type="button"
								className="transfer-action"
								disabled={busy || count === 0}
								onClick={() => download(language)}
								aria-label={`Export file for ${language}`}
							>
								Export file
							</button>
						</div>
					);
				})}
			</div>
			{!languages.length && (
				<p className="transfer-help">Choose your languages in Setup before exporting.</p>
			)}
			<p className="transfer-help transfer-footer">
				Download translations for your project, one language at a time.
			</p>
			{notice && <p role="status">{notice}</p>}
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
