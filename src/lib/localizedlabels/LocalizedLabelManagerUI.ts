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

      if (cachedLabel.state!.behind !== label.state!.behind
        || cachedLabel.state!.modified !== label.state!.modified
        || cachedLabel.state!.orginalTranslationHTML !== label.state!.orginalTranslationHTML) {
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
          && cachedLabel.messageVersion === label.messageVersion
          && cachedLabel.language === label.language
          && cachedLabel.name === label.name
          && cachedLabel.nodeId === label.nodeId
          && cachedLabel.pageId === label.pageId
          && cachedLabel.pageName === label.pageName
          && cachedLabel.genderId === label.genderId
          && cachedLabel.pluralId === label.pluralId
          && cachedLabel.rootFrameId === label.rootFrameId
          && cachedLabel.rootFrameLanguage === label.rootFrameLanguage
          && cachedLabel.rootFrameName === label.rootFrameName
          && cachedLabel.rootFrameUseSampleValues === label.rootFrameUseSampleValues
          && cachedLabel.characters === label.characters
          && cachedLabel.useSampleValues === label.useSampleValues
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
      // TODO #14 reactiveness - how do i update label cache? do i subscribe per label? how do i unsubscribe
      // for (const changedKey of changesEvent.detail.changedKeys) {
      //   this.handleKeyUpdate(changedKey);
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
    const labelsToUpdate = (await this.getWithMessage(key)).filter((label) => label.messageLinkState === MessageLinkState.Linked);

    await this.updateToLatestKeyVersion(labelsToUpdate);
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
      await this.setLabelLanguage(localizedLabel, targetLanguage, version, missingTranslationProvider);
    }

    // await this.localizedLabelMangerSandbox.updateFrameById(frameId);
  }

  async updateMessage(message: Message, defaultFillins: Fillins) {
    await this.messageStore.updateMessage(message, defaultFillins);

    // if (originalKey?.latestVersion !== updatedKey.latestVersion) {
    await this.updateUnpinnedLabelsWithKey(message.id);

    // TODO #14 think about commit
    // this.messageStore.parentKeyStore.commitUndo();
    // }
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Locale,
    version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | null>,
  ) {
    (new UILocalizedLabel(this, cachedLabel)).setLanguage(targetLanguage, version, missingTranslationProvider);
  }

  async createNewVersionFromLabelState(localizedLabel: UILocalizedLabel) {
    // TODO #14 check implementation
    throw new Error('NOT Implemented: createNewVersionFromLabelState');
    // const localizedMessage = await this.messageStore.updateMessage(localizedLabel.messageId!, {
    //   variants: [{
    //     locale: localizedLabel.language as Locale, gender: localizedLabel.genderId, plural: localizedLabel.pluralId as Plural, text: localizedLabel.variantHTML, skip: false,
    //   }],
    //   fillins: localizedLabel.fillins,
    // });

    // TODO #14 update message link state
    // await this.updateLabelProperties(localizedLabel.nodeId, {
    //   messageVersion: localizedKey.latestVersion,
    // });

    await this.updateUnpinnedLabelsWithKey(localizedLabel.messageId!);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async fixLabelLints(localizedLabel: LocalizedLabel, lintsToFix: string[]) {
    await this.localizedLabelMangerSandbox.fixLabelLints(localizedLabel.nodeId, lintsToFix);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToLatestKeyVersion(localizedLabels: LocalizedLabel[]) {
    const updatePromises = [];
    for (const localizedLabel of localizedLabels) {
      // TODO #14 implement when inlang history is in place
      const message = this.messageStore.getMessage(localizedLabel.messageId!)!;
      // const historyEntryForVersion = message.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.genderId, localizedLabel.pluralId, message.latestVersion);

      const fillins = { ...localizedLabel.fillins };
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
        variantHTML: MessageStoreMemory.htmlInLangugage(message, localizedLabel.rootFrameLanguage),// historyEntryForVersion!.variants?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.genderId]?.[localizedLabel.pluralId]?.text,
        language: localizedLabel.rootFrameLanguage,
        gender: localizedLabel.genderId,
        plural: localizedLabel.pluralId,
        fillins,
      }));
    }

    await Promise.all(updatePromises);
  }

  async revertDesignChanges(localizedLabel: UILocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      messageVersion: localizedLabel.messageVersion,
      variantHTML: localizedLabel.state?.orginalTranslationHTML,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async deleteMessage(messageId: string) {
    await this.unlinLabelsWithKey(messageId);
    await this.messageStore.deleteMessage(messageId);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async unlinLabelsWithKey(keyToUnlink: string) {
    const labelsWithKey = await this.getWithMessage(keyToUnlink);

    for (const labelWithKey of labelsWithKey) {
      // eslint-disable-next-line no-await-in-loop
      await this.updateLabelProperties(labelWithKey.nodeId, {
        messageLinkState: MessageLinkState.Unset,
      });
    }
  }

  async linkMessage(localizedLabel: UILocalizedLabel, messageNameToLinkTo: string, locale: Locale) {
    
    let message = this.messageStore.getMessageByName(messageNameToLinkTo);

    if (message !== undefined) {
      // message does exist - we only have to link it
      await this.updateLabelProperties(localizedLabel.nodeId, {
        messageId: message.id,
        messageLinkState: MessageLinkState.Linked,
        language: locale,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        variantHTML: MessageStoreMemory.htmlInLangugage(message, locale),
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      if (localizedLabel.unlinkedMessage) {
        // TODO #13 check if we need to update the unlinked message
        // eslint-disable-next-line no-param-reassign
        localizedLabel.unlinkedMessage.id = messageNameToLinkTo;
        message = await this.messageStore.createMessage(localizedLabel.unlinkedMessage, localizedLabel.fillins);
      } else {
        message = await this.messageStore.createMessage({
          id: messageNameToLinkTo,
          selectors: [],
          variants: [{
            match: {},
            languageTag: locale,
            pattern: [
              { type: 'Text', value: localizedLabel.variantHTML },
            ],
          }],
        }, localizedLabel.fillins);
      }

      await this.updateLabelProperties(localizedLabel.nodeId, {
        messageId: message.id,
        messageLinkState: MessageLinkState.Linked,
        // messageVersion: message.latestVersion, // its save to use latest version here since we created a whole new key here.
        language: locale,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        variantHTML: localizedLabel.variantHTML,
      });
    }

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async setNoKey(localizedLabel: LocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      messageLinkState: MessageLinkState.NoKey,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async unsetLabel(localizedLabel: LocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      messageLinkState: MessageLinkState.Unset,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async commitUndo() {
    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelTranslation(localizedLabel: LocalizedLabel, variantHTML: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      variantHTML,
    });

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

  async updateLabelPlural(localizedLabel: LocalizedLabel, plural: Plural) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      plural,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  /**
   * Updates the label with the given nodeId with provided changes and updates the cache
   * @param nodeId
   * @param changedProperties
   */
  async updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    messageLinkState?: MessageLinkState,
    messageId?: string,
    messageVersion?: number,
    language?: Locale,
    // TODO #14 replace with selectors or variables
    gender?: Gender,
    plural?: Plural,
    variantHTML?: string,
    fillins?: Fillins,
    filledTemplateHash?: string,
    interimsTranslationEntry?: MessageEntry
  }) {
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;
    const labelFillins = changedProperties.fillins ?? localizedLabelCached.fillins;

    const messageId = changedProperties.messageId ?? localizedLabelCached.messageId;
    const message = messageId ? this.messageStore.getMessage(messageId) : undefined;

    // TODO #14 source fillins from fillin manager
    // if (message?.defaultFillins) {
    //   for (const [placeholderName, fillin] of Object.entries(message.defaultFillins)) {
    //     if (!labelFillins[placeholderName] || labelFillins[placeholderName].default === true) {
    //       labelFillins[placeholderName] = fillin;
    //     }
    //   }
    // }

    const changedPropertiesToForwared = changedProperties as SandboxUpdateLabelProperties;

    changedPropertiesToForwared.fillins = localizedLabelCached.getFillins(changedProperties.messageId, labelFillins);

    if (localizedLabelCached.messageLinkState === MessageLinkState.Linked) {
      changedPropertiesToForwared.unlinkedMessage = null;
    }

    if (!changedProperties.variantHTML) {
      if (changedProperties.language !== undefined
        || changedProperties.gender !== undefined
        || changedProperties.plural !== undefined
        || changedProperties.messageVersion !== undefined) {
        // only language, plural have changed eventually
        const language = changedProperties.language ?? localizedLabelCached.language;

        // TODO #14 make this general selectors instead
        // const plural = changedProperties.plural ?? localizedLabelCached.pluralId;
        // const gender = changedProperties.gender ?? localizedLabelCached.genderId;
        // const version = changedProperties.messageVersion ?? localizedLabelCached.messageVersion;

        if (localizedLabelCached.messageLinkState === MessageLinkState.Linked) {
          // TODO #14 use version when inlang is ready
          // TODO #14 use matchers when in place - for now only use language
          let variantHTML = 'TODO #14 Missinng Translation when setting Version';
          if (message) {
            variantHTML = MessageStoreMemory.htmlForPattern(message, language, {});
          }

          const textAndOps = UILocalizedLabel.toTextAndOps(variantHTML, labelFillins);

          // TODO handle placeholders

          changedPropertiesToForwared.ops = textAndOps.ops;
          changedPropertiesToForwared.characters = textAndOps.text;
          changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(variantHTML);
        } else {
          // we expect to have an interims key already because otherwise we expect a new variantHTML from the provider or a fallback
          if (localizedLabelCached.unlinkedMessage === undefined) {
            throw new Error('unlinked message expected when no message HTML is passed...');
          }
          // NOTE instead of missing translation we could mark the label and use the base language...
          const variantHTML = MessageStoreMemory.htmlInLangugage(localizedLabelCached.unlinkedMessage!, language) ?? 'TODO #14 Missinng Translation when setting Version';
          const textAndOps = UILocalizedLabel.toTextAndOps(variantHTML, labelFillins);

          // TODO handle placeholders

          changedPropertiesToForwared.ops = textAndOps.ops;
          changedPropertiesToForwared.characters = textAndOps.text;
          changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(variantHTML);
        }
      }
    } else {
      // TODO handle placeholders
      // const translationHtml = UILocalizedLabel.toText(translation, labelFillins); // TODO #9 how to deal with missing variants?

      const textAndOps = UILocalizedLabel.toTextAndOps(changedProperties.variantHTML, labelFillins);
      changedPropertiesToForwared.ops = textAndOps.ops;
      changedPropertiesToForwared.characters = textAndOps.text;
      changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(`${textAndOps.text}||||${JSON.stringify(textAndOps.ops)}`);

      if (localizedLabelCached.messageLinkState !== MessageLinkState.Linked) {
        // key is not linked yet - store translation in labels unlinkedMessage until its linked to one
        const baseLanguage = this.messageStore.getBaseLanugage()!;
        const currentGender = (localizedLabelCached.genderId ?? Gender.NEUTRAL);
        const currentPlural = (localizedLabelCached.pluralId ?? Plural.OTHER);
        let { unlinkedMessage } = localizedLabelCached as any;
        if (unlinkedMessage === undefined || unlinkedMessage.variants === undefined) {
          // create interims message variants in label using its current state for the baselang - we always start with the base lang so this is posible :)
          unlinkedMessage = {
            variants: {} as any,
            gender: false,
            plural: false,
          } as any;
          unlinkedMessage.variants[baseLanguage] = {};
          unlinkedMessage.variants[baseLanguage][currentGender] = {};
          unlinkedMessage.variants[baseLanguage][currentGender][currentPlural] = {
            text: localizedLabelCached.variantHTML,
          };
        }

        let baseLanguageHTML = unlinkedMessage.variants[baseLanguage][currentGender][currentPlural].text;

        if (localizedLabelCached.language === baseLanguage) {
          baseLanguageHTML = localizedLabelCached.variantHTML;
          unlinkedMessage.variants[baseLanguage][currentGender][currentPlural] = {
            text: baseLanguageHTML,
          };
        }
        // TODO #23 Interims key update/create an entry in the interims translation for the language/plural passed - store base language hash to know if base language changed

        const targetLanguage = changedProperties.language ?? localizedLabelCached.language;
        const tergetGender = changedProperties.gender ?? currentGender;
        const targetPlural = changedProperties.plural ?? currentPlural;
        if (!unlinkedMessage.variants[targetLanguage]) {
          unlinkedMessage.variants[targetLanguage] = {};
        }

        if (!unlinkedMessage.variants[targetLanguage][tergetGender]) {
          unlinkedMessage.variants[targetLanguage][tergetGender] = {};
        }

        if (!unlinkedMessage.variants[targetLanguage][tergetGender][targetPlural]) {
          unlinkedMessage.variants[targetLanguage][tergetGender][targetPlural] = {};
        }

        unlinkedMessage.variants[targetLanguage][tergetGender][targetPlural].text = changedProperties.variantHTML;
        if (targetLanguage !== baseLanguage) {
          unlinkedMessage.variants[targetLanguage][tergetGender][targetPlural].baseLangHash = blake.blake2sHex(baseLanguageHTML);
        }

        changedPropertiesToForwared.unlinkedMessage = unlinkedMessage;
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
        // TODO #14 add importing via inlang
        // await this.messageStore.createMessage(keyToImport.name, toChangeArray(keyToImport, locale), false, false);
      } else {
        console.log(`updateing key${keyToImport.name}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-await-in-loop
        // TODO #14 add importing via inlang
        // await this.updateMessage(currentKey.id, { variants: toChangeArray(keyToImport, locale) });
      }
    }
  }
}
