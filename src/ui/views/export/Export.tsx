import * as React from "react";
import { useEffect, useState } from "react";
import Select from "../../compontents/select/select";
import { Locale, languageDisplayName } from "../../../lib/message/variants/Locale";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import "./Export.css";
import "../transfer/TransferPanel.css";

import {
	translationFormats as formats,
	translationPlugins,
} from "../../../lib/transfer/TranslationFormats";
import { exportWithPlugin, type SkippedMessage } from "../../../lib/transfer/ExportWithPlugin";
import { capture } from "../../../lib/telemetry/Telemetry";
import type FigmaUtil from "../../../shared/FigmaUtil";
import { useTransferFormat } from "../transfer/useTransferFormat";

export default function Export({
	labelManager,
	figmaRemote,
}: {
	labelManager: LocalizedLabelManagerUI;
	figmaRemote?: FigmaUtil;
}) {
	const store = labelManager.messageStore;
	const [format, setFormat, formatLoaded] = useTransferFormat(figmaRemote);
	const [messages, setMessages] = useState(store.getAllMessages() ?? []);
	const [notice, setNotice] = useState<string>();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string>();
	// messages the last export left out because the format cannot hold them
	const [skipped, setSkipped] = useState<SkippedMessage[]>([]);
	const baseLanguage = store.getRefLanugage();
	const languages = store.getOrderedLanguages();
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
		setSkipped([]);
		let fileUrl: string | undefined;
		let link: HTMLAnchorElement | undefined;
		try {
			const selectedPlugin = translationPlugins.find(({ plugin }) => plugin.key === format);
			if (!selectedPlugin) throw new Error("Choose a supported export format.");
			const file = await exportWithPlugin(
				selectedPlugin.plugin,
				store.getAllMessages() ?? [],
				language,
				baseLanguage,
			);
			if (!file) throw new Error("Choose a supported export format.");
			fileUrl = URL.createObjectURL(new Blob([file.content], { type: file.fileType }));
			link = document.createElement("a");
			link.href = fileUrl;
			link.download = file.fileName;
			document.body.appendChild(link);
			link.click();
			setNotice(
				file.skipped.length === 0
					? `Download started: ${file.fileName}`
					: `Download started: ${file.fileName}. ${
							file.skipped.length === 1
								? "1 message was left out"
								: `${file.skipped.length} messages were left out`
						} because ${selectedPlugin.label} cannot hold ${file.skipped.length === 1 ? "it" : "them"}:`,
			);
			setSkipped(file.skipped);
			capture("export:file_create", {
				format,
				message_count: store.getAllMessages()?.length ?? 0,
			});
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
				{formatLoaded && (
					<Select
						key={format}
						checkmark
						placeholder="Choose format"
						isDisabled={busy}
						getOptions={() => formats}
						defaultValue={formats.find((option) => option.value === format)}
						onChange={(option) => setFormat(String(option.value))}
					/>
				)}
			</div>
			<p className="transfer-help">Choose a format, then export a file for its language.</p>
			<div className="transfer-languages">
				{languages.map((language) => {
					// messages with text in this language (an empty translation is missing, as in Messages)
					const count = store.countTranslated(language);
					return (
						<div className="transfer-language-row" key={language}>
							<div>
								<div className="transfer-language-name">
									{languageDisplayName(language)} · {language}
								</div>
								<div className="transfer-language-detail">
									{language === baseLanguage ? "Reference · " : ""}
									{count} of {messages.length} {messages.length === 1 ? "message" : "messages"}
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
			{skipped.length > 0 && (
				<ul className="transfer-skipped" aria-label="Messages left out of the export">
					{skipped.map(({ id, reason }) => (
						<li key={id}>
							<b>{id}</b>: {reason}
						</li>
					))}
				</ul>
			)}
			{error && <p role="alert">{error}</p>}
		</div>
	);
}
