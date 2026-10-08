import * as React from "react";
import { useEffect, useState } from "react";
import { reportError } from "../../utils/errorReporting";

import "../../localization/i18n";

import { Locale } from "../../../lib/message/variants/Locale";

import MessageStoreMemory from "../../../lib/message/store/MessageStoreMemory";

import FigmaUtil from "../../../shared/FigmaUtil";

import LocalizedLabelManagerUI from "../../../lib/localizedlabels/LocalizedLabelManagerUI";

import Drawer from "../../compontents/drawer/Drawer";
import MessageVariantItem from "./MessageVariantItem";
import InlangEditor from "./InlangEditor";
import TranslatorMachine, {
	NoMoreTranslationsLeftError,
} from "../../../lib/translationprovider/TranslatorMachine";
// import ReactQuill from 'react-quill';

type TranslationKeyListItemProps = {
	rowClassNames?: string | undefined;
	figmaRemote: FigmaUtil;

	searchMatch: any;
	messageStore: MessageStoreMemory;
	messageId: string;
	localizedLabelManager: LocalizedLabelManagerUI;

	// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
	select?: Function;
	messageSelected: boolean;
	onFocus?: (messageId: string, locale?: Locale, variantMatch?: string[]) => void;
	onBlur?: (messageId: string, locale?: Locale, variantMatch?: string[]) => void;
};

// TODO #roadmap select message on click - message / message variant
// TODO #roadmap highlight first screen that matches the given combination
// TODO #roadmap add x to seach field to reset filter
// TODO #roadmap deactivate the full seach if no message is available
// TODO #roadmap add little info label to message tab to indicate how many messages are managed

// TODO #27 add celebration and pricing message

// DONE #27 test in firefox
// DONE #27 remove log statements
// DONE #27 make show message a drawer - no need for the list
// DONE #27 fix search drawer layout for to long messages
// DONE #27 ESC does not work to cancel message edit
// DONE #27 style scrollbars https://stackblitz.com/edit/react-ts-frji5h?file=components%2Fscrollbar%2Findex.tsx
// DONE #27 fix sync message buttons
// DONE #27 fix message that are to long / scrolling
// DONE #27 check all z-indexes
// DONE #27 style delete drawer
// DONE #27 add no messages found with filter

function TranslationKeyListItem({
	rowClassNames,
	figmaRemote,
	searchMatch,
	messageStore,
	messageId,
	localizedLabelManager,
	select,
	messageSelected,
	onFocus,
	onBlur,
}: TranslationKeyListItemProps) {
	const [messageNameHovered, setMessageNameHoverd] = useState(false);

	const [focusedMessageVariant, setFocusedMessageVariant] = useState<
		undefined | { messageId: string; locale?: Locale; match?: string[] }
	>(undefined);

	// const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);
	const [messageIdToDelete, setMessageIdToDelete] = useState<undefined | string>(undefined);
	const [keyToDeleteReferences, setKeyToDeleteReferences] = useState<undefined | number>(undefined);

	const [message, setMessage] = useState(localizedLabelManager.messageStore.getMessage(messageId)!);

	const rowRef = React.useRef<HTMLDivElement>(null);

	useEffect(() => {
		const unsubscribe = messageStore.subscribeMessage(messageId, (updatedMessage) => {
			if (updatedMessage !== undefined) {
				// skip deleted
				setMessage(updatedMessage);
			}
		});
		return () => {
			unsubscribe?.();
		};
	}, []);

	useEffect(() => {
		const updateReferenceCount = async () => {
			const referenceCount = (await localizedLabelManager.getWithMessage(messageIdToDelete!))
				.length;
			setKeyToDeleteReferences(referenceCount);
		};

		if (messageIdToDelete) {
			updateReferenceCount();
		}
	}, [messageIdToDelete]);

	const refLanguage = messageStore.getRefLanugage();

	// reference language first, then the Setup order (the same order in every view)
	const languages = messageStore.getOrderedLanguages();

	return (
		<div
			ref={rowRef}
			className={`message-group ${select === undefined ? "message-group-inlang" : ""} ${messageSelected ? "message-group-selected" : ""} ${
				rowClassNames !== undefined ? rowClassNames : ""
			} ${messageNameHovered ? " message-group-hovered" : ""} ${
				focusedMessageVariant !== undefined ? " message-group-focused" : ""
			}`}
			onClick={() => {
				if (select) {
					select(message.id);
				}
			}}
		>
			<div
				className={"message-group-header " + (messageSelected ? " selected" : "")}
				onMouseOver={() => {
					setMessageNameHoverd(true);
				}}
				onMouseOut={() => {
					setMessageNameHoverd(false);
				}}
			>
				<div className="spacer" />
				<div className="message-group-header-element-symbol">
					<div className="svg-container with-message-svg" />
				</div>
				<div className="message-group-header-name">
					<div className="rowText">
						{messageId}
						{/* <TextField
              singleClick={false}
              onSave={async (messageName: string) => {
                // TODO #17 versioning - support message renaming. We will allow to rename not before we have the history that can keep track of name changes
                // localizedLabelManager.updateMessage(message.id, {
                //   variants: [],
                //   name: messageName,
                // });
              }}
              text={messageId}
            /> */}
					</div>
				</div>
				<div className="message-group-header-actions">
					{select === undefined && (
						<>
							{/* <div
              className="layerIcon iconWrapper button"
              data-tooltip-content="Delete this translation key"
              onClick={() => {
                // copy
              }}
            >
              <span className="svg-container copy-svg" />
            </div> */}
							<div
								className="layerIcon iconWrapper button"
								data-tooltip-content="Delete this Message"
								onClick={() => {
									setMessageIdToDelete(message.id);
								}}
							>
								<span className="svg-container trash-svg" />
							</div>
						</>
					)}
				</div>
			</div>
			<div className="message-group-header-sticky-border" />

			{select === undefined ? (
				<InlangEditor
					message={message}
					locales={languages}
					baseLocale={refLanguage!}
					onSave={async (updated) => {
						await localizedLabelManager.updateMessage(updated, {});
						localizedLabelManager.commitUndoWhenIdle();
						setMessage(updated);
					}}
					onTranslate={async (language) => {
						const refVariant = message.variants.find(
							(variant) => variant.languageTag === refLanguage,
						);
						if (!refVariant) return;
						try {
							// the same machine translation (and quota, if there is one) as switching a frame to a language
							const translation = await TranslatorMachine.instance.translate(
								MessageStoreMemory.patternToHtml(refVariant.pattern),
								refLanguage!,
								language as Locale,
								true,
							);
							if (translation) {
								const updated = MessageStoreMemory.upsertVariantPatternHtml(
									message,
									undefined,
									language as Locale,
									[],
									translation,
								);
								await localizedLabelManager.updateMessage(updated, {});
								localizedLabelManager.commitUndoWhenIdle();
								setMessage(updated);
							}
						} catch (e: any) {
							if (!(e instanceof NoMoreTranslationsLeftError)) {
								reportError(e);
								figmaRemote.notifyError(
									`Something went wrong with translation - ${e.message}`,
									8000,
								);
							}
						}
					}}
				/>
			) : (
				languages.map((language) => (
					<MessageVariantItem
						key={language}
						language={language}
						refLanguage={refLanguage!}
						localizedLabelManager={localizedLabelManager}
						figmaRemote={figmaRemote}
						messageStore={messageStore}
						searchMatch={searchMatch}
						focusedMessageVariant={focusedMessageVariant}
						message={message}
						select={select}
						onFocus={() => {
							setFocusedMessageVariant({
								messageId: message.id,
								locale: language,
								match: [],
							});
							onFocus?.(message.id, language, []);
						}}
						onBlur={() => {
							setFocusedMessageVariant(undefined);
							onBlur?.(message.id, language, []);
						}}
					/>
				))
			)}
			<Drawer
				position="top"
				buttons={[
					{
						type: "secondary",
						text: "Cancel",
						key: "escape",
						callback: () => {
							// set back to head
							setMessageIdToDelete(undefined);
						},
					},
					{
						type: "primary-destructive",
						text: "Delete message",
						key: "enter",
						disabled: messageIdToDelete === undefined,
						callback: () => {
							localizedLabelManager.deleteMessage(message.id).catch((e: Error) => {
								reportError(e);
								figmaRemote.notifyError(e.message);
							});
							setMessageIdToDelete(undefined);
						},
					},
				]}
				shown={messageIdToDelete !== undefined}
			>
				<div className="drawer-header">Delete message?</div>
				<div className="drawer-body">
					{keyToDeleteReferences !== undefined && keyToDeleteReferences > 0 && (
						<p>
							<b>{message.id}</b> is linked to {keyToDeleteReferences} text{" "}
							{keyToDeleteReferences === 1 ? "layer" : "layers"}. Deleting it unlinks{" "}
							{keyToDeleteReferences === 1 ? "that layer" : "those layers"}. The text on the canvas
							stays as it is.
						</p>
					)}
					{keyToDeleteReferences === 0 && (
						<p>
							<b>{message.id}</b> is not linked to any text layer. All of its translations will be
							deleted.
						</p>
					)}
					{keyToDeleteReferences === undefined && <p>Checking where {message.id} is used…</p>}
				</div>
			</Drawer>
		</div>
	);
}

// The list re-renders on every edit; a row only has to render again when its own props or message change.
export default React.memo(TranslationKeyListItem);
