import blake from 'blakejs';
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
  private refreshCachedLabel(labelToCache: LocalizedLabel) {
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
      } else if (!stateDiffers
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
      for (const changedKey of changesEvent.detail.changedKeys) {
        this.handleKeyUpdate(changedKey);
      }
    });
  }

  onKeyLabelLinksLoaded(event: LinksLoadedEvent) {
    this.messageStore.updateKeyLinks(event.keys);
  }

  framesIdToLoad = [] as string[];

  async startFillupCache() {
    // we don't await this promise since it will fill the cache in the background
    this.localizedLabelMangerSandbox.startFillupCache();
  }

  private handleKeyUpdate(keyId: string) {
    let cacheUpdated = false;

    for (const labelToUpdate of Object.values(this.cachedLocalisedLabels)) {
      if (labelToUpdate.messageId === keyId) {
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

  async setFrameLanguage(frameId: string, targetLanguage: Locale, missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>) {
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

  async updateKey(
    keyId: string,
    properties: {
      name?: string,
      variants: { language: Locale, plural: Plural, text: string | undefined, skip: boolean }[],
      plural?: boolean,
      fillins?: Fillins,
      quantity?: { value: number } | { placeholder: string },
    },

  ) {
    const originalKey = await this.messageStore.getMessage(keyId);
    const updatedKey = await this.messageStore.updateMessage(keyId, properties);

    if (originalKey?.latestVersion !== updatedKey.latestVersion) {
      await this.updateUnpinnedLabelsWithKey(keyId);

      this.messageStore.parentKeyStore.commitUndo();
    }
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Locale,
    version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>,
  ) {
    (new UILocalizedLabel(this, cachedLabel)).setLanguage(targetLanguage, version, missingTranslationProvider);
  }

  async createNewVersionFromLabelState(localizedLabel: UILocalizedLabel) {
    const localizedKey = await this.messageStore.updateMessage(localizedLabel.messageId!, {
      variants: [{
        language: localizedLabel.language as Locale, plural: localizedLabel.pluralId as Plural, text: localizedLabel.variantHTML, skip: false,
      }],
      fillins: localizedLabel.fillins,
    });

    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedKey.latestVersion,
    });

    await this.updateUnpinnedLabelsWithKey(localizedLabel.messageId!);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToLatestKeyVersion(localizedLabels: LocalizedLabel[]) {
    const updatePromises = [];
    for (const localizedLabel of localizedLabels) {
      const message = this.messageStore.getMessage(localizedLabel.messageId!)!;
      const historyEntryForVersion = message.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.pluralId, message.latestVersion);

      const fillins = { ...localizedLabel.fillins };
      for (const placeholderName of Object.keys(message.defaultFillins)) {
        if ((!fillins[placeholderName] || fillins[placeholderName].default) && message.defaultFillins[placeholderName]) {
          fillins[placeholderName] = {
            default: true,
            value: message.defaultFillins[placeholderName].value,
          };
        }
      }

      // console.log('updateToLatestKeyVersion: ' +  historyEntryForVersion!.variants?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text);

      // eslint-disable-next-line no-await-in-loop
      updatePromises.push(this.updateLabelProperties(localizedLabel.nodeId, {
        keyVersion: message.latestVersion,
        variantHTML: historyEntryForVersion!.variants?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
        language: localizedLabel.rootFrameLanguage,
        plural: localizedLabel.pluralId,
        fillins,
      }));
    }

    await Promise.all(updatePromises);
  }

  async revertDesignChanges(localizedLabel: UILocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedLabel.messageVersion,
      variantHTML: localizedLabel.state?.orginalTranslationHTML,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async deleteKey(keyToDelete: string) {
    await this.unlinLabelsWithKey(keyToDelete);
    await this.messageStore.deleteMessage(keyToDelete);

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

  async linkKey(localizedLabel: UILocalizedLabel, keyNameToLinkTo: string, language: Locale, plural: Plural) {
    let message = this.messageStore.getMessageByName(keyNameToLinkTo);

    if (message !== undefined) {
      await this.updateLabelProperties(localizedLabel.nodeId, {
        keyId: message.id,
        messageLinkState: MessageLinkState.Linked,
        plural,
        language,
        keyVersion: message.latestVersion,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        variantHTML: message.variants[language]?.[plural]?.text ?? 'no translation',
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      if (localizedLabel.unlinkedMessage) {
        const variants = Object.entries(localizedLabel.unlinkedMessage.variants!).flatMap(([languageFound, pluralsFound]) => Object.entries(pluralsFound).map(([pluralFound, { text }]) => {
          if (languageFound === language && plural === pluralFound) {
            return ({ language: languageFound, plural: pluralFound, text: localizedLabel.variantHTML } as { language: Locale, plural: Plural, text: string, skip: false });
          }
          return ({ language: languageFound, plural: pluralFound, text } as { language: Locale, plural: Plural, text: string, skip: false });
        }));
        message = await this.messageStore.createMessage(keyNameToLinkTo, variants, localizedLabel.unlinkedMessage.plural, localizedLabel.fillins);
      } else {
        message = await this.messageStore.createMessage(keyNameToLinkTo, [{
          language,
          plural,
          text: localizedLabel.variantHTML,
          skip: false,
        }], plural !== Plural.OTHER, localizedLabel.fillins);
      }
      await this.updateLabelProperties(localizedLabel.nodeId, {
        keyId: message.id,
        messageLinkState: MessageLinkState.Linked,
        keyVersion: message.latestVersion, // its save to use latest version here since we created a whole new key here.
        language,
        plural,
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
    this.updateLabelProperties(localizedLabel.nodeId, {
      variantHTML: variantHTML,
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
    keyId?: string,
    keyVersion?: number,
    language?: Locale,
    plural?: Plural,
    variantHTML?: string,
    fillins?: Fillins,
    filledTemplateHash?: string,
    interimsTranslationEntry?: MessageEntry
  }) {
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;
    const labelFillins = changedProperties.fillins ?? localizedLabelCached.fillins;

    const keyId = changedProperties.keyId ?? localizedLabelCached.messageId;
    const message = keyId ? this.messageStore.getMessage(keyId) : undefined;

    if (message?.defaultFillins) {
      for (const [placeholderName, fillin] of Object.entries(message.defaultFillins)) {
        if (!labelFillins[placeholderName] || labelFillins[placeholderName].default === true) {
          labelFillins[placeholderName] = fillin;
        }
      }
    }

    const changedPropertiesToForwared = changedProperties as SandboxUpdateLabelProperties;

    changedPropertiesToForwared.fillins = localizedLabelCached.getFillins(changedProperties.keyId, labelFillins);

    if (localizedLabelCached.messageLinkState === MessageLinkState.Linked) {
      changedPropertiesToForwared.unlinkedTranslations = null;
    }

    if (!changedProperties.variantHTML) {
      if (changedProperties.language !== undefined
        || changedProperties.plural !== undefined
        || changedProperties.keyVersion !== undefined) {
        // only language, plural have changed eventually
        const language = changedProperties.language ?? localizedLabelCached.language;
        const plural = changedProperties.plural ?? localizedLabelCached.pluralId;
        const version = changedProperties.keyVersion ?? localizedLabelCached.messageVersion;

        if (localizedLabelCached.messageLinkState === MessageLinkState.Linked) {
          const variantHTML = message?.getInVersion(version).variants[language]?.[plural]?.text ?? 'TODO Missinng Translation when setting Version';
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
          const variantHTML = localizedLabelCached.unlinkedMessage!.variants![language]?.[plural]?.text ?? 'TODO Missinng Translation when setting Version';
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
        // key is not linked yet - store translation in labels unlinkedTranslations until its linked to one
        const baseLanguage = this.messageStore.getBaseLanugage()!;
        const currentPlural = (localizedLabelCached.pluralId ?? Plural.OTHER);
        let { unlinkedTranslations } = localizedLabelCached as any;
        if (unlinkedTranslations === undefined || unlinkedTranslations.variants === undefined) {
          // create interims message variants in label using its current state for the baselang - we always start with the base lang so this is posible :)
          unlinkedTranslations = {
            variants: {} as any,
            plural: false,
          } as any;
          unlinkedTranslations.variants[baseLanguage] = {};
          unlinkedTranslations.variants[baseLanguage][currentPlural] = {
            text: localizedLabelCached.variantHTML,
          };
        }

        let baseLanguageHTML = unlinkedTranslations.variants[baseLanguage][currentPlural].text;

        if (localizedLabelCached.language === baseLanguage) {
          baseLanguageHTML = localizedLabelCached.variantHTML;
          unlinkedTranslations.variants[baseLanguage][currentPlural] = {
            text: baseLanguageHTML,
          };
        }
        // TODO #23 Interims key update/create an entry in the interims translation for the language/plural passed - store base language hash to know if base language changed

        const targetLanguage = changedProperties.language ?? localizedLabelCached.language;
        const targetPlural = changedProperties.plural ?? currentPlural;
        if (!unlinkedTranslations.variants[targetLanguage]) {
          unlinkedTranslations.variants[targetLanguage] = {};
        }

        if (!unlinkedTranslations.variants[targetLanguage][targetPlural]) {
          unlinkedTranslations.variants[targetLanguage][targetPlural] = {};
        }

        unlinkedTranslations.variants[targetLanguage][targetPlural].text = changedProperties.variantHTML;
        if (targetLanguage !== baseLanguage) {
          unlinkedTranslations.variants[targetLanguage][targetPlural].baseLangHash = blake.blake2sHex(baseLanguageHTML);
        }

        changedPropertiesToForwared.unlinkedTranslations = unlinkedTranslations;
      }
    }

    const localizedLabel = await this.localizedLabelMangerSandbox.updateLabelProperties(nodeId, changedPropertiesToForwared);
    if (this.refreshCachedLabel(localizedLabel)) {
      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
    }
  }

  async getSelection() {
    const selection = await this.localizedLabelMangerSandbox.getSelection();
    return selection;
  }

  async import(keysToImport: ImportMessage[], language: Locale) {
    function toChangeArray(importKey: ImportMessage, languageToUse: Locale) {
      return [{
        language: languageToUse,
        plural: importKey.plural,
        text: importKey.text,
        skip: false,
      }] as { language: Locale; plural: Plural; text: string | undefined; skip: boolean }[];
    }

    for (const keyToImport of keysToImport) {
      const currentKey = this.messageStore.getMessageByName(keyToImport.name);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log(`creating key${keyToImport.name}`);
        // TODO #8 implement import logic for placeholders and quantities
        // eslint-disable-next-line no-await-in-loop
        await this.messageStore.createMessage(keyToImport.name, toChangeArray(keyToImport, language), false);
      } else {
        console.log(`updateing key${keyToImport.name}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-await-in-loop
        await this.updateKey(currentKey.id, { variants: toChangeArray(keyToImport, language) });
      }
    }
  }
}
