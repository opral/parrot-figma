import * as React from "react";
import { useEffect, useState } from "react";
import type { Message, Variant } from "../../../lib/message/LegacyMessage";
import { Locale, languageDisplayName } from "../../../lib/message/variants/Locale";
import FileSelect from "../../compontents/fileselect/FileSelect";
import Select from "../../compontents/select/select";
import MessageImporter, { ImportResult, ImportType } from "../../../lib/import/MessageImporter";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import Drawer from "../../compontents/drawer/Drawer";
import { importPlugins, importWithPlugin } from "../../../lib/import/InlangPluginImporter";
import "../transfer/TransferPanel.css";
import { translationFormats } from "../../../lib/transfer/TranslationFormats";
import i18nextPlugin from "@inlang/plugin-i18next";
import type FigmaUtil from "../../../shared/FigmaUtil";
import { useTransferFormat } from "../transfer/useTransferFormat";
import {
	buildMessageTextIndex,
	matchLayersToMessages,
} from "../../../lib/localizedlabels/LinkSuggestions";
import LinkReviewDrawer, { LinkReviewRow } from "../localizedlabelslist/LinkReviewDrawer";

const i18nextPluginKey = i18nextPlugin.key;

// {{variable}} placeholders and key_one/key_other plurals only exist in i18next JSON files
function looksLikeI18next(content: string) {
	return (
		/\{\{[^{}\s]+\}\}/.test(content) || /"[^"]+_(?:zero|one|two|few|many|other)"\s*:/.test(content)
	);
}

export default function ImportView({
	labelManager,
	figmaRemote,
}: {
	labelManager: LocalizedLabelManagerUI;
	figmaRemote?: FigmaUtil;
}) {
	// the format used last in this file (shared with Export) - not every file is "inlang JSON"
	const [importFormat, setImportFormat, formatLoaded] = useTransferFormat(figmaRemote);
	// the file of the open review: lets the warning below re-read it with the suggested format
	const [pendingFile, setPendingFile] = useState<{
		files: Record<string, string>;
		language: Locale;
	}>();
	const [importBusy, setImportBusy] = useState(false);
	const [importError, setImportError] = useState<string>();
	const [importNotice, setImportNotice] = useState<string>();
	const [importWarning, setImportWarning] = useState<string>();
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

	// layers on the current page with exactly the text of a message - offered for linking
	const [linkReview, setLinkReview] = useState<
		{ title: string; description: string; rows: LinkReviewRow[] } | undefined
	>();
	const [searchingLayers, setSearchingLayers] = useState(false);

	const findLayersToLink = async (importedMessageIds?: Set<string>) => {
		setSearchingLayers(true);
		try {
			const messages = labelManager.messageStore.getAllMessages() ?? [];
			const index = buildMessageTextIndex(
				importedMessageIds
					? messages.filter((message) => importedMessageIds.has(message.id))
					: messages,
				labelManager.messageStore.getOrderedLanguages(),
			);
			// only layers with one of these texts are read from the page - reading every layer is slow
			const texts = [...new Set([...index.values()].flatMap((byText) => [...byText.keys()]))];
			const labels = texts.length === 0 ? [] : await labelManager.getLinkableLabelsOnPage(texts);
			const layers = labels.map((label) => ({
				nodeId: label.nodeId,
				characters: label.characters,
				language: label.language,
				layerName: label.name,
				frameName: label.rootFrameName,
			}));
			const labelsById = new Map(labels.map((label) => [label.nodeId, label]));
			const matches = matchLayersToMessages(layers, index, importedMessageIds);
			if (matches.length === 0) {
				if (!importedMessageIds) {
					setImportNotice("No unlinked text layer on this page has the text of a message.");
				}
				return;
			}
			const rows = matches
				.map(({ layer, messageIds }) => ({
					label: labelsById.get(layer.nodeId)!,
					key: messageIds.length === 1 ? messageIds[0] : "",
					keyOptions: messageIds.length > 1 ? messageIds : undefined,
					existing: false,
					editable: false,
				}))
				.sort(
					(a, b) =>
						(a.label.rootFrameName ?? "").localeCompare(b.label.rootFrameName ?? "") ||
						a.label.y - b.label.y ||
						a.label.x - b.label.x,
				);
			setLinkReview({
				title: importedMessageIds
					? "Link layers to the imported messages?"
					: "Link layers to existing messages?",
				description:
					rows.length === 1
						? "This unlinked text layer on this page has exactly the text of a message."
						: `These ${rows.length} unlinked text layers on this page have exactly the text of a message. Where several messages have the same text, choose one.`,
				rows,
			});
		} catch (error) {
			setImportError(
				`Could not look for matching layers: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setSearchingLayers(false);
		}
	};

	useEffect(() => {
		const updateSummary = () => {
			setKeySummary(labelManager.messageStore.getAllMessages() ?? []);
		};

		labelManager.messageStore.addEventListener("updated", updateSummary);

		return () => {
			labelManager.messageStore.removeEventListener("updated", updateSummary);
		};
	}, [labelManager]);

	const previewImport = async (
		files: Record<string, string>,
		language: Locale,
		formatKey: string = importFormat,
	) => {
		setPendingFile({ files, language });
		setImportBusy(true);
		setImportError(undefined);
		setImportNotice(undefined);
		setImportWarning(undefined);
		setimportKeysByState(undefined);
		const selectedPlugin = importPlugins.find(({ plugin }) => plugin.key === formatKey);
		try {
			const entry = Object.entries(files)[0];
			if (!entry) return;
			const [fileName, content] = entry;
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
			setImportWarning(
				selectedPlugin.plugin.key !== i18nextPluginKey && looksLikeI18next(content)
					? 'This file looks like i18next JSON ({{variables}} or _one/_other plurals). With this format placeholders and plurals are not read correctly - e.g. {{name}} becomes a variable named "{name". Read it as i18next JSON, or cancel if it is not.'
					: undefined,
			);
		} catch (error) {
			setImportResult(undefined);
			const reason = error instanceof Error ? error.message : String(error);
			// parse errors usually mean "wrong format selected" - say so, the raw parser message is cryptic
			const formatHint = /no translations for|conflicting variable/.test(reason)
				? ""
				: `. Is "${selectedPlugin?.label ?? formatKey}" the right format for this file?`;
			setImportError(`${reason}${formatHint}`);
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
			// closes the undo step: linking layers afterwards is an undo step of its own
			await labelManager.commitUndo();
			setImportNotice(
				`Imported ${importResult.messages.length === 1 ? "1 key" : `${importResult.messages.length} keys`} for ${importResult.language}.`,
			);
			const importedMessageIds = new Set(importResult.messages.map((message) => message.id));
			setImportResult(undefined);
			setimportKeysByState(undefined);
			void findLayersToLink(importedMessageIds);
		} catch (error) {
			setImportError(
				`Import stopped: ${error instanceof Error ? error.message : String(error)}. Some changes may already be saved.`,
			);
		} finally {
			setImportBusy(false);
		}
	};

	const baseLanguage = labelManager.messageStore.getRefLanugage();
	const languages = labelManager.messageStore.getOrderedLanguages();
	const formats = translationFormats;
	return (
		<div className="transfer-view">
			<div className="transfer-format">
				<span>Format</span>
				{formatLoaded && (
					<Select
						key={importFormat}
						checkmark
						placeholder="Choose format"
						getOptions={() => formats}
						defaultValue={formats.find((format) => format.value === importFormat)}
						isDisabled={importBusy}
						onChange={(option) => setImportFormat(String(option.value))}
					/>
				)}
			</div>
			<p className="transfer-help">Choose a format, then import a file for its language.</p>
			<div className="transfer-languages">
				{languages.map((language) => {
					// messages that have text in this language, out of all messages (the number Setup shows)
					const count = keySummary.filter((message) =>
						message.variants.some((variant) => variant.languageTag === language),
					).length;
					return (
						<div className="transfer-language-row" key={language}>
							<div>
								<div className="transfer-language-name">
									{languageDisplayName(language)} · {language}
								</div>
								<div className="transfer-language-detail">
									{language === baseLanguage ? "Reference · " : ""}
									{count} of {keySummary.length} {keySummary.length === 1 ? "message" : "messages"}
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
			<div className="transfer-link-layers">
				<span className="transfer-help">
					Text layers that already show a message text can be linked to it in one step.
				</span>
				<button
					type="button"
					className="transfer-action"
					disabled={importBusy || searchingLayers}
					onClick={() => void findLayersToLink()}
				>
					{searchingLayers ? "Looking for layers…" : "Link matching layers on this page"}
				</button>
			</div>
			<LinkReviewDrawer
				shown={linkReview !== undefined}
				title={linkReview?.title ?? ""}
				description={linkReview?.description ?? ""}
				rows={linkReview?.rows ?? []}
				showFrame
				existingKeys={new Set(keySummary.map((message) => message.id))}
				onCancel={() => setLinkReview(undefined)}
				onConfirm={async (links) => {
					try {
						await labelManager.linkLabelsToMessages(links);
						setLinkReview(undefined);
						setImportNotice(
							links.length === 1
								? "Linked 1 layer to its message."
								: `Linked ${links.length} layers to their messages.`,
						);
					} catch (error) {
						setImportError(
							`Could not link the layers: ${error instanceof Error ? error.message : String(error)}`,
						);
					}
				}}
			/>
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
						text: importBusy ? "Importing…" : "Import",
						key: "enter",
						disabled: importBusy || !importResult?.messages,
						callback: applyImport,
					},
				]}
				shown={importResult !== undefined}
			>
				<div className="drawer-header">Review import</div>
				<div className="drawer-body">
					{importResult && importResult.type === ImportType.UNSUPPORTED && (
						<p>
							This file type is not supported. Supported are i18next JSON, Apple .strings and
							.stringsdict, and Android .xml files.
						</p>
					)}

					{importResult && importResult.type !== ImportType.UNSUPPORTED && importKeysByState && (
						<>
							{importWarning && (
								<div className="drawer-alert" role="alert">
									<p>{importWarning}</p>
									{pendingFile && (
										<button
											type="button"
											className="transfer-action"
											disabled={importBusy}
											onClick={() => {
												setImportFormat(i18nextPluginKey);
												void previewImport(
													pendingFile.files,
													pendingFile.language,
													i18nextPluginKey,
												);
											}}
										>
											Read as i18next JSON
										</button>
									)}
								</div>
							)}
							<dl className="drawer-stats">
								<dt>File</dt>
								<dd>{importResult.fileName}</dd>
								<dt>Format</dt>
								<dd>{importResult.formatName ?? importResult.type}</dd>
								<dt>Language</dt>
								<dd>{importKeysByState.language}</dd>
								<dt>New messages</dt>
								<dd>{importKeysByState.newMessages.length}</dd>
								<dt>New translations</dt>
								<dd>{importKeysByState.newVariants.length}</dd>
								<dt>Changed translations</dt>
								<dd>{importKeysByState.updatedVariants.length}</dd>
							</dl>
							<p>Existing translations in this language are replaced where the keys match.</p>
							<ul className="drawer-keys">
								{importResult.messages!.slice(0, 10).map((message) => (
									<li key={message.id}>{message.id}</li>
								))}
							</ul>
							{importResult.messages!.length > 10 && (
								<p>And {importResult.messages!.length - 10} more keys.</p>
							)}
						</>
					)}
				</div>
			</Drawer>
		</div>
	);
}
