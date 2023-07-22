import blake from 'blakejs';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import { Plural } from '../base/Plural';
import LocalizedLabelManager, { SandboxUpdateLabelProperties } from './LocalizedLabelManager';
import { Language } from '../base/Language';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';
import ChangeEvent from './ChangeEvent';

import { ILocalizedLabelManagerUI, UILocalizedLabel } from './UILocalizedLabel';
import { Fillins } from '../keystore/TranslationKey';
import LinksLoadedEvent from './LinksLoadedEvent';
import { placeholder } from '@codemirror/view';
import { ImportTranslationKey } from '../import/ImportTranslationKey';

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
          && cachedLabel.key === label.key
          && cachedLabel.keyType === label.keyType
          && cachedLabel.keyVersion === label.keyVersion
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

  keyStore: MemoryTranslationKeyStore;

  constructor(localizedLabelMangerSandbox: LocalizedLabelManager, keyStore: MemoryTranslationKeyStore) {
    super();
    this.localizedLabelMangerSandbox = localizedLabelMangerSandbox;
    this.keyStore = keyStore;

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

    this.keyStore.addEventListener('updated', (changesEvent: any) => {
      for (const changedKey of changesEvent.detail.changedKeys) {
        this.handleKeyUpdate(changedKey);
      }
    });
  }

  onKeyLabelLinksLoaded(event: LinksLoadedEvent) {
    this.keyStore.updateKeyLinks(event.keys);
  }

  framesIdToLoad = [] as string[];

  async startFillupCache() {
    // we don't await this promise since it will fill the cache in the background
    this.localizedLabelMangerSandbox.startFillupCache();
  }

  private handleKeyUpdate(keyId: string) {
    let cacheUpdated = false;

    for (const labelToUpdate of Object.values(this.cachedLocalisedLabels)) {
      if (labelToUpdate.key === keyId) {
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
    const labelsToUpdate = (await this.getWithKey(key)).filter((label) => label.keyType === KeyState.Linked);

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

  async getWithKey(key: string) {
    const labelsWithKey = await this.localizedLabelMangerSandbox.getWithKey(key);
    const uiLabels = [] as UILocalizedLabel[];
    for (const freshLocalizedLabel of labelsWithKey) {
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

  async setFrameLanguage(frameId: string, targetLanguage: Language, missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>) {
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
    keyName: string,
    translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[],
    plural?: boolean,
    fillins?: Fillins,
    quantity?: { value: number } | { placeholder: string },
  ) {
    const originalKey = await this.keyStore.getKey(keyName);
    const updatedKey = await this.keyStore.updateKey(keyName, translations, plural, fillins, quantity);

    if (originalKey?.latestVersion !== updatedKey.latestVersion) {
      await this.updateUnpinnedLabelsWithKey(keyName);

      this.keyStore.parentKeyStore.commitUndo();
    }
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Language,
    version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>,
  ) {
    (new UILocalizedLabel(this, cachedLabel)).setLanguage(targetLanguage, version, missingTranslationProvider);
  }

  async createNewVersionFromLabelState(localizedLabel: UILocalizedLabel) {
    const localizedKey = await this.keyStore.updateKey(localizedLabel.key!, [{
      language: localizedLabel.language as Language, plural: localizedLabel.pluralId as Plural, text: localizedLabel.translationHTML, skip: false,
    }], undefined, localizedLabel.fillins);

    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedKey.latestVersion,
    });

    await this.updateUnpinnedLabelsWithKey(localizedLabel.key!);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToLatestKeyVersion(localizedLabels: LocalizedLabel[]) {
    const updatePromises = [];
    for (const localizedLabel of localizedLabels) {
      const translationKey = this.keyStore.getKey(localizedLabel.key!)!;
      const historyEntryForVersion = translationKey.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.pluralId, translationKey.latestVersion);

      const fillins = { ...localizedLabel.fillins };
      for (const placeholderName of Object.keys(translationKey.defaultFillins)) {
        if ((!fillins[placeholderName] || fillins[placeholderName].default) && translationKey.defaultFillins[placeholderName]) {
          fillins[placeholderName] = {
            default: true,
            value: translationKey.defaultFillins[placeholderName].value,
          };
        }
      }

      // console.log('updateToLatestKeyVersion: ' +  historyEntryForVersion!.translations?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text);

      // eslint-disable-next-line no-await-in-loop
      updatePromises.push(this.updateLabelProperties(localizedLabel.nodeId, {
        keyVersion: translationKey.latestVersion,
        translationHTML: historyEntryForVersion!.translations?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
        language: localizedLabel.rootFrameLanguage,
        fillins,
      }));
    }

    await Promise.all(updatePromises);
  }

  async revertDesignChanges(localizedLabel: UILocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedLabel.keyVersion,
      translationHTML: localizedLabel.state?.orginalTranslationHTML,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async linkKey(localizedLabel: UILocalizedLabel, keyToLinkTo: string, language: Language, plural: Plural) {
    let translationKey = this.keyStore.getKey(keyToLinkTo);

    if (translationKey !== undefined) {
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        plural,
        language,
        keyVersion: translationKey.latestVersion,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        translationHTML: translationKey.translations[language]?.[plural]?.text ?? 'no translation',
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      translationKey = await this.keyStore.createKey(keyToLinkTo, [{
        language,
        plural,
        text: localizedLabel.translationHTML,
        skip: false,
      }], plural !== Plural.OTHER, localizedLabel.fillins);
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion, // its save to use latest version here since we created a whole new key here.
        language,
        plural,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        translationHTML: localizedLabel.translationHTML,
      });
    }

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async setNoKey(localizedLabel: LocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyType: KeyState.NoKey,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async resetLabel(localizedLabel: LocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyType: KeyState.Unset,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async commitUndo() {
    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelTranslation(localizedLabel: LocalizedLabel, translationHTML: string) {
    this.updateLabelProperties(localizedLabel.nodeId, {
      translationHTML,
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
    keyType?: KeyState,
    key?: string,
    keyVersion?: number,
    language?: Language,
    plural?: Plural,
    translationHTML?: string,
    fillins?: Fillins,
    filledTemplateHash?: string
  }) {
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;
    const labelFillins = changedProperties.fillins ?? localizedLabelCached.fillins;

    const key = changedProperties.key ?? localizedLabelCached.key;
    const translationKey = key ? this.keyStore.getKey(key) : undefined;

    if (translationKey?.defaultFillins) {
      for (const [placeholderName, fillin] of Object.entries(translationKey.defaultFillins)) {
        if (!labelFillins[placeholderName] || labelFillins[placeholderName].default === true) {
          labelFillins[placeholderName] = fillin;
        }
      }
    }

    const changedPropertiesToForwared = changedProperties as SandboxUpdateLabelProperties;

    changedPropertiesToForwared.fillins = localizedLabelCached.getFillins(changedProperties.key, labelFillins);

    if (!changedProperties.translationHTML) {
      if (changedProperties.language !== undefined
        || changedProperties.plural !== undefined
        || changedProperties.keyVersion !== undefined) {
        if (localizedLabelCached.keyType === KeyState.Linked) {
          const language = changedProperties.language ?? localizedLabelCached.language;
          const plural = changedProperties.plural ?? localizedLabelCached.pluralId;
          const version = changedProperties.keyVersion ?? localizedLabelCached.keyVersion;
          const translationHTML = translationKey?.getInVersion(version).translations[language]?.[plural]?.text ?? 'TODO Missinng Translation when setting Version';
          const textAndOps = UILocalizedLabel.toTextAndOps(translationHTML, labelFillins);

          // TODO handle placeholders

          changedPropertiesToForwared.ops = textAndOps.ops;
          changedPropertiesToForwared.characters = textAndOps.text;
          changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(translationHTML);
        }
      }
    } else {
      // TODO handle placeholders
      // const translationHtml = UILocalizedLabel.toText(translation, labelFillins); // TODO #9 how to deal with missing translations?
      const textAndOps = UILocalizedLabel.toTextAndOps(changedProperties.translationHTML, labelFillins);
      changedPropertiesToForwared.ops = textAndOps.ops;
      changedPropertiesToForwared.characters = textAndOps.text;
      changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(`${textAndOps.text}||||${JSON.stringify(textAndOps.ops)}`);
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

  async import(keysToImport: ImportTranslationKey[], language: Language) {
    function toChangeArray(importKey: ImportTranslationKey, languageToUse: Language) {
      return [{
        language: languageToUse,
        plural: importKey.plural,
        text: importKey.text,
        skip: false,
      }] as { language: Language; plural: Plural; text: string | undefined; skip: boolean }[];
    }

    for (const keyToImport of keysToImport) {
      const currentKey = this.keyStore.getKey(keyToImport.keyName);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log(`creating key${keyToImport.keyName}`);
        // TODO #8 implement import logic for placeholders and quantities
        // eslint-disable-next-line no-await-in-loop
        await this.keyStore.createKey(keyToImport.keyName, toChangeArray(keyToImport, language), false);
      } else {
        console.log(`updateing key${keyToImport.keyName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-await-in-loop
        await this.updateKey(keyToImport.keyName, toChangeArray(keyToImport, language));
      }
    }
  }
}
