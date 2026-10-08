import * as React from "react";
import { useEffect, useState } from "react";
import type { Message, Variant } from "../../../lib/message/LegacyMessage";
import { Locale } from "../../../lib/message/variants/Locale";
import FileSelect from "../../compontents/fileselect/FileSelect";
import Select from "../../compontents/select/select";
import MessageImporter, { ImportResult, ImportType } from "../../../lib/import/MessageImporter";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import Drawer from "../../compontents/drawer/Drawer";
import { importPlugins, importWithPlugin } from "../../../lib/import/InlangPluginImporter";
import "../transfer/TransferPanel.css";
import { translationFormats } from "../../../lib/transfer/TranslationFormats";

export default function ImportView({ labelManager }: { labelManager: LocalizedLabelManagerUI }) {
	const [importFormat, setImportFormat] = useState(importPlugins[0].plugin.key);
	const [importBusy, setImportBusy] = useState(false);
	const [importError, setImportError] = useState<string>();
	const [importNotice, setImportNotice] = useState<string>();
	const [importResult, setImportResult] = useState(undefined as ImportResult | undefined);

	const [importKeysByState, setimportKeysByState] = useState<
		| {
				language: Locale;
				newMessages: Message[];
				newVariants: { message: Message; variant: Variant }[];
				updatedVariants: { message: Message; variant: Variant }[];
		  }
		| undefined
	>(undefined);

	const [keySummary, setKeySummary] = useState(labelManager.messageStore.getAllMessages() ?? []);

	useEffect(() => {
		const updateSummary = () => {
			setKeySummary(labelManager.messageStore.getAllMessages() ?? []);
		};

		labelManager.messageStore.addEventListener("updated", updateSummary);

		return () => {
			labelManager.messageStore.removeEventListener("updated", updateSummary);
		};
	}, [labelManager]);

	const previewImport = async (files: Record<string, string>, language: Locale) => {
		setImportBusy(true);
		setImportError(undefined);
		setImportNotice(undefined);
		setimportKeysByState(undefined);
		try {
			const entry = Object.entries(files)[0];
			if (!entry) return;
			const [fileName, content] = entry;
			const selectedPlugin = importPlugins.find(({ plugin }) => plugin.key === importFormat);
			if (!selectedPlugin) throw new Error("Choose a supported import format.");
			const result: ImportResult = {
				fileName,
				language,
				type: ImportType.INLANG_PLUGIN,
				formatName: selectedPlugin.label,
				messages: await importWithPlugin({
					plugin: selectedPlugin.plugin,
					fileName,
					content,
					locale: language,
				}),
			};
			if (!result.messages)
				throw new Error("This format is not supported. Choose the matching import format.");
			const stats = MessageImporter.getImportStatistics(
				labelManager.messageStore,
				result.messages,
				language,
			);
			setImportResult(result);
			setimportKeysByState(stats);
		} catch (error) {
			setImportResult(undefined);
			setImportError(error instanceof Error ? error.message : String(error));
		} finally {
			setImportBusy(false);
		}
	};

	const applyImport = async () => {
		if (!importResult?.messages || importBusy) return;
		setImportBusy(true);
		setImportError(undefined);
		try {
			await labelManager.import(importResult.messages, importResult.language);
			setImportNotice(
				`Imported ${importResult.messages.length} keys for ${importResult.language}.`,
			);
			setImportResult(undefined);
			setimportKeysByState(undefined);
		} catch (error) {
			setImportError(
				`Import stopped: ${error instanceof Error ? error.message : String(error)}. Some changes may already be saved.`,
			);
		} finally {
			setImportBusy(false);
		}
	};

	const baseLanguage = labelManager.messageStore.getRefLanugage();
	const languages = [
		...new Set([baseLanguage, ...labelManager.messageStore.getLanugages()!]),
	].filter((language): language is Locale => language !== undefined);
	const formats = translationFormats;
	return (
		<div className="transfer-view">
			<div className="transfer-format">
				<span>Format</span>
				<Select
					checkmark
					placeholder="Choose format"
					getOptions={() => formats}
					defaultValue={formats.find((format) => format.value === importFormat)}
					isDisabled={importBusy}
					onChange={(option) => setImportFormat(String(option.value))}
				/>
			</div>
			<p className="transfer-help">Choose a format, then import a file for its language.</p>
			<div className="transfer-languages">
				{languages.map((language) => {
					const count = keySummary.filter((message) =>
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
							<div className="transfer-file-action">
								<FileSelect
									text="Import file"
									disabled={importBusy}
									onFilesReceived={(files) => previewImport(files, language)}
									onError={(error) => setImportError(error.message)}
								/>
							</div>
						</div>
					);
				})}
			</div>
			{!languages.length && (
				<p className="transfer-help">Choose your languages in Setup before importing.</p>
			)}
			<p className="transfer-help transfer-footer">Review new and updated keys before saving.</p>
			{importBusy && !importResult && <p role="status">Reading translations…</p>}
			{importError && <p role="alert">{importError}</p>}
			{importNotice && <p role="status">{importNotice}</p>}
			<Drawer
				position="top"
				buttons={[
					{
						type: "secondary",
						text: "Cancel",
						disabled: importBusy,
						key: "escape",
						callback: () => {
							// set back to head
							if (!importBusy) setImportResult(undefined);
						},
					},
					{
						type: "primary",
						text: importBusy ? "Importing…" : "Import Keys",
						key: "enter",
						disabled: importBusy || !importResult?.messages,
						callback: applyImport,
					},
				]}
				shown={importResult !== undefined}
			>
				<div className="history_view--topHeader">Import keys</div>
				<div>
					{importResult && importResult.type === ImportType.UNSUPPORTED && (
						<div>
							File Type currently not supported.
							<br /> Supported are l18next Json Files, Apple's
							<b>.stringsdict</b>,<b>.strings</b> and Android's <b>.xml</b> file.{" "}
						</div>
					)}

					{importResult && importResult.type !== ImportType.UNSUPPORTED && importKeysByState && (
						<div>
							Detected Format: {importResult.formatName ?? importResult.type}
							<br />
							Filename: {importResult.fileName}
							<br />
							Language: {importKeysByState.language}
							<br />
							New Keys: {importKeysByState.newMessages.length}
							<br />
							New messages: {importKeysByState.newVariants.length}
							<br />
							Updated messages: {importKeysByState.updatedVariants.length}
							<br />
							<p>Existing translations in this language will be replaced where the keys match.</p>
							<ul>
								{importResult.messages!.slice(0, 10).map((message) => (
									<li key={message.id}>{message.id}</li>
								))}
							</ul>
							{importResult.messages!.length > 10 && (
								<p>And {importResult.messages!.length - 10} more keys.</p>
							)}
						</div>
					)}
				</div>
			</Drawer>
		</div>
	);
}
