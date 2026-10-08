import * as React from "react";
import { useState } from "react";
import { reportError } from "../../utils/errorReporting";
import Select, { SelectOption } from "../../compontents/select/select";
import Drawer from "../../compontents/drawer/Drawer";
import FigmaUtil from "../../../shared/FigmaUtil";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { Locale, languageDisplayName } from "../../../lib/message/variants/Locale";
import TranslatorMachine, {
	NoMoreTranslationsLeftError,
} from "../../../lib/translationprovider/TranslatorMachine";

type PageSwitch = {
	language: Locale;
	pageName: string;
	frameIds: string[];
	textCount: number;
	alreadyInLanguage: number;
};

type BulkLanguageBarProps = {
	/** root frames listed in the Layers tab (the selection) */
	selectedFrameIds: string[];
	figmaRemote: FigmaUtil;
	localizedLabelManager: LocalizedLabelManagerUI;
};

/** Switches the language of all selected frames or of every frame on the page at once. */
export default function BulkLanguageBar({
	selectedFrameIds,
	figmaRemote,
	localizedLabelManager,
}: BulkLanguageBarProps) {
	const [progress, setProgress] = useState<{ done: number; total: number } | undefined>();
	const [pageSwitch, setPageSwitch] = useState<PageSwitch | undefined>();
	// remounts the menus so they show their placeholder again instead of the last picked language
	const [menuKey, setMenuKey] = useState(0);

	const { messageStore } = localizedLabelManager;
	const refLanguage = messageStore.getRefLanugage();
	const multipleFrames = selectedFrameIds.length > 1;

	function languageOptions(scope: "selection" | "page") {
		return messageStore.getOrderedLanguages().map((language): SelectOption => ({
			value: `${scope}:${language}`,
			label: `${languageDisplayName(language) ?? language} - ${language}`,
			tag: language === refLanguage ? "ref" : undefined,
		}));
	}

	async function switchFrames(frameIds: string[], language: Locale) {
		setProgress({ done: 0, total: frameIds.length });
		try {
			const { lockedLabels } = await localizedLabelManager.setFramesLanguage(
				frameIds,
				language,
				TranslatorMachine.instance,
				(done, total) => setProgress({ done, total }),
			);
			const frames = frameIds.length === 1 ? "1 frame" : `${frameIds.length} frames`;
			const languageName = languageDisplayName(language) ?? language;
			figmaRemote.notify(
				lockedLabels === 0
					? `Switched ${frames} to ${languageName}.`
					: `Switched ${frames} to ${languageName}. ${lockedLabels === 1 ? "1 text was" : `${lockedLabels} texts were`} not changed: use “Fix styles” on ${lockedLabels === 1 ? "it" : "them"} in the Layers list first.`,
				// the longer message needs more time to be read than the default 3 s
				lockedLabels === 0 ? undefined : 7000,
			);
		} catch (e: any) {
			if (!(e instanceof NoMoreTranslationsLeftError)) {
				figmaRemote.notifyError(`Something went wrong with translation - ${e.message}`, 8000);
				reportError(e);
			}
		} finally {
			setProgress(undefined);
		}
	}

	async function preparePageSwitch(language: Locale) {
		const { pageName, frames } = await localizedLabelManager.getPageRootFrames();
		const framesToSwitch = frames.filter((frame) => frame.language !== language);
		if (framesToSwitch.length === 0) {
			figmaRemote.notify(
				frames.length === 0
					? "There are no frames with text on this page."
					: `All frames on this page are already in ${languageDisplayName(language) ?? language}.`,
			);
			return;
		}
		setPageSwitch({
			language,
			pageName,
			frameIds: framesToSwitch.map((frame) => frame.id),
			textCount: framesToSwitch.reduce((sum, frame) => sum + frame.textCount, 0),
			alreadyInLanguage: frames.length - framesToSwitch.length,
		});
	}

	function onLanguagePicked(option: SelectOption) {
		setMenuKey((key) => key + 1);
		const [scope, language] = String(option.value).split(":") as [string, Locale];
		if (scope === "selection") {
			switchFrames(selectedFrameIds, language);
		} else {
			preparePageSwitch(language).catch((e: Error) => {
				figmaRemote.notifyError(e.message);
				reportError(e);
			});
		}
	}

	const languageName = pageSwitch
		? (languageDisplayName(pageSwitch.language) ?? pageSwitch.language)
		: "";

	return (
		<>
			<Drawer
				position="top"
				shown={pageSwitch !== undefined}
				buttons={[
					{
						type: "secondary",
						text: "Cancel",
						key: "escape",
						callback: () => setPageSwitch(undefined),
					},
					{
						type: "primary",
						text: "Switch page",
						key: "enter",
						callback: () => {
							const { frameIds, language } = pageSwitch!;
							setPageSwitch(undefined);
							switchFrames(frameIds, language);
						},
					},
				]}
			>
				{pageSwitch && (
					<>
						<div className="drawer-header">
							Switch {pageSwitch.frameIds.length}{" "}
							{pageSwitch.frameIds.length === 1 ? "frame" : "frames"} on “{pageSwitch.pageName}” to{" "}
							{languageName}?
						</div>
						<div className="drawer-body">
							<p>
								Linked texts show their {languageName} message. Texts without a message are machine
								translated ({pageSwitch.textCount} {pageSwitch.textCount === 1 ? "text" : "texts"}{" "}
								in total).
								{pageSwitch.alreadyInLanguage > 0 &&
									(pageSwitch.alreadyInLanguage === 1
										? ` 1 frame is already in ${languageName} and stays as it is.`
										: ` ${pageSwitch.alreadyInLanguage} frames are already in ${languageName} and stay as they are.`)}
							</p>
							<p>You can undo this with Cmd/Ctrl + Z.</p>
						</div>
					</>
				)}
			</Drawer>

			<div className="bulk-language-bar">
				<span className="bulk-language-bar-label" aria-live="polite">
					{progress
						? `Switching frame ${Math.min(progress.done + 1, progress.total)} of ${progress.total}…`
						: multipleFrames
							? "" // the menus say what they switch
							: "Switch many frames at once"}
				</span>
				{multipleFrames && (
					<Select
						key={`selection-${menuKey}`}
						className="bulk-language-select"
						tooltip="Switch the selected frames"
						placeholder={`Switch ${selectedFrameIds.length} frames`}
						iconClass="switch-language-svg"
						checkmark={false}
						isDisabled={progress !== undefined}
						getOptions={() => languageOptions("selection")}
						onChange={(option) => onLanguagePicked(option)}
					/>
				)}
				<Select
					key={`page-${menuKey}`}
					className={`bulk-language-select${multipleFrames ? " bulk-language-select--secondary" : ""}`}
					tooltip="Switch every frame on this page"
					placeholder={multipleFrames ? "Whole page" : "Switch page"}
					iconClass={multipleFrames ? undefined : "switch-language-svg"}
					checkmark={false}
					isDisabled={progress !== undefined}
					getOptions={() => languageOptions("page")}
					onChange={(option) => onLanguagePicked(option)}
				/>
			</div>
		</>
	);
}
