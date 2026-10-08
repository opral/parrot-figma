import * as React from "react";
import { reportError } from "../../utils/errorReporting";
import { LocalizedLabel, MessageLinkState } from "../../../lib/localizedlabels/LocalizedLabel";
import LocalizedLabelListItem from "./LocalizedLabelListItem";
import Select, { SelectOption } from "../../compontents/select/select";
import FigmaUtil from "../../../shared/FigmaUtil";
import MessageStoreMemory from "../../../lib/message/store/MessageStoreMemory";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { Locale, languageDisplayName } from "../../../lib/message/variants/Locale";
import { UILocalizedLabel } from "../../../lib/localizedlabels/UILocalizedLabel";
import { NodeSelection } from "../../../lib/localizedlabels/LocalizedLabelManager";
import GoogleTranslator from "../../../lib/translationprovider/google";
import TranslatorMachine, {
	NoMoreTranslationsLeftError,
} from "../../../lib/translationprovider/TranslatorMachine";

type LocalizedFrameGroupProps = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- TODO specify type
	showMessage: Function;
	localizedLabels: UILocalizedLabel[];
	selectedNodes: NodeSelection;
	figmaRemote: FigmaUtil;
	localizedLabelManager: LocalizedLabelManagerUI;
};

function toLanguageOption(language: string, baseLanguage?: string) {
	const languageNameInCurrentLanguage = languageDisplayName(language) ?? "no name found";

	if (baseLanguage && language === baseLanguage) {
		return {
			value: language,
			label: `${languageNameInCurrentLanguage} - ${language}`,
			tag: "ref",
		};
	}
	return {
		value: language,
		label: `${languageNameInCurrentLanguage} - ${language}`,
	};
}

export default function LocalizedFrameGroup({
	showMessage,
	localizedLabels,
	selectedNodes,
	figmaRemote,
	localizedLabelManager,
}: LocalizedFrameGroupProps) {
	if (localizedLabels.length === 0) return null;

	const firstTranslationState = localizedLabels[0];
	const { rootFrameName, rootFrameId } = firstTranslationState;

	let rootFrameLanguage: SelectOption | undefined;
	const languageOptiones = [] as SelectOption[];

	// reference language first, then the Setup order (the same order in every view)
	for (const language of localizedLabelManager.messageStore.getOrderedLanguages()) {
		const currentLanguageOption = toLanguageOption(
			language,
			language === localizedLabelManager.messageStore.getRefLanugage() ? language : undefined,
		);
		if (language === firstTranslationState.rootFrameLanguage) {
			rootFrameLanguage = currentLanguageOption;
		}
		languageOptiones.push(currentLanguageOption);
	}

	// A frame can still be in a language that was removed in Setup. Keep it selectable so the
	// layers stay visible and the user can switch the frame to a language that is configured.
	const frameLanguage = firstTranslationState.rootFrameLanguage;
	if (rootFrameLanguage === undefined && frameLanguage) {
		rootFrameLanguage = { ...toLanguageOption(frameLanguage), tag: "not in Setup" };
		languageOptiones.push(rootFrameLanguage);
	}

	async function onLanguageSelectionClick(
		firstLocalizedLabelInFrame: LocalizedLabel,
		language: Locale,
	) {
		const translationProvider = TranslatorMachine.instance;

		try {
			await localizedLabelManager.setFrameLanguage(
				firstLocalizedLabelInFrame.rootFrameId,
				language,
				translationProvider,
			);
		} catch (e: any) {
			if (!(e instanceof NoMoreTranslationsLeftError)) {
				figmaRemote.notifyError(`Something went wrong with translation - ${e.message}`, 8000);
				reportError(e);
			}
		}
	}

	async function onNodeSelect(nodeId: string) {
		await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
	}

	return (
		<>
			<div
				className={`column-1 layer-group-header nodes-parent${
					selectedNodes[rootFrameId]?.directSelection ? " selected" : ""
				}`}
				onClick={(e) => {
					// The language menu is rendered in a portal, so its clicks bubble through React to
					// this header. Using it must not collapse a multi-frame selection to this frame.
					const target = e.target as HTMLElement;
					if (!e.currentTarget.contains(target) || target.closest(".row-actions")) return;
					onNodeSelect(rootFrameId);
				}}
			>
				<div className="spacer" />
				<div className="element-symbol">
					<div className="svg-container number-sign-svg" />
				</div>
				<div className="element-name font-body-24-bold">{rootFrameName}</div>
				<div className="row-actions">
					<Select
						tooltip="Frame language"
						placeholder="Select item"
						checkmark
						iconClass="switch-language-svg"
						onChange={(value) => {
							onLanguageSelectionClick(firstTranslationState, value.value as Locale);
						}}
						defaultValue={languageOptiones.find((opt) => opt.value === rootFrameLanguage?.value)}
						getOptions={() => languageOptiones}
					/>
				</div>
			</div>
			<div className="layer-group-header-sticky-border" />

			{rootFrameLanguage?.value &&
				!localizedLabels.some(
					(label) =>
						label.messageLinkState === MessageLinkState.Linked ||
						label.messageLinkState === MessageLinkState.Unmanaged,
				) && (
					<div className="frame-hint" role="note">
						Link each text to a message: type a key like <code>home.title</code> in its “Link a
						message…” field. Linked texts follow the language of this frame.
					</div>
				)}

			{rootFrameLanguage?.value &&
				localizedLabels.map((translationState) => {
					let selection = "unselected" as "unselected" | "selected" | "selected-by-parent";
					if (selectedNodes[translationState.nodeId] !== undefined) {
						if (selectedNodes[translationState.nodeId].directSelection) {
							selection = "selected";
						} else {
							selection = "selected-by-parent";
						}
					}

					return (
						<LocalizedLabelListItem
							showMessage={showMessage}
							key={translationState.nodeId}
							figmaRemote={figmaRemote}
							localizedLabelManager={localizedLabelManager}
							selected={selection}
							localizedLabel={translationState}
						/>
					);
				})}

			{rootFrameLanguage?.value === undefined && (
				<div className="frame-hint" role="note">
					Choose the language this frame is currently designed in (menu above).
				</div>
			)}
		</>
	);
}
