import { mergeImportedMessage } from "../message/store/LegacyMessageBundleConverter";
import blake from "blakejs";
import {
	createVariant,
	getVariant,
	updateVariantPattern,
	type Message,
} from "../message/LegacyMessage";
import { MessageLinkState, LocalizedLabel } from "./LocalizedLabel";
import { Plural } from "../message/variants/Plural";
import LocalizedLabelManager, { SandboxUpdateLabelProperties } from "./LocalizedLabelManager";
import { Locale } from "../message/variants/Locale";
import MessageStoreMemory from "../message/store/MessageStoreMemory";
import ChangeEvent from "./ChangeEvent";

import { ILocalizedLabelManagerUI, UILocalizedLabel } from "./UILocalizedLabel";
import LinksLoadedEvent from "./LinksLoadedEvent";
import { ImportMessage } from "../import/ImportMessage";
import { Gender } from "../message/variants/Gender";
import { FillinToPlaceholder, MessageExtension, Parameter } from "../message/MessageExtnesions";
import { MessageParameterValues } from "../message/MessageParameterValues";
import MessageImporter from "../import/MessageImporter";
import TranslatorMachine from "../translationprovider/TranslatorMachine";
import { capture } from "../telemetry/Telemetry";
import { isMachineTranslationUnavailable } from "../translationprovider/MachineTranslationContact";
import FigmaUtil from "../../shared/FigmaUtil";

const UNDO_COMMIT_IDLE_MS = 800;

type LabelPropertyChanges = {
	labelName?: string;
	messageState?:
		| {
				type: "linked";
				messageId: string;
				parameterValues: MessageParameterValues;
				variantPatternHTML?: string;
		  }
		| { type: "unlinked"; unlinkedMessage: Message; parameterValues: MessageParameterValues }
		| { type: "unmanaged"; unmanaged: boolean }
		| { type: "unset" }
		| undefined;
	language?: Locale;
};

export default class LocalizedLabelManagerUI
	extends EventTarget
	implements ILocalizedLabelManagerUI
{
	// mapping from nodeId to localizied label instance
	private cachedLocalisedLabels = {} as {
		[labelId: string]: UILocalizedLabel;
	};

	// cached root frames containing localized labels
	private cachedFrames = {} as {
		[rootFrameId: string]: {
			frameId: string;
			frameName?: string;
			localizedLabelIds: Set<string>;
		};
	};

	/**
	 * Operations that rewrite the layers of a frame (language switch, linking/unlinking a layer, fixing
	 * styles) run one after the other per frame. Otherwise a language switch that starts while a link is
	 * still being written reads the layer as unlinked and the two writes overwrite each other (blank or
	 * unlinked layers).
	 */
	private frameOperations = new Map<string, Promise<unknown>>();

	private runFrameOperation<T>(frameId: string, operation: () => Promise<T>): Promise<T> {
		return this.runFramesOperation([frameId], operation);
	}

	/** One operation over several frames: waits for the running operations of all of them. */
	private runFramesOperation<T>(frameIds: string[], operation: () => Promise<T>): Promise<T> {
		const previous = Promise.all(
			frameIds.map((frameId) =>
				(this.frameOperations.get(frameId) ?? Promise.resolve()).catch(() => undefined),
			),
		);
		const current = previous.then(operation);
		for (const frameId of frameIds) {
			this.frameOperations.set(frameId, current);
		}
		const cleanup = () => {
			for (const frameId of frameIds) {
				if (this.frameOperations.get(frameId) === current) {
					this.frameOperations.delete(frameId);
				}
			}
		};
		current.then(cleanup, cleanup);
		return current;
	}

	private removeCachedLabel(labelId: string) {
		const cachedLabel = this.cachedLocalisedLabels[labelId];

		if (!cachedLabel) {
			return false;
		}

		delete this.cachedLocalisedLabels[labelId];

		if (this.cachedFrames[cachedLabel.rootFrameId]) {
			this.cachedFrames[cachedLabel.rootFrameId].localizedLabelIds.delete(labelId);
		}

		// if (cachedLabel.key && this.keysToCachedLabels[cachedLabel.key]) {
		//   this.keysToCachedLabels[cachedLabel.key].delete(cachedLabel.nodeId);
		// }

		return true;
	}

	/**
	 * @param label the label to create a cache entry for or refresh the existing one
	 * @returns true if a refresh was needed
	 */
	private refreshCachedLabel(labelToCache: LocalizedLabel, force = false) {
		const label = new UILocalizedLabel(this, labelToCache);

		// flag that signals if the parents of a node have changed (it was moved to another parent for example)
		let rootFrameDiffers = true;

		const cachedLabel = this.cachedLocalisedLabels[label.nodeId];
		if (cachedLabel) {
			rootFrameDiffers = false;
			const stateDiffers = cachedLabel.state!.modified !== label.state!.modified;

			if (cachedLabel.rootFrameId !== label.rootFrameId) {
				rootFrameDiffers = true;
			}

			// key the lable referres to changed - remove from keys to labels cache
			// if (label.key !== cachedLabel.key && cachedLabel.key) {
			//   if (this.keysToCachedLabels[cachedLabel.key]) {
			//     this.keysToCachedLabels[cachedLabel.key].delete(cachedLabel.nodeId);
			//   }
			// }

			if (rootFrameDiffers) {
				this.removeCachedLabel(label.nodeId);
			} else if (
				!force &&
				!stateDiffers &&
				cachedLabel.derivedKey === label.derivedKey &&
				cachedLabel.height === label.height &&
				cachedLabel.messageId === label.messageId &&
				cachedLabel.messageLinkState === label.messageLinkState &&
				cachedLabel.language === label.language &&
				cachedLabel.name === label.name &&
				cachedLabel.nodeId === label.nodeId &&
				cachedLabel.pageId === label.pageId &&
				cachedLabel.pageName === label.pageName &&
				cachedLabel.rootFrameId === label.rootFrameId &&
				cachedLabel.rootFrameLanguage === label.rootFrameLanguage &&
				cachedLabel.rootFrameName === label.rootFrameName &&
				cachedLabel.characters === label.characters &&
				cachedLabel.width === label.width &&
				cachedLabel.labelStyle.bold === label.labelStyle.bold &&
				cachedLabel.labelStyle.fontFamily === label.labelStyle.fontFamily &&
				cachedLabel.labelStyle.italic === label.labelStyle.italic &&
				cachedLabel.labelStyle.textDecoration === label.labelStyle.textDecoration &&
				JSON.stringify(cachedLabel.ops) === JSON.stringify(label.ops) &&
				JSON.stringify(cachedLabel.parameterValues) === JSON.stringify(label.parameterValues) &&
				JSON.stringify(cachedLabel.matchingLabelLints) ===
					JSON.stringify(label.matchingLabelLints) &&
				cachedLabel.x === label.x &&
				cachedLabel.y === label.y
			) {
				return false;
			}
		}

		this.cachedLocalisedLabels[label.nodeId] = label;

		// if (label.key !== undefined) {
		//   if (!this.keysToCachedLabels[label.key]) {
		//     this.keysToCachedLabels[label.key] = new Set<string>();
		//   } this.keysToCachedLabels[label.key].add(label.nodeId);
		// }

		if (rootFrameDiffers) {
			if (!this.cachedFrames[label.rootFrameId]) {
				this.cachedFrames[label.rootFrameId] = {
					frameId: label.rootFrameId,
					localizedLabelIds: new Set<string>(),
				};
			}

			if (this.cachedFrames[label.rootFrameId]) {
				this.cachedFrames[label.rootFrameId].localizedLabelIds.add(label.nodeId);
			}
		}

		return true;
	}

	private localizedLabelMangerSandbox: LocalizedLabelManager;

	messageStore: MessageStoreMemory;

	constructor(
		localizedLabelMangerSandbox: LocalizedLabelManager,
		messageStore: MessageStoreMemory,
		figmaRemote: FigmaUtil,
	) {
		super();
		this.localizedLabelMangerSandbox = localizedLabelMangerSandbox;
		this.messageStore = messageStore;

		window.addEventListener("message", (event: MessageEvent) => {
			if (event.data.pluginMessage.target === "LocalizedLabelManager") {
				if (event.data.pluginMessage.type === "cacheUpdate") {
					this.processCacheUpdate(event.data.pluginMessage as ChangeEvent);
				}
				if (event.data.pluginMessage.type === "linksLoaded") {
					this.onKeyLabelLinksLoaded(event.data.pluginMessage as LinksLoadedEvent);
				}
			}
		});

		this.messageStore.addEventListener(MessageStoreMemory.UPDATE_EVENT, (changesEvent: any) => {
			for (const changedKey of changesEvent.detail.changedKeys) {
				this.handleMessageUpdate(changedKey);
			}
		});
	}

	onKeyLabelLinksLoaded(event: LinksLoadedEvent) {
		this.messageStore.updateMessageLinks(event.keys);
		this.dispatchEvent(new CustomEvent("linksLoaded"));
	}

	framesIdToLoad = [] as string[];

	async prepare() {
		await this.localizedLabelMangerSandbox.prepare();
	}

	async startFillupCache() {
		// we don't await this promise since it will fill the cache in the background
		this.localizedLabelMangerSandbox.startFillupCache();
	}

	/** While a bulk update (e.g. switching the language of a frame) runs, "updated" events are held back - it dispatches one when done. */
	private updateBatchDepth = 0;

	/**
	 * Every "updated" event re-renders the whole label list. Bulk updates would do that once per label,
	 * which freezes the panel for frames with many texts - they dispatch a single event when done.
	 */
	private dispatchUpdated() {
		if (this.updateBatchDepth > 0) {
			return;
		}
		this.dispatchEvent(new CustomEvent("updated", {}));
	}

	private handleMessageUpdate(messageId: string) {
		let cacheUpdated = false;

		for (const labelToUpdate of Object.values(this.cachedLocalisedLabels)) {
			if (labelToUpdate.messageId === messageId) {
				if (this.refreshCachedLabel(labelToUpdate)) {
					cacheUpdated = true;
				}
			}
		}

		if (cacheUpdated) {
			this.dispatchUpdated();
		}
	}

	private processCacheUpdate(cacheUpdateMessage: ChangeEvent) {
		let cacheUpdated = false;
		// TODO check if we need to invalidate the frame
		// console.log('processCacheUpdate');
		// console.log(JSON.stringify(cacheUpdateMessage));
		for (const deletedNodeId of cacheUpdateMessage.deletedNodeIds) {
			if (this.removeCachedLabel(deletedNodeId)) {
				// console.log(`label removed: ${JSON.stringify(deleted)}`);
				cacheUpdated = true;
			}
		}

		// console.log('processing created');
		for (const createdLabel of cacheUpdateMessage.createdLabels) {
			if (this.refreshCachedLabel(createdLabel)) {
				// console.log(`label created: ${JSON.stringify(createdLabel)}`);
				cacheUpdated = true;
			}
		}

		// console.log('processing changed');
		for (const changedLabel of cacheUpdateMessage.changedLabels) {
			if (this.refreshCachedLabel(changedLabel)) {
				// console.log(`label changed: ${JSON.stringify(changedLabel)}`);
				cacheUpdated = true;
			}
		}

		if (cacheUpdated) {
			this.dispatchUpdated();
		}
	}

	async updateUnpinnedLabelsWithMessage(messageId: string) {
		const labelsLinkedToMessage = await this.getWithMessage(messageId);

		await this.updateToMessageHead(labelsLinkedToMessage);
	}

	getLabelByNodeId(nodeId: string) {
		return this.cachedLocalisedLabels[nodeId];
	}

	async getById(textNodeId: string) {
		if (!this.cachedLocalisedLabels[textNodeId]) {
			const freshLocalizedLabel = await this.localizedLabelMangerSandbox.getById(textNodeId);
			if (freshLocalizedLabel) {
				this.refreshCachedLabel(freshLocalizedLabel);
			}
		}
		return this.cachedLocalisedLabels[textNodeId];
	}

	async getWithMessage(messageId: string) {
		return this.getWithMessages([messageId]);
	}

	async getWithMessages(messageIds: string[]) {
		const labelsWithMessage = await this.localizedLabelMangerSandbox.getWithMessages(messageIds);
		const uiLabels = [] as UILocalizedLabel[];
		for (const freshLocalizedLabel of labelsWithMessage) {
			this.refreshCachedLabel(freshLocalizedLabel);
			uiLabels.push(this.cachedLocalisedLabels[freshLocalizedLabel.nodeId]);
		}
		return uiLabels;
	}

	async getLocalizedLabelsByFrame(frameId: string) {
		// console.log('getLocalizedLabelsByFrame');
		if (this.cachedFrames[frameId] && this.cachedFrames[frameId].frameName) {
			return [...this.cachedFrames[frameId].localizedLabelIds].map(
				(labelId) => this.cachedLocalisedLabels[labelId]!,
			);
		}

		// console.log(`refreshing frame with id ${frameId}`);
		const frameData = await this.localizedLabelMangerSandbox.getFrameById(frameId);

		this.cachedFrames[frameId] = {
			frameId,
			frameName: frameData.name,
			localizedLabelIds: new Set(frameData.localizedLabelsInFrame.map((node) => node.nodeId)),
		};

		for (const freshLocalizedLabel of frameData.localizedLabelsInFrame) {
			this.refreshCachedLabel(freshLocalizedLabel);
		}

		return [...this.cachedFrames[frameId].localizedLabelIds].map(
			(labelId) => this.cachedLocalisedLabels[labelId]!,
		);
	}

	async setFrameLanguage(frameId: string, targetLanguage: Locale, translator: TranslatorMachine) {
		capture("translation:language_update", { frame_count: 1 });
		return this.runFrameOperation(frameId, () =>
			this.applyFrameLanguage(frameId, targetLanguage, translator),
		);
	}

	/** The frames of the current page that "Switch page" changes. */
	async getPageRootFrames() {
		return this.localizedLabelMangerSandbox.getPageRootFrames();
	}

	/**
	 * Switches several frames one after the other - a single undo step. The other frames are still
	 * switched when one fails, the last error is thrown at the end.
	 * @returns the number of layers left unchanged because their styles cannot be translated ("Fix styles")
	 */
	async setFramesLanguage(
		frameIds: string[],
		targetLanguage: Locale,
		translator: TranslatorMachine,
		onProgress?: (doneFrames: number, totalFrames: number) => void,
	) {
		capture("translation:language_update", { frame_count: frameIds.length });
		let lastError: unknown;
		let lockedLabels = 0;
		let untranslatedLabels = 0;
		for (const [index, frameId] of frameIds.entries()) {
			onProgress?.(index, frameIds.length);
			try {
				const result = await this.runFrameOperation(frameId, () =>
					this.applyFrameLanguage(frameId, targetLanguage, translator, false),
				);
				lockedLabels += result.lockedLabels;
				untranslatedLabels += result.untranslatedLabels;
			} catch (e) {
				lastError = e;
			}
		}
		onProgress?.(frameIds.length, frameIds.length);
		await this.localizedLabelMangerSandbox.commitUndo();

		if (lastError) {
			throw lastError;
		}
		return { lockedLabels, untranslatedLabels };
	}

	/**
	 * @returns the number of layers left unchanged because their styles cannot be translated, and of
	 * layers without a text in the language that keep their current text (no machine translation)
	 */
	private async applyFrameLanguage(
		frameId: string,
		targetLanguage: Locale,
		translator: TranslatorMachine,
		commitUndo = true,
	) {
		let lastError: undefined | Error;
		let untranslatedLabels = 0;

		// Hydrate the frame cache here as well as in the view. This keeps the language
		// command safe when it is triggered before the selection list finished loading.
		const localizedLabels = await this.getLocalizedLabelsByFrame(frameId);
		const lockedLabels = localizedLabels.filter(
			(label) =>
				(label.matchingLabelLints?.length ?? 0) > 0 &&
				label.messageLinkState !== MessageLinkState.Unmanaged,
		).length;
		this.updateBatchDepth = (this.updateBatchDepth ?? 0) + 1;
		try {
			for (const localizedLabel of localizedLabels) {
				try {
					await this.setLabelLanguage(
						localizedLabel,
						targetLanguage,
						translator,
						false,
						false /** CTA is triggered not every time */,
					);
				} catch (e: any) {
					if (isMachineTranslationUnavailable(e)) {
						untranslatedLabels += 1;
					} else {
						lastError = e;
					}
				}
			}
		} finally {
			this.updateBatchDepth -= 1;
		}

		await this.localizedLabelMangerSandbox.updateFrameProperties(frameId, {
			language: targetLanguage,
		});
		if (this.cachedFrames[frameId]) {
			this.cachedFrames[frameId].frameName = undefined;
		}
		await this.getLocalizedLabelsByFrame(frameId);
		this.dispatchEvent(new CustomEvent("updated", {}));

		// one language switch = one undo step (otherwise Cmd+Z reverts everything since the last commit)
		if (commitUndo) {
			await this.localizedLabelMangerSandbox.commitUndo();
		}

		if (lastError) {
			throw lastError;
		}
		return { lockedLabels, untranslatedLabels };
	}

	async updateMessage(message: Message, defaultParameters: MessageParameterValues) {
		await this.messageStore.upsertMessage(message, defaultParameters);

		await this.updateUnpinnedLabelsWithMessage(message.id);
	}

	async setLabelLanguage(
		cachedLabel: LocalizedLabel,
		targetLanguage: Locale,
		// TODO #17 versioning
		// version: number | undefined,
		translator: TranslatorMachine,
		enforceTranslation: boolean,
		triggersCTA: boolean,
	) {
		return new UILocalizedLabel(this, cachedLabel).setLanguage(
			targetLanguage,
			translator,
			enforceTranslation,
			triggersCTA,
		);
	}

	async createNewVersionFromLabelState(localizedLabel: UILocalizedLabel) {
		const messageToUpdate = this.messageStore.getMessage(localizedLabel.messageId!)!;
		const updatedMessage = MessageStoreMemory.upsertVariantPatternHtml(
			messageToUpdate,
			undefined,
			localizedLabel.language,
			[],
			localizedLabel.currentPatternHTML,
		);
		this.updateMessage(updatedMessage, {});

		// await this.updateUnpinnedLabelsWithKey(localizedLabel.messageId!);

		await this.localizedLabelMangerSandbox.commitUndo();
	}

	async fixLabelLints(localizedLabel: LocalizedLabel, lintsToFix: string[]) {
		await this.runFrameOperation(localizedLabel.rootFrameId, async () => {
			await this.localizedLabelMangerSandbox.fixLabelLints(localizedLabel.nodeId, lintsToFix);

			await this.localizedLabelMangerSandbox.commitUndo();
		});
	}

	async updateToMessageHead(localizedLabels: LocalizedLabel[]) {
		const updatePromises = [];
		for (const localizedLabel of localizedLabels) {
			const message = this.messageStore.getMessage(localizedLabel.messageId!)!;

			// TODO #17 versioning implement when inlang history is in place
			// const historyEntryForVersion = message.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.genderId, localizedLabel.pluralId, message.latestVersion);

			updatePromises.push(
				this.updateLabelProperties(localizedLabel.nodeId, {
					messageState: {
						type: "linked",
						messageId: localizedLabel.messageId!,
						parameterValues: localizedLabel.parameterValues,
					},
					// messageVersion: message.latestVersion,
					language: localizedLabel.rootFrameLanguage,
				}),
			);
		}

		// console.log('started');
		await Promise.all(updatePromises).then(() => console.log("finished"));
	}

	async deleteMessage(messageId: string) {
		console.log(`DELETING ${messageId}`);
		await this.messageStore.deleteMessage(messageId);
		console.log(`unlinking message ${messageId}`);
		await this.unlinkLabelsWithMessage(messageId);
		console.log(`DELETING done ${messageId}`);

		await this.localizedLabelMangerSandbox.commitUndo();
	}

	async unlinkLabelsWithMessage(messageId: string) {
		const messageToUnlink = await this.messageStore.getMessage(messageId);
		const labelsWithLinkToMessage = await this.getWithMessage(messageId);

		for (const labelWithLinkToMessage of labelsWithLinkToMessage) {
			if (messageToUnlink !== undefined) {
				await this.updateLabelProperties(labelWithLinkToMessage.nodeId, {
					messageState: {
						type: "unlinked",
						unlinkedMessage: messageToUnlink,
						parameterValues: labelWithLinkToMessage.parameterValues,
					},
				});
			} else {
				await this.updateLabelProperties(labelWithLinkToMessage.nodeId, {
					messageState: { type: "unset" },
				});
			}
		}
	}

	async linkMessage(localizedLabel: UILocalizedLabel, messageNameToLinkTo: string, locale: Locale) {
		capture("messages:link_create", {
			source: "manual",
			layer_count: 1,
			new_message_count: this.messageStore.getMessageByName(messageNameToLinkTo) ? 0 : 1,
		});
		await this.runFrameOperation(localizedLabel.rootFrameId, async () => {
			// The layer may have changed while this link waited for an earlier operation of the frame
			// (e.g. a language switch): link the layer as it is now.
			const label = this.cachedLocalisedLabels[localizedLabel.nodeId] ?? localizedLabel;
			await this.applyLinkMessage(label, messageNameToLinkTo, label.rootFrameLanguage ?? locale);
		});
		this.dispatchEvent(
			new CustomEvent("labelLinked", {
				detail: { nodeId: localizedLabel.nodeId, messageName: messageNameToLinkTo },
			}),
		);
	}

	/**
	 * Unlinked layers on the current page with exactly the same text as the given layer, in a frame of
	 * the same language - the layers that can be linked to the same message.
	 */
	async findUnlinkedLabelsWithSameText(nodeId: string) {
		const label = this.cachedLocalisedLabels[nodeId];
		if (!label || label.characters.trim() === "") return [];

		const candidates = await this.localizedLabelMangerSandbox.findLabelsWithText(label.characters, [
			nodeId,
		]);
		const matches = [] as UILocalizedLabel[];
		for (const candidate of candidates) {
			this.refreshCachedLabel(candidate);
			const cached = this.cachedLocalisedLabels[candidate.nodeId];
			if (
				cached &&
				(cached.messageLinkState === MessageLinkState.Unset ||
					cached.messageLinkState === MessageLinkState.Unlinked) &&
				cached.rootFrameLanguage === label.rootFrameLanguage &&
				cached.matchingLabelLints.length === 0
			) {
				matches.push(cached);
			}
		}
		return matches;
	}

	/** Links all given layers to an existing message - a single undo step. */
	async linkLabelsToMessage(labels: UILocalizedLabel[], messageName: string) {
		await this.linkLabelsToMessages(
			labels.map((label) => ({ label, messageName })),
			"identical_texts",
		);
	}

	/**
	 * Links every layer to its message, creating messages that do not exist yet from the layer text -
	 * a single undo step.
	 */
	async linkLabelsToMessages(
		links: { label: UILocalizedLabel; messageName: string }[],
		source: "generate_keys" | "auto_link" | "identical_texts",
	) {
		capture("messages:link_create", {
			source,
			layer_count: links.length,
			new_message_count: new Set(
				links
					.map((link) => link.messageName)
					.filter((name) => !this.messageStore.getMessageByName(name)),
			).size,
		});
		const frameIds = [...new Set(links.map((link) => link.label.rootFrameId))];
		// the views refresh once at the end instead of once per layer
		this.updateBatchDepth = (this.updateBatchDepth ?? 0) + 1;
		try {
			await this.runFramesOperation(frameIds, async () => {
				const updates = [] as { nodeId: string; changedProperties: LabelPropertyChanges }[];
				for (const { label: linkLabel, messageName } of links) {
					const label = this.cachedLocalisedLabels[linkLabel.nodeId] ?? linkLabel;
					const message = await this.ensureMessageForLabel(
						label,
						messageName,
						label.rootFrameLanguage,
					);
					updates.push({
						nodeId: label.nodeId,
						changedProperties: {
							messageState: {
								type: "linked",
								messageId: message.id,
								parameterValues: label.parameterValues,
							},
							language: label.rootFrameLanguage,
						},
					});
				}
				await this.updateLabelsProperties(updates);
			});
		} finally {
			this.updateBatchDepth -= 1;
			this.dispatchEvent(new CustomEvent("updated", {}));
		}
		await this.localizedLabelMangerSandbox.commitUndo();
	}

	/** Layers that can be linked: not linked yet, translated, not locked by "Fix styles", with text. */
	private isLinkable(label: UILocalizedLabel) {
		return (
			(label.messageLinkState === MessageLinkState.Unset ||
				label.messageLinkState === MessageLinkState.Unlinked) &&
			label.matchingLabelLints.length === 0 &&
			label.characters.trim() !== ""
		);
	}

	/**
	 * The layers of the current page that can be linked to a message. `texts` (whitespace collapsed)
	 * limits the search to layers with one of these texts - much faster on large pages.
	 */
	async getLinkableLabelsOnPage(texts?: string[]) {
		const labels = await this.localizedLabelMangerSandbox.getPageLabels({
			unlinkedOnly: true,
			texts,
		});
		const linkable = [] as UILocalizedLabel[];
		for (const label of labels) {
			this.refreshCachedLabel(label);
			const cached = this.cachedLocalisedLabels[label.nodeId];
			if (cached && this.isLinkable(cached)) linkable.push(cached);
		}
		return linkable;
	}

	/** The layers of a frame that can be linked to a message. */
	async getLinkableLabelsInFrame(frameId: string) {
		const labels = await this.getLocalizedLabelsByFrame(frameId);
		return labels.filter((label) => this.isLinkable(label));
	}

	/** The message with this name - created from the text of the layer if it does not exist yet. */
	private async ensureMessageForLabel(
		localizedLabel: UILocalizedLabel,
		messageName: string,
		locale: Locale,
	) {
		const message = this.messageStore.getMessageByName(messageName);
		if (message !== undefined) {
			return message;
		}
		if (localizedLabel.unlinkedMessage) {
			localizedLabel.unlinkedMessage.id = messageName;
			return this.messageStore.upsertMessage(
				localizedLabel.unlinkedMessage,
				localizedLabel.parameterValues,
			);
		}
		return this.messageStore.upsertMessage(
			{
				id: messageName,
				selectors: [],
				variants: [
					{
						match: [],
						languageTag: locale,
						pattern: [{ type: "Text", value: localizedLabel.currentPatternHTML }],
					},
				],
			},
			localizedLabel.parameterValues,
		);
	}

	private async applyLinkMessage(
		localizedLabel: UILocalizedLabel,
		messageNameToLinkTo: string,
		locale: Locale,
		commitUndo = true,
	) {
		let message = this.messageStore.getMessageByName(messageNameToLinkTo);

		if (message !== undefined) {
			// message does exist - we only have to link it
			await this.updateLabelProperties(localizedLabel.nodeId, {
				messageState: {
					type: "linked",
					messageId: message.id,
					parameterValues: localizedLabel.parameterValues,
				},
				language: locale,
			});
		} else {
			if (localizedLabel.unlinkedMessage) {
				localizedLabel.unlinkedMessage.id = messageNameToLinkTo;
				message = await this.messageStore.upsertMessage(
					localizedLabel.unlinkedMessage,
					localizedLabel.parameterValues,
				);
			} else {
				message = await this.messageStore.upsertMessage(
					{
						id: messageNameToLinkTo,
						selectors: [],
						variants: [
							{
								match: [],
								languageTag: locale,
								pattern: [{ type: "Text", value: localizedLabel.currentPatternHTML }],
							},
						],
					},
					localizedLabel.parameterValues,
				);
			}

			await this.updateLabelProperties(localizedLabel.nodeId, {
				messageState: {
					type: "linked",
					messageId: message.id,
					parameterValues: localizedLabel.parameterValues,
				},
				// messageVersion: message.latestVersion, // its save to use latest version here since we created a whole new key here.
				language: locale,
			});
		}

		if (commitUndo) {
			await this.localizedLabelMangerSandbox.commitUndo();
		}
	}

	async unsetLabel(localizedLabel: LocalizedLabel) {
		await this.runFrameOperation(localizedLabel.rootFrameId, async () => {
			await this.updateLabelProperties(localizedLabel.nodeId, {
				messageState: { type: "unset" },
			});

			await this.localizedLabelMangerSandbox.commitUndo();
		});
	}

	async setLabelToUnmanaged(localizedLabel: LocalizedLabel) {
		await this.runFrameOperation(localizedLabel.rootFrameId, async () => {
			await this.updateLabelProperties(localizedLabel.nodeId, {
				messageState: { type: "unmanaged", unmanaged: true },
			});

			await this.localizedLabelMangerSandbox.commitUndo();
		});
	}

	async commitUndo() {
		await this.localizedLabelMangerSandbox.commitUndo();
	}

	private undoCommitTimer: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Editing a message by typing is a burst of small writes without an undo boundary of its own, so a
	 * single Cmd+Z reverted every edit since the last link / language switch. The step is closed once
	 * the typing pauses: Cmd+Z then reverts the last edit only.
	 */
	commitUndoWhenIdle(delayMs = UNDO_COMMIT_IDLE_MS) {
		clearTimeout(this.undoCommitTimer);
		this.undoCommitTimer = setTimeout(() => {
			this.undoCommitTimer = undefined;
			this.commitUndo().catch(() => undefined);
		}, delayMs);
	}

	// TODO #18 add again to allow to change parameter values without touching the message it self
	// async updateLabelFillin(localizedLabel: LocalizedLabel, placeholderName: string, fillinValue: string) {
	//   const newFillins = {
	//     ...localizedLabel.parameterValues, // Copy the old fields
	//   };

	//   newFillins[placeholderName] = { value: fillinValue, default: fillinValue === '' };
	//   await this.updateLabelProperties(localizedLabel.nodeId, {
	//     parameterValues: newFillins,
	//   });

	//   await this.localizedLabelMangerSandbox.commitUndo();
	// }

	async updateLabelName(localizedLabel: LocalizedLabel, labelName: string) {
		await this.updateLabelProperties(localizedLabel.nodeId, {
			labelName,
		});

		await this.localizedLabelMangerSandbox.commitUndo();
	}

	async updateLabelPatternHtml(
		localizedLabel: UILocalizedLabel,
		patternHtml: string,
		parameterValues: MessageParameterValues,
	) {
		if (
			localizedLabel.messageLinkState === MessageLinkState.Unmanaged ||
			localizedLabel.messageLinkState === MessageLinkState.MissingMessage
		) {
			// ignore field should be disabled
			return;
		}

		localizedLabel.setLabelPattern(patternHtml, parameterValues);

		if (localizedLabel.messageLinkState === MessageLinkState.Linked) {
			// update only the patternHTML on the label - updating the message is an explicit action
		} else if (localizedLabel.messageLinkState === MessageLinkState.Unset) {
			// TODO #29 create unlinked message ?
		} else if (localizedLabel.messageLinkState === MessageLinkState.Unlinked) {
			// TODO #29 update unlinked message in place ?
		}
	}

	/** The properties the sandbox writes for a label change: text, styles and plugin data. */
	private toSandboxUpdate(
		nodeId: string,
		changedProperties: LabelPropertyChanges,
	): SandboxUpdateLabelProperties {
		const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;

		const language = changedProperties.language ?? localizedLabelCached.language;

		let textOpsAndFillinsToPlaceholders:
			| {
					ops: any[];
					characters: string;
					fillinsToPlaceholder: FillinToPlaceholder | null | undefined;
			  }
			| undefined;

		let variantPatternHTMLHash: string | undefined;
		if (changedProperties.messageState?.type === "linked") {
			const message = this.messageStore.getMessage(changedProperties.messageState.messageId)!;
			let parameters: Parameter[] | undefined;
			let variantHTML = changedProperties.messageState.variantPatternHTML;
			if (variantHTML !== undefined) {
				parameters = MessageExtension.getParameter(message, {
					locale: localizedLabelCached.language,
					parameterValues: changedProperties.messageState.parameterValues,
					variantHtml: variantHTML,
				});
			} else {
				parameters = MessageExtension.getParameter(message);
			}

			for (const parameter of parameters) {
				if (changedProperties.messageState!.parameterValues[parameter.name] === undefined) {
					changedProperties.messageState!.parameterValues[parameter.name] = {
						type: "string",
						value: parameter.name, // TODO #18 default values have better default values
						default: true,
					};
				}
			}

			if (variantHTML !== undefined) {
				textOpsAndFillinsToPlaceholders = UILocalizedLabel.toTextOpsAndFillinsToPlaceholder(
					variantHTML,
					changedProperties.messageState.parameterValues,
				);
				variantPatternHTMLHash = blake.blake2sHex(variantHTML);
			} else {
				const updatedMessage = this.messageStore.getMessage(
					changedProperties.messageState.messageId,
				);

				/* const bestMatchingVariant = MessageStoreMemory.getBestExistingVariant(
          updatedMessage!,
          language,
          this.messageStore.getLanugages()!,
          [],
        );

        if (bestMatchingVariant === undefined) {
          throw new Error('The given message has no variant at all');
        }

        variantHTML = MessageStoreMemory.patternToHtml(bestMatchingVariant.pattern);
        */
				variantHTML =
					MessageStoreMemory.htmlForPatternWithFallback(
						updatedMessage!,
						language,
						this.messageStore.getRefLanugage(),
						[],
					) ?? "";
				textOpsAndFillinsToPlaceholders = UILocalizedLabel.toTextOpsAndFillinsToPlaceholder(
					variantHTML,
					changedProperties.messageState.parameterValues,
				);
				variantPatternHTMLHash = blake.blake2sHex(variantHTML);

				changedProperties.language = language; // bestMatchingVariant.languageTag as Locale;
			}
			// the variant pattern in the label have changed
		} else if (changedProperties.messageState?.type === "unlinked") {
			const updatedMessage = changedProperties.messageState.unlinkedMessage;

			const variantHTML =
				MessageStoreMemory.htmlForPatternWithFallback(
					updatedMessage!,
					language,
					this.messageStore.getRefLanugage(),
					[],
				) ?? "";

			textOpsAndFillinsToPlaceholders = UILocalizedLabel.toTextOpsAndFillinsToPlaceholder(
				variantHTML,
				changedProperties.messageState.parameterValues,
			);
			variantPatternHTMLHash = blake.blake2sHex(variantHTML);

			changedProperties.language = language;
		}
		// unset will be passed automatically

		return {
			messageState: changedProperties.messageState,
			characters: textOpsAndFillinsToPlaceholders?.characters,
			ops: textOpsAndFillinsToPlaceholders?.ops,
			fillinsToPlaceholder: textOpsAndFillinsToPlaceholders?.fillinsToPlaceholder,
			labelName: changedProperties.labelName,
			language: changedProperties.language,
			// messageVersion:
			variantPatternHTMLHash,
		};
	}

	/**
	 * Updates many labels with a single call into the sandbox (one round trip instead of one per label)
	 * and refreshes the cache once. Labels that fail are skipped, the first error is thrown at the end.
	 */
	async updateLabelsProperties(
		updates: { nodeId: string; changedProperties: LabelPropertyChanges }[],
	) {
		const results = await this.localizedLabelMangerSandbox.updateLabelsProperties(
			updates.map(({ nodeId, changedProperties }) => ({
				nodeId,
				properties: this.toSandboxUpdate(nodeId, changedProperties),
			})),
		);
		let firstError: string | undefined;
		let cacheUpdated = false;
		for (const [index, result] of results.entries()) {
			let label = result.label;
			if (result.error !== undefined) {
				firstError ??= result.error;
				label = await this.localizedLabelMangerSandbox.getById(updates[index].nodeId);
			}
			if (label && this.refreshCachedLabel(label, result.error !== undefined)) {
				cacheUpdated = true;
			}
		}
		if (cacheUpdated) {
			this.dispatchUpdated();
		}
		if (firstError !== undefined) {
			throw new Error(firstError);
		}
	}

	/**
	 * Updates the label with the given nodeId with provided changes and updates the cache
	 * @param nodeId
	 * @param changedProperties
	 */
	async updateLabelProperties(nodeId: string, changedProperties: LabelPropertyChanges) {
		let localizedLabel: LocalizedLabel | undefined;
		try {
			localizedLabel = await this.localizedLabelMangerSandbox.updateLabelProperties(
				nodeId,
				this.toSandboxUpdate(nodeId, changedProperties),
			);
		} finally {
			let forceCacheRefresh = false;
			if (localizedLabel === undefined) {
				localizedLabel = await this.localizedLabelMangerSandbox.getById(nodeId);
				forceCacheRefresh = true;
			}
			if (this.refreshCachedLabel(localizedLabel!, forceCacheRefresh)) {
				this.dispatchUpdated();
			}
		}
	}

	async getSelection() {
		const selection = await this.localizedLabelMangerSandbox.getSelection();
		return selection;
	}

	async import(messagesToImport: Message[], language: Locale) {
		// Validate the entire preview before the first durable write.
		const languageVariants = (message: Message | undefined) =>
			JSON.stringify(message?.variants.filter((variant) => variant.languageTag === language));
		const changedMessageIds = new Set<string>();
		const merged = messagesToImport.map((incoming) => {
			const existing = this.messageStore.getMessage(incoming.id);
			const message = mergeImportedMessage(existing, incoming, language);
			if (languageVariants(existing) !== languageVariants(message))
				changedMessageIds.add(message.id);
			return message;
		});
		for (const message of merged) await this.messageStore.upsertMessage(message, {});

		// Refresh the linked layers once for all changed messages. Only layers that show the imported
		// language can change - looking them up and updating them per message made big imports take minutes.
		if (changedMessageIds.size === 0) return;
		const linkedLabels = await this.getWithMessages([...changedMessageIds]);
		await this.updateToMessageHead(
			linkedLabels.filter(
				(label) => label.language === language || label.rootFrameLanguage === language,
			),
		);
	}
}
