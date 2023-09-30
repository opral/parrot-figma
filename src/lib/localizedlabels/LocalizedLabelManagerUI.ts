import blake from 'blakejs';

import { Message, getVariant } from '@inlang/sdk';
import { MessageLinkState, LocalizedLabel } from './LocalizedLabel';
import { Plural } from '../message/variants/Plural';
import LocalizedLabelManager, { SandboxUpdateLabelProperties } from './LocalizedLabelManager';
import { Locale } from '../message/variants/Locale';
import MessageStoreMemory from '../message/store/MessageStoreMemory';
import ChangeEvent from './ChangeEvent';

import { ILocalizedLabelManagerUI, UILocalizedLabel } from './UILocalizedLabel';
import { Fillins, MessageEntry } from '../message/Message';
import LinksLoadedEvent from './LinksLoadedEvent';
import { ImportMessage } from '../import/ImportMessage';
import { Gender } from '../message/variants/Gender';

export default class LocalizedLabelManagerUI extends EventTarget implements ILocalizedLabelManagerUI {
  // mapping from nodeId to localizied label instance
  private cachedLocalisedLabels = {} as {
    [labelId: string]: UILocalizedLabel
  };

  // cached root frames containing localized labels
  private cachedFrames = {} as { [rootFrameId: string]: {
    frameId: string,
    frameName?: string,
    localizedLabelIds: Set<string>
  } };

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
    let stateDiffers = true;

    const cachedLabel = this.cachedLocalisedLabels[label.nodeId];
    if (cachedLabel) {
      rootFrameDiffers = false;
      stateDiffers = false;

      if (cachedLabel.state!.modified !== label.state!.modified) {
        stateDiffers = true;
      }

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
      } else if (!force && !stateDiffers
          && cachedLabel.derivedKey === label.derivedKey
          && cachedLabel.height === label.height
          && cachedLabel.messageId === label.messageId
          && cachedLabel.messageLinkState === label.messageLinkState
          && cachedLabel.language === label.language
          && cachedLabel.name === label.name
          && cachedLabel.nodeId === label.nodeId
          && cachedLabel.pageId === label.pageId
          && cachedLabel.pageName === label.pageName
          && cachedLabel.rootFrameId === label.rootFrameId
          && cachedLabel.rootFrameLanguage === label.rootFrameLanguage
          && cachedLabel.rootFrameName === label.rootFrameName
          && cachedLabel.characters === label.characters
          && cachedLabel.width === label.width
          && cachedLabel.labelStyle.bold === label.labelStyle.bold
          && cachedLabel.labelStyle.fontFamily === label.labelStyle.fontFamily
          && cachedLabel.labelStyle.italic === label.labelStyle.italic
          && cachedLabel.labelStyle.textDecoration === label.labelStyle.textDecoration
          && JSON.stringify(cachedLabel.ops) === JSON.stringify(label.ops)
          && JSON.stringify(cachedLabel.fillins) === JSON.stringify(label.fillins)
          && JSON.stringify(cachedLabel.matchingLabelLints) === JSON.stringify(label.matchingLabelLints)
          && cachedLabel.x === label.x
          && cachedLabel.y === label.y) {
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

  constructor(localizedLabelMangerSandbox: LocalizedLabelManager, messageStore: MessageStoreMemory) {
    super();
    this.localizedLabelMangerSandbox = localizedLabelMangerSandbox;
    this.messageStore = messageStore;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'LocalizedLabelManager') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          this.processCacheUpdate(event.data.pluginMessage as ChangeEvent);
        }
        if (event.data.pluginMessage.type === 'linksLoaded') {
          this.onKeyLabelLinksLoaded(event.data.pluginMessage as LinksLoadedEvent);
        }
      }
    });

    this.messageStore.addEventListener('updated', (changesEvent: any) => {
      // TODO #14 reactiveness - how do i update label cache? do i subscribe per label? how do i unsubscribe - when is this needed?
      // for (const changedKey of changesEvent.detail.changedKeys) {
      //   this.handleMessageUpdate(changedKey);
      // }
    });
  }

  onKeyLabelLinksLoaded(event: LinksLoadedEvent) {
    this.messageStore.updateMessageLinks(event.keys);
  }

  framesIdToLoad = [] as string[];

  async prepare() {
    await this.localizedLabelMangerSandbox.prepare();
  }

  async startFillupCache() {
    // we don't await this promise since it will fill the cache in the background
    this.localizedLabelMangerSandbox.startFillupCache();
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
      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
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
      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
    }
  }

  async updateUnpinnedLabelsWithKey(key: string) {
    const labelsLinkedToMessage = await this.getWithMessage(key);

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
    const labelsWithMessage = await this.localizedLabelMangerSandbox.getWithMessage(messageId);
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
      return [...this.cachedFrames[frameId].localizedLabelIds].map((labelId) => this.cachedLocalisedLabels[labelId]!);
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

    return [...this.cachedFrames[frameId].localizedLabelIds].map((labelId) => this.cachedLocalisedLabels[labelId]!);
  }

  async setFrameLanguage(frameId: string, targetLanguage: Locale, missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | null>) {
    const version = undefined as undefined | number; // todo fill with fixed version of the frame if set

    await this.localizedLabelMangerSandbox.updateFrameProperties(frameId, {
      language: targetLanguage,
    });

    for (const localizedLabelId of this.cachedFrames[frameId].localizedLabelIds) {
      const localizedLabel = this.cachedLocalisedLabels[localizedLabelId]!;
      // eslint-disable-next-line no-await-in-loop
      await this.setLabelLanguage(localizedLabel, targetLanguage, missingTranslationProvider);
    }

    // await this.localizedLabelMangerSandbox.updateFrameById(frameId);
  }

  async updateMessage(message: Message, defaultFillins: Fillins) {
    await this.messageStore.upsertMessage(message, defaultFillins);

    await this.updateUnpinnedLabelsWithKey(message.id);
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Locale,
    // TODO #17 versioning
    // version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | null>,
  ) {
    (new UILocalizedLabel(this, cachedLabel)).setLanguage(targetLanguage, missingTranslationProvider);
  }

  async createNewVersionFromLabelState(localizedLabel: UILocalizedLabel) {
    const messageToUpdate = this.messageStore.getMessage(localizedLabel.messageId!)!;
    const updatedMessage = MessageStoreMemory.upsertVariantPatternHtml(messageToUpdate, undefined, localizedLabel.language, {}, localizedLabel.currentPatternHTML);
    this.updateMessage(updatedMessage, {});

    // await this.updateUnpinnedLabelsWithKey(localizedLabel.messageId!);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async fixLabelLints(localizedLabel: LocalizedLabel, lintsToFix: string[]) {
    await this.localizedLabelMangerSandbox.fixLabelLints(localizedLabel.nodeId, lintsToFix);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToMessageHead(localizedLabels: LocalizedLabel[]) {
    const updatePromises = [];
    for (const localizedLabel of localizedLabels) {
      const message = this.messageStore.getMessage(localizedLabel.messageId!)!;
      
      // TODO #17 versioning implement when inlang history is in place
      // const historyEntryForVersion = message.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.genderId, localizedLabel.pluralId, message.latestVersion);

      // const fillins = { ...localizedLabel.fillins };
      // for (const placeholderName of Object.keys(message.defaultFillins)) {
      //   if ((!fillins[placeholderName] || fillins[placeholderName].default) && message.defaultFillins[placeholderName]) {
      //     fillins[placeholderName] = {
      //       default: true,
      //       value: message.defaultFillins[placeholderName].value ?? 'Lorem ipsum',
      //     };
      //   }
      // }

      // console.log('updateToLatestKeyVersion: ' +  historyEntryForVersion!.variants?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text);

      // eslint-disable-next-line no-await-in-loop
      updatePromises.push(this.updateLabelProperties(localizedLabel.nodeId, {
        // messageVersion: message.latestVersion,
        messageId: localizedLabel.messageId!,
        language: localizedLabel.rootFrameLanguage,
      }));
    }

    console.log('started');
    await Promise.all(updatePromises).then(() => console.log('finished') );
  }

  async deleteMessage(messageId: string) {
    await this.unlinkLabelsWithKey(messageId);
    await this.messageStore.deleteMessage(messageId);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async unlinkLabelsWithKey(keyToUnlink: string) {
    const labelsWithKey = await this.getWithMessage(keyToUnlink);

    for (const labelWithKey of labelsWithKey) {
      // eslint-disable-next-line no-await-in-loop
      await this.updateLabelProperties(labelWithKey.nodeId, {
        messageId: null,
      });
    }
  }

  async linkMessage(localizedLabel: UILocalizedLabel, messageNameToLinkTo: string, locale: Locale) {
    let message = this.messageStore.getMessageByName(messageNameToLinkTo);

    if (message !== undefined) {
      // message does exist - we only have to link it
      await this.updateLabelProperties(localizedLabel.nodeId, {
        messageId: message.id,
        language: locale,
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      if (localizedLabel.unlinkedMessage) {
        // TODO #13 check if we need to update the unlinked message
        // eslint-disable-next-line no-param-reassign
        localizedLabel.unlinkedMessage.id = messageNameToLinkTo;
        message = await this.messageStore.upsertMessage(localizedLabel.unlinkedMessage, localizedLabel.fillins);
      } else {
        message = await this.messageStore.upsertMessage({
          id: messageNameToLinkTo,
          selectors: [],
          variants: [{
            match: {},
            languageTag: locale,
            pattern: [
              { type: 'Text', value: localizedLabel.currentPatternHTML },
            ],
          }],
        }, localizedLabel.fillins);
      }

      await this.updateLabelProperties(localizedLabel.nodeId, {
        messageId: message.id,
        // messageVersion: message.latestVersion, // its save to use latest version here since we created a whole new key here.
        language: locale,
      });
    }

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async unsetLabel(localizedLabel: LocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      messageId: null,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async commitUndo() {
    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelFillin(localizedLabel: LocalizedLabel, placeholderName: string, fillinValue: string) {
    const newFillins = {
      ...localizedLabel.fillins, // Copy the old fields
    };

    newFillins[placeholderName] = { value: fillinValue, default: fillinValue === '' };
    await this.updateLabelProperties(localizedLabel.nodeId, {
      fillins: newFillins,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelName(localizedLabel: LocalizedLabel, labelName: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      labelName,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelPatternHtml(localizedLabel: UILocalizedLabel, patternHtml: string, fillins: Fillins) {
    if (localizedLabel.messageLinkState === MessageLinkState.Unmanaged
      || localizedLabel.messageLinkState === MessageLinkState.MissingMessage) {
      // ignore field should be disabled
      return;
    }

    localizedLabel.setLabelPattern(patternHtml, fillins);

    if (localizedLabel.messageLinkState === MessageLinkState.Linked) {
      // update only the patternHTML on the label - updating the message is an explicit action
    } else if (localizedLabel.messageLinkState === MessageLinkState.Unset) {
      // TODO create unlinked message
    } else if (localizedLabel.messageLinkState === MessageLinkState.Unlinked) {
      // TODO update unlinked message in place
    }
  }

  /**
   * Updates the label with the given nodeId with provided changes and updates the cache
   * @param nodeId
   * @param changedProperties
   */
  async updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    // messageLinkState?: MessageLinkState,
    messageId?: string | null,
    unmanaged?: boolean,
    unlinkedMessage?: Message,
    language?: Locale | null,
    variantPatternHTML?: string,
    // TODO #14 add variables when we have variables other than strings
    fillins?: Fillins,
    variantPatternHTMLHash?: string
  }) {
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;

    const labelFillins = changedProperties.fillins ?? localizedLabelCached.fillins;
    const language = changedProperties.language ?? localizedLabelCached.language;

    // TODO #14 XXX source variables when avaialble
    // if (message?.defaultFillins) {
    //   for (const [placeholderName, fillin] of Object.entries(message.defaultFillins)) {
    //     if (!labelFillins[placeholderName] || labelFillins[placeholderName].default === true) {
    //       labelFillins[placeholderName] = fillin;
    //     }
    //   }
    // }

    const changedPropertiesToForwared = changedProperties as SandboxUpdateLabelProperties;

    if (changedProperties.messageId) {
      changedPropertiesToForwared.fillins = localizedLabelCached.getFillins(changedProperties.messageId, labelFillins);
    }

    const updatedMessage = changedProperties.messageId ? this.messageStore.getMessage(changedProperties.messageId) : changedProperties.unlinkedMessage;
    if (changedProperties.variantPatternHTML) {
      // the variant pattern in the label have changed
      const textAndOps = UILocalizedLabel.toTextAndOps(changedProperties.variantPatternHTML, labelFillins);

      // TODO handle placeholders
      changedPropertiesToForwared.ops = textAndOps.ops;
      changedPropertiesToForwared.characters = textAndOps.text;
      changedPropertiesToForwared.variantPatternHTMLHash = blake.blake2sHex(changedProperties.variantPatternHTML);
    } else if (updatedMessage) {
      // TODO update label based on the passed message - calculate new text ops and hash
      const variantHTML = MessageStoreMemory.htmlForPattern(updatedMessage!, language, {});
      const textAndOps = UILocalizedLabel.toTextAndOps(variantHTML, labelFillins);

      // TODO handle placeholders
      changedPropertiesToForwared.ops = textAndOps.ops;
      changedPropertiesToForwared.characters = textAndOps.text;
      changedPropertiesToForwared.variantPatternHTMLHash = blake.blake2sHex(variantHTML);
    } else if (changedProperties.messageId !== null) {
      const message = localizedLabelCached.messageId ? this.messageStore.getMessage(localizedLabelCached.messageId) : localizedLabelCached.unlinkedMessage;
      // TODO also take into account changes in the labels variables...
      if (message && changedProperties.language !== undefined) {
        // TODO update label based on the passed message - calculate new text ops and hash
        const variantHTML = MessageStoreMemory.htmlForPattern(updatedMessage!, language, {});
        const textAndOps = UILocalizedLabel.toTextAndOps(variantHTML, labelFillins);

        // TODO handle placeholders

        changedPropertiesToForwared.ops = textAndOps.ops;
        changedPropertiesToForwared.characters = textAndOps.text;
        changedPropertiesToForwared.variantPatternHTMLHash = blake.blake2sHex(variantHTML);
      }
    }

    let localizedLabel: LocalizedLabel | undefined;
    try {
      localizedLabel = await this.localizedLabelMangerSandbox.updateLabelProperties(nodeId, changedPropertiesToForwared);
    } finally {
      let forceCacheRefresh = false;
      if (localizedLabel === undefined) {
        localizedLabel = await this.localizedLabelMangerSandbox.getById(nodeId);
        forceCacheRefresh = true;
      }
      if (this.refreshCachedLabel(localizedLabel!, forceCacheRefresh)) {
        const event = new CustomEvent('updated', { });
        this.dispatchEvent(event);
      }
    }
  }

  async getSelection() {
    const selection = await this.localizedLabelMangerSandbox.getSelection();
    return selection;
  }

  async import(keysToImport: ImportMessage[], locale: Locale) {
    function toChangeArray(importKey: ImportMessage, languageToUse: Locale) {
      return [{
        locale: languageToUse,
        gender: importKey.gender,
        plural: importKey.plural,
        text: importKey.text,
        skip: false,
      }] as { locale: Locale; gender: Gender, plural: Plural; text: string | undefined; skip: boolean }[];
    }

    for (const keyToImport of keysToImport) {
      const currentKey = this.messageStore.getMessageByName(keyToImport.name);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log(`creating key${keyToImport.name}`);
        // TODO #8 implement import logic for placeholders and quantities
        // eslint-disable-next-line no-await-in-loop
        // TODO #14 import/export add importing via inlang
        // await this.messageStore.createMessage(keyToImport.name, toChangeArray(keyToImport, locale), false, false);
      } else {
        console.log(`updateing key${keyToImport.name}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-await-in-loop
        // TODO #14 import/export add importing via inlang
        // await this.updateMessage(currentKey.id, { variants: toChangeArray(keyToImport, locale) });
      }
    }
  }
}
