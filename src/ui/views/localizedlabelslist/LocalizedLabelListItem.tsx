import * as React from "react";
import { reportError } from "../../utils/errorReporting";
import { useEffect, useRef, useState } from "react";
import { Plural } from "../../../lib/message/variants/Plural";
import { MessageLinkState } from "../../../lib/localizedlabels/LocalizedLabel";
import FigmaUtil from "../../../shared/FigmaUtil";
import InputSelect, {
	InputSelectOption,
	InputSelectionOptionType,
} from "../../compontents/selectInput/inputselect";
import { SelectOption } from "../../compontents/select/select";
import MessageStoreMemory from "../../../lib/message/store/MessageStoreMemory";
import { Locale } from "../../../lib/message/variants/Locale";
import { htmlToPlainText } from "../../../lib/message/editor/HtmlText";
import { hasMessageWithText, suggestMessageKey } from "../../../lib/localizedlabels/KeySuggestion";
import TranslationEditor from "../../compontents/translationEditor/TranslationEditor";
import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import TextField from "../../compontents/textfield/TextField";
import { showMachineTranslationContact } from "../../compontents/machineTranslation/MachineTranslationContact";
import MessageListView from "../messages/MessageListView";
import { UILocalizedLabel } from "../../../lib/localizedlabels/UILocalizedLabel";
import Drawer from "../../compontents/drawer/Drawer";
import { MessageParameterValues } from "../../../lib/message/MessageParameterValues";
import LayerVariables from "./LayerVariables";

/**
 * The text the "Select a message" drawer starts its search with: plain words (no query syntax) of the
 * layer text - in a frame that is not in the reference language the reference text of the layer, which
 * is what the messages to link contain.
 */
function messageSearchSeed(label: UILocalizedLabel, refLanguage: string | undefined) {
	let text = label.characters;
	if (
		refLanguage !== undefined &&
		label.rootFrameLanguage !== refLanguage &&
		label.unlinkedMessage
	) {
		const refHtml = MessageStoreMemory.htmlForPattern(label.unlinkedMessage, refLanguage, []);
		if (refHtml) text = htmlToPlainText(refHtml.replace(/<[^>]*>/g, ""));
	}
	return (text.split(/\r?\n|\u2028/).find((line) => line.trim() !== "") ?? "").trim().slice(0, 40);
}

// What "Fix styles" does for each lint rule, in plain words (see lint/rules/*.fix) - shown before anything is changed.
const lintFixDescriptions: { [ruleName: string]: string } = {
	MixedStyleNotSupportedForFills:
		"Several text colors - the whole text gets its most used color (a colored word turns into the main color).",
	MixedStyleNotSupportedForFontSize: "Several font sizes - the whole text gets its most used size.",
	MixedStyleNotSupportedForTextCase:
		"Several letter cases (e.g. upper case) - the whole text gets the most used one.",
	MixedStyleNotSupportedForLetterSpacing:
		"Several letter spacings - the whole text gets the most used one.",
	MixedStyleNotSupportedForLineHeight:
		"Several line heights - the whole text gets the most used one.",
	MixedStyleNotSupportedForLeadingTrim:
		"Several leading trim settings - the whole text gets the most used one.",
	MixedStyleNotSupportedOpenTypeFace:
		"Several OpenType features - the whole text gets the most used setting.",
	FontStyleNotSupported:
		"Font styles other than Regular, Bold and Italic (e.g. Medium or Semi Bold) - the whole text gets its most used supported style, bold and italic ranges are lost.",
	IndentationNotSupported:
		"Indentation outside of lists or deeper than one level - it is reduced to what Parrot supports.",
	TextDecorationUnknown: "Unsupported text decorations - they are removed.",
};

type LocalizedLabelListItemProps = {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type -- TODO specify type
	showMessage: Function;
	localizedLabel: UILocalizedLabel;
	figmaRemote: FigmaUtil;
	localizedLabelManager: LocalizedLabelManagerUI;
	selected: "selected-by-parent" | "selected" | "unselected";
};

export default function LocalizedLabelListItem({
	showMessage,
	localizedLabel,
	figmaRemote,
	localizedLabelManager,
	selected,
}: LocalizedLabelListItemProps) {
	const { messageStore } = localizedLabelManager;
	const message =
		localizedLabel.messageLinkState !== MessageLinkState.Unset
			? messageStore.getMessage(localizedLabel.messageId!)
			: undefined;

	const rowRef = React.useRef<HTMLDivElement>(null);

	const labelState = localizedLabel.state!;

	const [messageSearch, setMessageSearch] = useState(undefined as any);

	const [showMessageInDrawer, setShowMessageInDrawer] = useState(undefined as any);

	const [confirmFixStyles, setConfirmFixStyles] = useState(false);

	const drawerSelectedKey = useRef<string | undefined>(undefined);
	// Dummy state variable to trigger re-render when currentHighlightIndex.current changes
	const [, setDummyState] = useState<any>();

	const pluralsAvailable = [] as SelectOption[];

	async function createNewVersionFromDesign() {
		await localizedLabelManager.createNewVersionFromLabelState(localizedLabel).catch((e: Error) => {
			reportError(e);
			figmaRemote.notifyError(e.message);
		});
	}

	async function fixLints() {
		setConfirmFixStyles(false);
		await localizedLabelManager
			.fixLabelLints(localizedLabel, localizedLabel.matchingLabelLints)
			.catch((e: Error) => {
				reportError(e);
				figmaRemote.notifyError(e.message);
			});
	}

	async function updateToLatestKeyVersion() {
		await localizedLabelManager.updateToMessageHead([localizedLabel]).catch((e: Error) => {
			reportError(e);
			figmaRemote.notifyError(e.message);
		});
	}

	async function onNodeSelect(nodeId: string) {
		await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
	}

	// TODO #18 selectors check if inlang supports plurals
	// if (messages) {
	//   for (const plural of Object.keys(messages)) {
	//     const pluralOption = {
	//       value: plural, label: plural,
	//     };
	//     pluralsAvailable.push(pluralOption);
	//   }
	// } else {
	pluralsAvailable.push({
		value: Plural.OTHER,
		label: Plural.OTHER,
	});
	// }

	let messageName = "";

	if (localizedLabel.messageLinkState === MessageLinkState.Linked) {
		messageName = localizedLabel.getMessageName()!;
	}

	let iconClass = "no-message-svg";
	if (localizedLabel.messageLinkState === MessageLinkState.Linked) {
		iconClass = "with-message-svg";
	} else if (localizedLabel.messageLinkState === MessageLinkState.Unmanaged) {
		iconClass = "not-localized-svg";
	} else if (localizedLabel.messageLinkState === MessageLinkState.MissingMessage) {
		iconClass = "no-message-svg";
	} else if (localizedLabel.messageLinkState === MessageLinkState.Unlinked) {
		iconClass = "no-message-svg";
	}

	useEffect(() => {
		setDummyState({});
	}, [localizedLabel]);

	const isLinked =
		localizedLabel.messageLinkState === MessageLinkState.Linked ||
		localizedLabel.messageLinkState === MessageLinkState.MissingMessage;
	const isUnmanaged = localizedLabel.messageLinkState === MessageLinkState.Unmanaged;

	// computed when the key field opens - not on every render of the row
	// A message with exactly this text is offered under "Text matches" - suggesting a new key for the
	// same text (login.sign_in_2) would only create a duplicate.
	const suggestedKey = () =>
		isLinked ||
		isUnmanaged ||
		hasMessageWithText(messageStore.getAllMessages() ?? [], localizedLabel.characters)
			? undefined
			: suggestMessageKey({
					frameName: localizedLabel.rootFrameName,
					layerName: localizedLabel.name,
					characters: localizedLabel.characters,
					existingKeys: new Set((messageStore.getAllMessages() ?? []).map((m) => m.id)),
				});

	let rowAction: { label: string; icon: string; run: () => Promise<void> };
	if (isLinked) {
		rowAction = {
			label: "Unlink from message (keeps the text)",
			icon: "unlinked-svg",
			run: () => localizedLabelManager.unsetLabel(localizedLabel),
		};
	} else if (isUnmanaged) {
		rowAction = {
			label: "Translate this layer again",
			icon: "with-message-small-svg",
			run: () => localizedLabelManager.unsetLabel(localizedLabel),
		};
	} else {
		rowAction = {
			label: "Do not translate this layer",
			icon: "not-localized-small-svg",
			run: () => localizedLabelManager.setLabelToUnmanaged(localizedLabel),
		};
	}

	return (
		<>
			<Drawer
				position="top"
				buttons={[
					{
						type: "secondary",
						text: "Cancel",
						key: "escape",
						callback: () => {
							setMessageSearch(undefined);
						},
					},
					{
						type: "primary",
						text: "Use message",
						key: "enter",
						callback: () => {
							const messageToLink = localizedLabelManager.messageStore.getMessage(
								drawerSelectedKey.current!,
							)!;

							localizedLabelManager
								.linkMessage(localizedLabel, messageToLink.id, localizedLabel.rootFrameLanguage!)
								.catch((e) => {
									figmaRemote.notifyError(`could not set message${e.message}`);
									reportError(e);
								});
							setMessageSearch(undefined);
						},
						disabled: drawerSelectedKey.current === undefined,
					},
				]}
				shown={messageSearch !== undefined}
			>
				<div className="modal-title" style={{ width: "1000px" }}>
					Select a message
				</div>
				{messageSearch !== undefined && (
					<MessageListView
						showSearchBar
						messageStore={messageStore}
						localizedLabelManager={localizedLabelManager}
						figmaRemote={figmaRemote}
						selectedMessageId={drawerSelectedKey.current}
						initialSearchQuery={MessageStoreMemory.toQueryObject(messageSearch.search)}
						select={(key: string, language: Locale, plural: Plural) => {
							drawerSelectedKey.current = key;
							setDummyState({});
						}}
						highlightSelectedNodes={false}
					/>
				)}
			</Drawer>

			{localizedLabel.matchingLabelLints.length > 0 && (
				<Drawer
					position="top"
					buttons={[
						{
							type: "secondary",
							text: "Cancel",
							key: "escape",
							callback: () => {
								setConfirmFixStyles(false);
							},
						},
						{
							type: "primary",
							text: "Fix styles",
							key: "enter",
							callback: fixLints,
						},
					]}
					shown={confirmFixStyles}
				>
					<div className="drawer-header">Fix styles of “{localizedLabel.name}”?</div>
					<div className="drawer-body">
						<p>
							This text uses styles that cannot be kept while it is translated. Fixing changes the
							text in your design:
						</p>
						<ul>
							{localizedLabel.matchingLabelLints.map((lint) => (
								<li key={lint}>{lintFixDescriptions[lint] ?? lint}</li>
							))}
						</ul>
						<p>You can undo this with Cmd/Ctrl + Z.</p>
					</div>
				</Drawer>
			)}

			<Drawer
				className="message-editor-drawer"
				position="top"
				buttons={[
					{
						type: "secondary",
						text: "Close",
						key: "escape",
						callback: () => {
							setShowMessageInDrawer(undefined);
						},
					},
				]}
				shown={showMessageInDrawer !== undefined}
			>
				<div className="modal-title" style={{ width: "1000px" }}>
					Edit message
				</div>
				{showMessageInDrawer !== undefined && (
					<MessageListView
						showSearchBar={false}
						messageStore={messageStore}
						localizedLabelManager={localizedLabelManager}
						figmaRemote={figmaRemote}
						selectedMessageId={showMessageInDrawer}
						initialSearchQuery={MessageStoreMemory.toQueryObject(`name:${showMessageInDrawer}`)}
						highlightSelectedNodes={false}
					/>
				)}
			</Drawer>

			<div
				className={`layer ${selected} layer-message-state__${localizedLabel.messageLinkState} `}
				onClick={() => {
					onNodeSelect(localizedLabel.nodeId);
				}}
			>
				<div className="layer-name">
					<div className="spacer" />
					<div className="spacer" />
					<div className="element-symbol">
						<div className="svg-container text-sign-svg" />
					</div>
					<TextField
						singleClick={false}
						onSave={async (labelName: string) => {
							await localizedLabelManager.updateLabelName(localizedLabel, labelName).catch((e) => {
								figmaRemote.notifyError(`could not set message${e.message}`);
								reportError(e);
							});
						}}
						text={localizedLabel.name}
					/>
				</div>

				<div className="layer-details" ref={rowRef}>
					<div className="message-panel">
						<InputSelect
							className="message-select"
							placeholder={
								localizedLabel.messageLinkState === MessageLinkState.Unmanaged
									? "not localized"
									: "Link a message..."
							}
							isDisabled={localizedLabel.matchingLabelLints.length > 0}
							iconClass={iconClass}
							inputPlaceholder="e.g. home.tagline"
							getSuggestedValue={suggestedKey}
							onCancel={() => {
								setDummyState({});
							}}
							onChange={async (selectedOption, reset) => {
								if (selectedOption.type === InputSelectionOptionType.ACTION) {
									if (selectedOption.value === "select-message") {
										setMessageSearch({
											search: messageSearchSeed(
												localizedLabel,
												localizedLabelManager.messageStore.getRefLanugage(),
											),
										});
									} else if (selectedOption.value === "show-message") {
										setShowMessageInDrawer(localizedLabel.getMessageName());
									} else if (selectedOption.value === "reset") {
										// triggered by empty field - option added by the select field it self
										reset();
										await localizedLabelManager.unsetLabel(localizedLabel);
									} else if (selectedOption.value === "text-layer-not-localized") {
										// triggered by empty field - option added by the select field it self
										reset();
										await localizedLabelManager.setLabelToUnmanaged(localizedLabel);
									}
								} else if (selectedOption.type === InputSelectionOptionType.ADD) {
									await localizedLabelManager.linkMessage(
										localizedLabel,
										selectedOption.value,
										localizedLabel.rootFrameLanguage!,
									);
								} else if (selectedOption.type === InputSelectionOptionType.SUGGESTION) {
									await localizedLabelManager.linkMessage(
										localizedLabel,
										selectedOption.value,
										localizedLabel.rootFrameLanguage!,
									);
								}
								/* if (selectedOption.type === 'action') {
                      if (selectedOption.value === 'no-translation') {
                        localizedLabelManager.setNoKey(localizedLabel);
                      } else if (selectedOption.value === 'select-message') {
                        setSearchKey({
                          search: localizedLabel.characters,
                        });
                      } else if (selectedOption.value === 'create-key') {
                        setNewKey(localizedLabel.derivedKey ?? '');
                      } else if (selectedOption.value === 'show-message') {
                        showKey(localizedLabel.key!);
                      }
                    } else if (selectedOption.type === 'key') {
                      localizedLabelManager.linkKey(localizedLabel, selectedOption.value as string, selectedOption.language!, selectedOption.plural!);
                    } */
							}}
							valueReplaceFn={(value) => value.replace(/ /g, "_")}
							defaultValue={messageName}
							getOptions={(enteredValue: string) => {
								let options = [] as InputSelectOption[];

								const keySearch = enteredValue === "" ? "*" : enteredValue;
								const textMatchQuery = MessageStoreMemory.toQueryObject(
									`exact_text:true name:${keySearch} ${localizedLabel.characters}`,
								);
								const { inText: suggestedKeys, matchingNames: matchingKeysByName } =
									messageStore.findMessages(textMatchQuery);

								const isValidKey =
									enteredValue.length >= 0 &&
									/^[a-zA-Z0-9]$/.test(enteredValue[enteredValue.length - 1]);

								if (
									isValidKey &&
									!suggestedKeys.has(enteredValue) &&
									!matchingKeysByName.has(enteredValue)
								) {
									options.push({
										type: InputSelectionOptionType.ADD,
										value: enteredValue,
										label: "",
									});
								}

								const suggestion = enteredValue === "" ? suggestedKey() : undefined;
								if (suggestion) {
									options.push(
										{
											type: InputSelectionOptionType.DIVIDER,
											value: "",
											label: "Suggested key",
										},
										{
											type: InputSelectionOptionType.SUGGESTION,
											icon: "plus-svg",
											value: suggestion,
											label: suggestion,
										},
									);
								}

								if (suggestedKeys.size > 0) {
									options.push({
										type: InputSelectionOptionType.DIVIDER,
										value: "",
										label: "Text matches",
									});
								}

								options = options.concat(
									[...suggestedKeys].map((key) => {
										matchingKeysByName.delete(key);
										return {
											type: InputSelectionOptionType.SUGGESTION,
											icon: "with-message-svg",
											value: messageStore.getMessage(key)!.id,
											label: messageStore.getMessage(key)!.id,
										};
									}),
								);

								if (keySearch.length > 2 && matchingKeysByName.size > 0) {
									options.push({
										type: InputSelectionOptionType.DIVIDER,
										value: "",
										label: "Messages",
									});

									options = options.concat(
										[...matchingKeysByName]
											.filter((matchingKey) => !suggestedKeys.has(matchingKey))
											.map((key) => ({
												type: InputSelectionOptionType.SUGGESTION,
												icon: "with-message-svg",
												value: messageStore.getMessage(key)!.id,
												label: messageStore.getMessage(key)!.id,
											})),
									);
								}

								if (options.length > 1) {
									options.push({
										type: InputSelectionOptionType.DIVIDER,
										value: "",
										label: "",
									});
								}

								options.push({
									label: "Full Search...",
									icon: "search-svg",
									value: "select-message",
									type: InputSelectionOptionType.ACTION,
								});

								if (
									localizedLabel.messageLinkState === MessageLinkState.Linked &&
									messageName === enteredValue
								) {
									options.push({
										label: "Show linked Message...",
										icon: "goto-message-svg",
										value: "show-message",
										type: InputSelectionOptionType.ACTION,
									});
								}

								if (localizedLabel.messageLinkState === MessageLinkState.Unmanaged) {
									options.push({
										label: "Enable translation...",
										icon: "with-message-svg",
										value: "reset",
										type: InputSelectionOptionType.ACTION,
									});
								} else {
									options.push({
										label: "Do not translate this text layer...",
										icon: "not-localized-svg",
										value: "text-layer-not-localized",
										type: InputSelectionOptionType.ACTION,
									});
								}

								// Unlink?
								return options;
							}}
						/>

						<div className="message-variant">
							<div
								className="message-variant-language"
								data-tooltip-content="Current Language of this Label"
							>
								<span className="language">{localizedLabel.language}</span>
								{localizedLabel.language ===
									localizedLabelManager.messageStore.getRefLanugage() && (
									<span className="language-tag">ref</span>
								)}
							</div>
							{/* <div key={localizedLabel.pluralId} className={`keyPluralWrapper ${translatedKey?.plural ? 'onePlural' : ' multiplePlurals'}`}> */}

							<div className="grid-item-translation translation-container">
								<TranslationEditor
									language={localizedLabel.language}
									refLanguage={localizedLabelManager.messageStore.getRefLanugage()!}
									editable
									isDisabled={localizedLabel.matchingLabelLints.length > 0}
									match={undefined}
									onCancel={async () => {
										localizedLabelManager.commitUndo();
									}}
									onChange={async (
										patternHtml: string | undefined,
										parameters: MessageParameterValues,
										reset: any,
									) => {
										if (patternHtml !== undefined) {
											localizedLabelManager
												.updateLabelPatternHtml(localizedLabel, patternHtml, parameters)
												.catch((e: Error) => {
													reportError(e);
													figmaRemote.notifyError(e.message);
													reset();
												});
										}
									}}
									parameterValues={localizedLabel.parameterValues}
									variantHTML={localizedLabel.currentPatternHTML}
									messageStore={messageStore}
								>
									{localizedLabel.language !==
										localizedLabelManager.messageStore.getRefLanugage() &&
										(localizedLabel.currentPatternHTML === undefined ||
											localizedLabel.currentPatternHTML === "") && (
											<button
												type="button"
												onClick={showMachineTranslationContact}
												data-tooltip-content="Machine translations are part of Parrot Cloud"
											>
												Translate
											</button>
										)}

									{localizedLabel.messageLinkState === MessageLinkState.Linked &&
										(labelState.modified ||
											localizedLabel.language !== localizedLabel.rootFrameLanguage) && ( // allow the user to catch up with the keys version
											<button
												type="button"
												data-tooltip-content="Reset this layer to the text stored in the message"
												onClick={updateToLatestKeyVersion}
											>
												Revert
											</button>
										)}

									{localizedLabel.messageLinkState === MessageLinkState.Linked &&
										labelState.modified && (
											<button
												type="button"
												onClick={createNewVersionFromDesign}
												data-tooltip-content="Save the text of this layer as the message text"
											>
												Update message
											</button>
										)}

									{localizedLabel.matchingLabelLints.length > 0 && (
										<button
											type="button"
											className="lint-fix-button"
											data-tooltip-content="This text uses styles that cannot be translated. Click to see what Fix styles will change."
											onClick={() => setConfirmFixStyles(true)}
										>
											<div className="svg-container warning-svg" />
											Fix styles
										</button>
									)}
								</TranslationEditor>
								{localizedLabel.messageLinkState === MessageLinkState.Linked &&
									message !== undefined &&
									localizedLabel.matchingLabelLints.length === 0 && (
										<LayerVariables
											message={message}
											language={localizedLabel.language}
											parameterValues={localizedLabel.parameterValues}
											onChange={(name, value) => {
												localizedLabelManager
													.updateLabelVariable(localizedLabel, name, value)
													.catch((e: Error) => {
														reportError(e);
														figmaRemote.notifyError(e.message);
													});
											}}
										/>
									)}
								{/* TODO #18 make paramter editable again when we have selectors in place - variables only used as selectors can't be accesed otherwise
                      { selected !== 'unselected' && (
                        <div className="placeholder-view-grid" style={{ display: Object.keys(localizedLabel.parameterValues).length > 0 ? undefined : 'none' }}>

                          <div />
                          <div />
                          <div>Placeholder</div>
                          <div />
                          <div />
                          {Object.entries(localizedLabel.parameterValues).map((entry, i, array) => (
                            <PlaceholderEditorListItem
                              key={entry[0]}
                              placeholder={entry[1]}
                              fillin={localizedLabel.parameterValues?.[entry[0]]?.value ? localizedLabel.parameterValues?.[entry[0]]?.value : 'unset'}
                              onValueChange={(placeholderName, fillinValue) => {
                                // TODO #18 variables - this is not used at the moment but bases on fillins instead of parameters
                                localizedLabelManager.updateLabelFillin(localizedLabel, placeholderName, fillinValue).catch((e: Error) => {
                                  reportError(e);
                                  figmaRemote.notifyError(e.message);
                                });
                              }}
                            />

                          ))}
                        </div>
                      )} */}
							</div>
						</div>
					</div>
				</div>

				<div className="layer-row-actions">
					<button
						type="button"
						className={`layer-row-action${isUnmanaged ? " layer-row-action--active" : ""}`}
						aria-label={rowAction.label}
						data-tooltip-content={rowAction.label}
						onClick={(e) => {
							// a click on the row selects the layer on the canvas - the action must not
							e.stopPropagation();
							rowAction.run().catch((error: Error) => {
								reportError(error);
								figmaRemote.notifyError(error.message);
							});
						}}
					>
						<span className={`svg-container ${rowAction.icon}`} />
					</button>
				</div>

				<div className="layer-spacer" />
			</div>
		</>
	);
}
