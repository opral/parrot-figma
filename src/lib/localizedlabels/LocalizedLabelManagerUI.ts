import blake from 'blakejs';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import Plural from '../base/Plural';
import LocalizedLabelManager from './LocalizedLabelManager';
import Language from '../base/Language';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';

export default class LocalizedLabelManagerUI extends EventTarget {
  private cachedLokalisedLabels = {} as {
    [labelId: string]: LocalizedLabel
  };

  private cachedKeysToLabels = {} as {
    [keyId: string]: Set<string>
  };

  private cacheInvalidationIds = {} as { [nodeId: string]: Set<string> };

  private cachedFrames = {} as { [rootFrameId: string]: {
    frameId: string,
    frameName: string,
    lokalizedLabelIds: string[]
  } };

  private localisedLabelMangerSandbox: LocalizedLabelManager;

  keyStore: MemoryTranslationKeyStore;

  constructor(localisedLabelMangerSandbox: LocalizedLabelManager, keyStore: MemoryTranslationKeyStore) {
    super();
    this.localisedLabelMangerSandbox = localisedLabelMangerSandbox;
    this.keyStore = keyStore;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'LocalizedLabelManager') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          this.processCacheUpdate(event.data.pluginMessage);
        }
      }
    });
  }

  private invalidateFrame(frameId: string) {
    //  console.log('invalidating frame');
    if (this.cachedFrames[frameId] !== undefined) {
      this.cachedFrames[frameId].lokalizedLabelIds.forEach((labelId) => {
        if (this.cachedLokalisedLabels[labelId]) {
          this.invalidateCacheIfNeeded(this.cachedLokalisedLabels[labelId]!, true);
        }
      });
      delete this.cachedFrames[frameId];
    }
  }

  private processCacheUpdate(cacheUpdateMessage: any) {
    // console.log('processCacheUpdate');
    for (const frameIdToInvalidate of cacheUpdateMessage.rootFrameIdsToReload) {
    //  console.log(`invalidating frame ${frameIdToInvalidate}`);
      this.invalidateFrame(frameIdToInvalidate);
    }

    for (const changedNodeById of cacheUpdateMessage.changedNodesById) {
      const frameIdsToInvalidate = this.cacheInvalidationIds[changedNodeById];
      if (frameIdsToInvalidate) {
        for (const frameIdToInvalidate of frameIdsToInvalidate) {
          // console.log(`invalidating frame ${frameIdToInvalidate} - changed child`);
          this.invalidateFrame(frameIdToInvalidate);
        }
      }
    }

    for (const deletedNodeId of cacheUpdateMessage.deletedNodeIds) {
      const frameIdsToInvalidate = this.cacheInvalidationIds[deletedNodeId];
      if (frameIdsToInvalidate) {
        for (const frameIdToInvalidate of frameIdsToInvalidate) {
          // console.log(`invalidating frame ${frameIdToInvalidate} - deleted child`);
          this.invalidateFrame(frameIdToInvalidate);
        }
      }

      if (this.cachedLokalisedLabels[deletedNodeId] !== undefined) {
        // console.log('removing the cache');
        this.invalidateCacheIfNeeded(this.cachedLokalisedLabels[deletedNodeId], true);
      }
    }

    for (const changedLabel of cacheUpdateMessage.changedLabels) {
      // enrich hash state (we cant do this in the sandbox layer - since 'TextEncoder' is not defined there)
      changedLabel.textChangedAfterGeneration = changedLabel.filledTemplateHash === undefined || blake.blake2sHex(changedLabel.text) !== changedLabel.filledTemplateHash;

      // console.log(`invalidating node${changedLabel.nodeId}`);
      this.invalidateCacheIfNeeded(changedLabel);

      this.cachedLokalisedLabels[changedLabel.nodeId] = changedLabel;
      if (changedLabel.key !== undefined) {
        if (this.cachedKeysToLabels[changedLabel.key] === undefined) {
          this.cachedKeysToLabels[changedLabel.key] = new Set<string>();
        }
        this.cachedKeysToLabels[changedLabel.key].add(changedLabel.nodeId);
      }
    }

    const event = new CustomEvent('updated', { });
    this.dispatchEvent(event);
  }

  getLabelsWithKey(key: string) {
    const referencingLabels = [] as LocalizedLabel[];
    const labelIds = this.cachedKeysToLabels[key];
    if (labelIds === undefined) {
      return referencingLabels;
    }
    for (const labelId of labelIds) {
      referencingLabels.push(this.cachedLokalisedLabels[labelId]);
    }

    return referencingLabels;
  }

  /**
   * The state of a label is represented by two main properties:
   * modified: was the labels text changed in the design compared to the version the label is pointing to
   * behind: the number of changes that have been applied to the language relative to the version the label is currently pointing to
   * 
   * @param localizedLabel the label to provide the state for
   * @returns 
   */
  getLabelState(localizedLabel: LocalizedLabel): { behind: number, orginalText?: string, modified: boolean } {
    const state = {
      modified: false,
      behind: 0,
      orginalText: undefined as string | undefined,
    };

    const translatedKey = localizedLabel.keyType !== KeyState.Unset ? this.keyStore.getKey(localizedLabel.key!) : undefined;

    if (translatedKey) {
      const currentVersion = MemoryTranslationKeyStore.getHistoryEntry(translatedKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);

      if (currentVersion === undefined) {
        console.warn(`Illegal state on label ${localizedLabel.key} ${localizedLabel.keyVersion}`);
      } else {
        state.behind = MemoryTranslationKeyStore.getChangesSince(translatedKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);

        if (currentVersion[localizedLabel.language]?.[localizedLabel.pluralId]?.text !== localizedLabel.text || (localizedLabel.useSampleValues && localizedLabel.textChangedAfterGeneration)) {
          state.modified = true;
          state.orginalText = currentVersion[localizedLabel.language]?.[localizedLabel.pluralId]?.text;
        }
      }
    }

    return state;
  }

  async setFrameUseSampleValues(frameId: string, useSampleValues: boolean) {
    // we don't have a property on the frame directly - we will derive it from the child labels
    // no need to change the frame it self
    for (const localizedLabelId of this.cachedFrames[frameId].lokalizedLabelIds) {
      // eslint-disable-next-line no-await-in-loop
      this.setLabelUseSampleValues(localizedLabelId, useSampleValues);
    }
  }

  async setLabelUseSampleValues(localizedLabelId: string, useSampleValues: boolean) {
    const localizeLabel = this.cachedLokalisedLabels[localizedLabelId];
    const translationKey = this.keyStore.getKey(localizeLabel.key!);

    if (localizeLabel.keyType !== KeyState.Linked
      || this.getLabelState(localizeLabel).modified
      || translationKey === undefined) {
      // we don't change any property also not on the parent - no need to update the label at all
      return;
    }

    const versionToApply = MemoryTranslationKeyStore.getHistoryEntry(translationKey, localizeLabel.language, localizeLabel.pluralId, localizeLabel.keyVersion);

    const text = versionToApply?.[localizeLabel.language]?.[localizeLabel.pluralId]?.text;
    if (text) {
      await this.updateLabelProperties(localizedLabelId, {
        showSampleValues: useSampleValues,
        text,
      });
    }
  }

  async setFrameLanguage(frameId: string, targetLanguage: Language, missingTranslationProvider: (input: string, language: string) => Promise<string | undefined>) {
    await this.localisedLabelMangerSandbox.updateFrameProperties(frameId, {
      language: targetLanguage,
    });

    for (const localizedLabelId of this.cachedFrames[frameId].lokalizedLabelIds) {
      const localisedLabel = this.cachedLokalisedLabels[localizedLabelId]!;
      // eslint-disable-next-line no-await-in-loop
      await this.setLabelLanguage(localisedLabel, targetLanguage, missingTranslationProvider);
    }

    // await this.localisedLabelMangerSandbox.updateFrameById(frameId);
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Language,
    missingTranslationProvider: (input: string, language: string) => Promise<string | undefined>,
  ) {
    const translationKeyName = cachedLabel.key ?? cachedLabel.derivedKey;
    const labelState = this.getLabelState(cachedLabel);
    let labelVersion = cachedLabel.keyVersion;

    if (cachedLabel.keyType === KeyState.Unlinked // we don't update unlinked labels
      || translationKeyName === undefined // or labels where we cant derive or get the key
      || labelState.modified) { // or that are modified
      // root language has changed - trigger cache update
      await this.updateLabelProperties(cachedLabel.nodeId, {});
      return;
    }

    let translationKey = this.keyStore.getKey(translationKeyName);
    // check if key exists
    if (translationKey === undefined) {
      const translation = await missingTranslationProvider(cachedLabel.text!, targetLanguage);

      // ok we have a fresh key to create - no translation to expect
      translationKey = await this.keyStore.createKey(translationKeyName, [{
        language: cachedLabel.language,
        plural: cachedLabel.pluralId,
        text: cachedLabel.text,
        skip: false,
      }, {
        language: targetLanguage,
        plural: cachedLabel.pluralId,
        text: translation,
        skip: false,
      }]);
      labelVersion = translationKey.latestVersion;
    } else {
      if (labelState.behind === 0) {
        // updating key
        if (translationKey.translations[targetLanguage]?.[cachedLabel.pluralId]?.text === undefined) {
          if (translationKey.translations[targetLanguage]?.[cachedLabel.pluralId]?.skip === true) {
            // TODO #3 think about fall back mechanism:
            // in case the key for the given plural is skipped try to fall back to others
            // if this is skipped as well fall back to base language
            //  - for now we just don't change the label
            await this.updateLabelProperties(cachedLabel.nodeId, {});
            return;
          }

          // translation missing - generate it and update the translation key
          const originText = translationKey.translations[this.keyStore.getBaseLanugage()!]![cachedLabel.pluralId]?.text ?? translationKey.translations[cachedLabel.language]![cachedLabel.pluralId]?.text!;

          const translation = await missingTranslationProvider(originText, targetLanguage);
          translationKey = await this.keyStore.updateKey(translationKeyName, [{
            language: targetLanguage,
            plural: cachedLabel.pluralId,
            text: translation,
            skip: false,
          }]);
        }
        labelVersion = translationKey.latestVersion;
      }

      const versionToApply = MemoryTranslationKeyStore.getHistoryEntry(translationKey, targetLanguage, cachedLabel.pluralId, labelVersion);

      await this.updateLabelProperties(cachedLabel.nodeId, {
        key: translationKeyName,
        keyType: KeyState.Linked,
        language: targetLanguage,
        text: versionToApply?.[targetLanguage]?.[cachedLabel.pluralId]?.text,
        keyVersion: labelVersion,
      });
    }
  }

  async createNewVersionFromLabelState(localizedLabel: LocalizedLabel) {
    // TODO #4 ensure that we are NOT in replace var mode when running this?
    // TODO update key (lang, plural, text, skiped) with text frin design
    const localizedKey = await this.keyStore.updateKey(localizedLabel.key!, [{
      language: localizedLabel.language as Language, plural: localizedLabel.pluralId as Plural, text: localizedLabel.text, skip: false,
    }]);

    console.log(`setting key v to ${localizedKey.latestVersion}`);
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedKey.latestVersion,
    });
  }

  async updateToLatestKeyVersion(localizedLabel: LocalizedLabel) {
    const translationKey = this.keyStore.getKey(localizedLabel.key!)!;

    const historyEntryForVersion = MemoryTranslationKeyStore.getHistoryEntry(translationKey, localizedLabel.language, localizedLabel.pluralId, translationKey.latestVersion);

    // TODO set labels text to the latest key version
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: translationKey.latestVersion,
      text: historyEntryForVersion![localizedLabel.language]?.[localizedLabel.pluralId]?.text,
    });
  }

  async revertDesignChanges(localizedLabel: LocalizedLabel) {
    const translationKey = this.keyStore.getKey(localizedLabel.key!)!;

    const currentLabelVersion = MemoryTranslationKeyStore.getHistoryEntry(translationKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedLabel.keyVersion,
      text: currentLabelVersion![localizedLabel.language]?.[localizedLabel.pluralId]?.text,
    });
  }

  async linkKey(localizedLabel: LocalizedLabel, keyToLinkTo: string) {
    let translationKey = this.keyStore.getKey(keyToLinkTo);

    if (translationKey !== undefined) {
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        plural: Plural.Other,
        language: localizedLabel.rootFrameLanguage,
        keyVersion: translationKey.latestVersion,
        showSampleValues: localizedLabel.rootFrameUseSampleValues,
        text: localizedLabel.text,
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      translationKey = await this.keyStore.createKey(keyToLinkTo, [{
        language: localizedLabel.rootFrameLanguage,
        plural: localizedLabel.pluralId,
        text: localizedLabel.text,
        skip: false,
      }]);
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion, // its save to use latest version here since we created a whole new key here.
        language: localizedLabel.rootFrameLanguage,
        showSampleValues: localizedLabel.rootFrameUseSampleValues,
        text: localizedLabel.text,
      });
    }
  }

  async unlinkKey(localizedLabel: LocalizedLabel, keyName?: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      key: keyName,
      keyType: KeyState.Unlinked,
    });
  }

  async updateLabelName(localizedLabel: LocalizedLabel, labelName: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      labelName,
    });
  }

  /**
   * Updates the label with the given nodeId with provided changes and updates the cache
   * @param nodeId
   * @param changedProperties
   */
  protected async updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    keyType?: KeyState,
    key?: string,
    keyVersion?: number,
    language?: Language,
    plural?: Plural,
    text?: string,
    filledTemplateHash?: string,
    showSampleValues?: boolean,
  }) {
    const localizedLabelCached = this.cachedLokalisedLabels[nodeId]!;
    const changedPropertiesToForwared = changedProperties;

    if (changedProperties.text !== undefined && (changedProperties.showSampleValues === true || localizedLabelCached.useSampleValues)) {
      const language = changedProperties.language ?? localizedLabelCached.language;
      const plural = changedProperties.plural ?? localizedLabelCached.pluralId;

      // eslint-disable-next-line no-param-reassign
      changedPropertiesToForwared.text = this.keyStore.fillPlaceholdersWithSampleData(changedProperties.text!, language, plural);
      changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(changedPropertiesToForwared.text);
    }

    const localisedLabel = await this.localisedLabelMangerSandbox.updateLocalisedLabelProperties(nodeId, changedPropertiesToForwared);

    // enrich hash state (we cant do this in the sandbox layer - since 'TextEncoder' is not defined there)
    localisedLabel.textChangedAfterGeneration = localisedLabel.filledTemplateHash === undefined || blake.blake2sHex(localisedLabel.text!) !== localisedLabel.filledTemplateHash;

    console.log('updated label:');
    console.log(localisedLabel);

    this.cachedLokalisedLabels[nodeId] = localisedLabel;
  }

  async getLocalizedLabelsByFrame(frameId: string) {
    if (this.cachedFrames[frameId]) {
      return this.cachedFrames[frameId].lokalizedLabelIds.map((labelId) => this.cachedLokalisedLabels[labelId]!);
    }

    // console.log(`refreshing frame with id ${frameId}`);
    const frameData = await this.localisedLabelMangerSandbox.getFrameById(frameId);

    this.cachedFrames[frameId] = {
      frameId,
      frameName: frameData.name,
      lokalizedLabelIds: [],
    };

    for (const freshLocalizedLabel of frameData.localizedLabelsInFrame) {
      // enrich hash state (we cant do this in the sandbox layer - since 'TextEncoder' is not defined there)
      freshLocalizedLabel.textChangedAfterGeneration = freshLocalizedLabel.filledTemplateHash === undefined || blake.blake2sHex(freshLocalizedLabel.text!) !== freshLocalizedLabel.filledTemplateHash;

      this.cachedFrames[frameId].lokalizedLabelIds.push(freshLocalizedLabel.nodeId);
      this.invalidateCacheIfNeeded(freshLocalizedLabel);
      this.cachedLokalisedLabels[freshLocalizedLabel.nodeId] = freshLocalizedLabel;
      if (freshLocalizedLabel.key !== undefined) {
        if (this.cachedKeysToLabels[freshLocalizedLabel.key] === undefined) {
          this.cachedKeysToLabels[freshLocalizedLabel.key] = new Set<string>();
        }
        this.cachedKeysToLabels[freshLocalizedLabel.key].add(freshLocalizedLabel.nodeId);
      }
    }

    return this.cachedFrames[frameId].lokalizedLabelIds.map((labelId) => this.cachedLokalisedLabels[labelId]!);
  }

  private invalidateCacheIfNeeded(updatedLocalizedLabel: LocalizedLabel, force: boolean = false) {
    const cachedLabel = this.cachedLokalisedLabels[updatedLocalizedLabel.nodeId];

    if (cachedLabel && (cachedLabel.rootFrameId !== updatedLocalizedLabel.rootFrameId || force)) {
      delete this.cachedFrames[cachedLabel.rootFrameId];
    }

    if (cachedLabel && cachedLabel.key !== undefined && (cachedLabel.key !== updatedLocalizedLabel.key || force)) {
      this.cachedKeysToLabels[cachedLabel.key].delete(cachedLabel.nodeId);
    }
  }

  // eslint-disable-next-line class-methods-use-this --  TODO remove when all todos are mimplemtned
  async loadAll() {
    // TODO implment
    /*
        console.time('ask for labels ui');
        let localisedLabels = await this.localisedLabelMangerSandbox.loadAll()
        console.timeEnd('ask for labels ui');
        for (let localisedLabel of localisedLabels) {
          this.lokalisedLabels[localisedLabel.nodeId] = localisedLabel;
          if (!this.lokalisedLabelsByFrame[localisedLabel.rootFrameId]) {
            this.lokalisedLabelsByFrame[localisedLabel.rootFrameId] = [localisedLabel]
          } else {
            this.lokalisedLabelsByFrame[localisedLabel.rootFrameId].push(localisedLabel);
          }

          this.lokalisedLabels[localisedLabel.nodeId] = localisedLabel

        } */
  }
}
