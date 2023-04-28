import blake from 'blakejs';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import { Plural } from '../base/Plural';
import LocalizedLabelManager from './LocalizedLabelManager';
import { Language } from '../base/Language';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';
import { BaseTranslationKeyStore } from '../keystore/BaseTranslationKeyStore';
import ChangeEvent from './ChangeEvent';

export default class LocalizedLabelManagerUI extends EventTarget {
  // mapping from nodeId to localizied label instance
  private cachedLocalisedLabels = {} as {
    [labelId: string]: LocalizedLabel
  };

  // mapping from a translationKey to labelId - used to get references of a translation key in design
  private keysToCachedLabels = {} as {
    [keyId: string]: Set<string>
  };

  // cached root frames containing localized labels
  private cachedFrames = {} as { [rootFrameId: string]: {
    frameId: string,
    frameName: string,
    localizedLabelIds: string[]
  } };

  // maps parent to children allows to lookup all children by a change up the branch
  private cachedBranches = {} as { [parentId: string]: Set<string> };

  private removeCachedLabel(labelId: string) {
    const cachedLabel = this.cachedLocalisedLabels[labelId];

    if (!cachedLabel) {
      return false;
    }

    delete this.cachedLocalisedLabels[labelId];

    if (this.cachedFrames[cachedLabel.rootFrameId]) {
      this.cachedFrames[cachedLabel.rootFrameId].localizedLabelIds = this.cachedFrames[cachedLabel.rootFrameId].localizedLabelIds.filter((nodeId) => nodeId !== labelId);
    }

    if (cachedLabel.key && this.keysToCachedLabels[cachedLabel.key]) {
      this.keysToCachedLabels[cachedLabel.key].delete(cachedLabel.nodeId);
    }

    // cleanup leafs
    // eslint-disable-next-line no-plusplus
    for (let i = cachedLabel.parentIds.length - 1; i >= 0; i--) {
      const parentId = cachedLabel.parentIds[i];
      if (i === cachedLabel.parentIds.length - 1) {
        this.cachedBranches[parentId].delete(cachedLabel.nodeId);
      } else {
        this.cachedBranches[parentId].delete(cachedLabel.parentIds[i + 1]);
      }

      if (this.cachedBranches[parentId].size === 0) {
        delete this.cachedBranches[parentId];
      }
    }

    return true;
  }

  /**
   * @param label the label to create a cache entry for or refresh the existing one
   * @returns
   */
  private refreshCachedLabel(labelToCache: LocalizedLabel) {
    const label = labelToCache;
    // flag that signals if the parents of a node have changed (it was moved to another parent for example)
    let parentsDiffer = true;
    let stateDiffers = true;
    label.state = this.getLabelState(label);
    const textChangedAfterGeneration = label.filledTemplateHash === undefined || blake.blake2sHex(label.text!) !== label.filledTemplateHash;

    const cachedLabel = this.cachedLocalisedLabels[label.nodeId];
    if (cachedLabel) {
      parentsDiffer = false;
      stateDiffers = false;

      if (cachedLabel.state!.behind !== label.state!.behind
        || cachedLabel.state!.modified !== label.state!.modified
        || cachedLabel.state!.orginalText !== label.state!.orginalText) {
        stateDiffers = true;
      }

      if (cachedLabel.parentIds.length !== label.parentIds.length) {
        parentsDiffer = true;
      } else {
        cachedLabel.parentIds.forEach((parentId, i) => { if (label.parentIds[i] !== parentId) parentsDiffer = true; });
      }

      if (label.key !== cachedLabel.key && cachedLabel.key) {
        if (this.keysToCachedLabels[cachedLabel.key]) {
          this.keysToCachedLabels[cachedLabel.key].delete(cachedLabel.nodeId);
        }
      }

      if (parentsDiffer) {
        this.removeCachedLabel(label.nodeId);
      } else if (cachedLabel.derivedKey === label.derivedKey
          && cachedLabel.filledTemplateHash === label.filledTemplateHash
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
          && cachedLabel.text === label.text
          && cachedLabel.useSampleValues === label.useSampleValues
          && cachedLabel.width === label.width
          && cachedLabel.x === label.x
          && cachedLabel.y === label.y
          && cachedLabel.textChangedAfterGeneration === textChangedAfterGeneration
          && !stateDiffers) {
        return false;
      }
    }

    this.cachedLocalisedLabels[label.nodeId] = label;

    // enrich hash state (we cant do this in the sandbox layer - since 'TextEncoder' is not defined there)
    this.cachedLocalisedLabels[label.nodeId].textChangedAfterGeneration = label.filledTemplateHash === undefined || blake.blake2sHex(label.text!) !== label.filledTemplateHash;

    if (label.key !== undefined) {
      if (!this.keysToCachedLabels[label.key]) {
        this.keysToCachedLabels[label.key] = new Set<string>();
      } this.keysToCachedLabels[label.key].add(label.nodeId);
    }

    if (parentsDiffer) {
      // eslint-disable-next-line no-plusplus
      for (let i = 0; i < label.parentIds.length; i++) {
        const currentParentId = label.parentIds[i];

        if (!this.cachedBranches[currentParentId]) {
          this.cachedBranches[currentParentId] = new Set<string>();
        }

        // last parent points to the node it self
        if (i === (label.parentIds.length - 1)) {
          this.cachedBranches[currentParentId].add(label.nodeId);
        } else {
          this.cachedBranches[currentParentId].add(label.parentIds[i + 1]);
        }
      }

      if (this.cachedFrames[label.rootFrameId]) {
        this.cachedFrames[label.rootFrameId].localizedLabelIds.push(label.nodeId);
      }
    }

    console.log('chache renewed:');
    console.log(JSON.stringify(label, null, 4));

    return true;
  }

  /**
   * deletion events in figma only provide the node that was deleted - no child node infomation.
   * to detect the deletion of a node we have in cache we store the parent ids. this method provides all leaf nodes
   * for a parent that has been deleted.
   *
   * @param parentId the id of a parent in the parent chain to find a leaf for
   * @returns all leaf nodes that are a child or sub child of the given parent
   */
  private getLeaveIdsById(parentId: string) {
    const children = this.cachedBranches[parentId];
    if (!children) {
      if (this.cachedLocalisedLabels[parentId]) {
        return [parentId];
      }
      return []; // No children found for the specified parentId
    }
    const leafNodes: string[] = [];
    // Check each child node
    children.forEach((childId) => {
      // If this child has no children of its own, it is a leaf node
      if (!this.cachedBranches[childId]) {
        leafNodes.push(childId);
      } else {
        // Recursively find leaf nodes of this child
        const childLeafNodes = this.getLeaveIdsById(childId);
        leafNodes.push(...childLeafNodes);
      }
    });
    return leafNodes;
  }

  private localizedLabelMangerSandbox: LocalizedLabelManager;

  keyStore: MemoryTranslationKeyStore;

  constructor(localisedLabelMangerSandbox: LocalizedLabelManager, keyStore: MemoryTranslationKeyStore) {
    super();
    this.localizedLabelMangerSandbox = localisedLabelMangerSandbox;
    this.keyStore = keyStore;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'LocalizedLabelManager') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          this.processCacheUpdate(event.data.pluginMessage as ChangeEvent);
        }
      }
    });

    this.keyStore.addEventListener('updated', (changesEvent: any) => {
      for (const changedKey of changesEvent.detail.changedKeys) {
        this.handleKeyUpdate(changedKey);
      }
    });

    this.startFillupCache();
  }

  framesIdToLoad = [] as string[];

  async startFillupCache() {
    // we don't await this promise since it will fill the cache in the background
    this.localizedLabelMangerSandbox.startFillupCache();
  }

  private handleKeyUpdate(keyId: string) {
    let cacheUpdated = false;
    if (!this.keysToCachedLabels[keyId]) return;
    console.log('handling keyupdate event for ' + keyId);
    for (const labelIdToUpdate of this.keysToCachedLabels[keyId]) {
      const labelToUpdate = this.cachedLocalisedLabels[labelIdToUpdate];
      if (this.refreshCachedLabel(labelToUpdate)) {
        cacheUpdated = true;
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
    for (const removedHighestLevelId of cacheUpdateMessage.removedHighestLevelParentId) {
      // console.log(removedHighestLevelId);
      const leafIds = this.getLeaveIdsById(removedHighestLevelId);
      // console.log(leafIds);
      for (const labelId of leafIds) {
        if (this.removeCachedLabel(labelId)) {
          // console.log(`label removed: ${JSON.stringify(deleted)}`);
          cacheUpdated = true;
        }
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

  async updateUnmodifiedLabelsWithKey(key: string) {
    if (!this.keysToCachedLabels[key]) {
      return;
    }
    const labelsToUpdate = [] as LocalizedLabel[];
    for (const labelId of this.keysToCachedLabels[key]) {
      const label = this.cachedLocalisedLabels[labelId];

      if (label.keyType === KeyState.Linked && !label.state!.modified) {
        labelsToUpdate.push(label);
      }
    }
    await this.updateToLatestKeyVersion(labelsToUpdate);
  }

  getLabelsWithKey(key: string) {
    const referencingLabels = [] as LocalizedLabel[];
    const labelIds = this.keysToCachedLabels[key];
    if (labelIds === undefined) {
      return referencingLabels;
    }
    for (const labelId of labelIds) {
      referencingLabels.push(this.cachedLocalisedLabels[labelId]);
    }

    return referencingLabels;
  }

  getLabelByNodeId(nodeId: string) {
    return this.cachedLocalisedLabels[nodeId];
  }

  /**
   * The state of a label is represented by two main properties:
   * modified: was the labels text changed in the design compared to the version the label is pointing to
   * behind: the number of changes that have been applied to the language relative to the version the label is currently pointing to
   *
   * Label state changes if:
   *  * the labels text changes and its text is different from the original text
   *  * the keys language/plural the label references changed
   *  *
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
      const currentVersion = BaseTranslationKeyStore.getHistoryEntry(translatedKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);

      if (currentVersion === undefined) {
        console.log(translatedKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);
        console.log(JSON.stringify(translatedKey, null, 3));
        throw new Error(`Illegal state on label ${localizedLabel.key} ${localizedLabel.keyVersion}`);
      }

      state.behind = BaseTranslationKeyStore.getChangesSince(translatedKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);

      if ((!localizedLabel.useSampleValues && currentVersion.translations?.[localizedLabel.language]?.[localizedLabel.pluralId]?.text !== localizedLabel.text)
        || (localizedLabel.useSampleValues && localizedLabel.textChangedAfterGeneration)) {
        state.modified = true;
        state.orginalText = currentVersion.translations?.[localizedLabel.language]?.[localizedLabel.pluralId]?.text;
      }
    }

    return state;
  }

  async getLocalizedLabelsByFrame(frameId: string) {
    // console.log('getLocalizedLabelsByFrame');
    if (this.cachedFrames[frameId]) {
      return this.cachedFrames[frameId].localizedLabelIds.map((labelId) => this.cachedLocalisedLabels[labelId]!);
    }

    // console.log(`refreshing frame with id ${frameId}`);
    const frameData = await this.localizedLabelMangerSandbox.getFrameById(frameId);

    this.cachedFrames[frameId] = {
      frameId,
      frameName: frameData.name,
      localizedLabelIds: frameData.localizedLabelsInFrame.map((node) => node.nodeId),
    };

    for (const freshLocalizedLabel of frameData.localizedLabelsInFrame) {
      this.refreshCachedLabel(freshLocalizedLabel);
    }

    return this.cachedFrames[frameId].localizedLabelIds.map((labelId) => this.cachedLocalisedLabels[labelId]!);
  }

  async setFrameUseSampleValues(frameId: string, useSampleValues: boolean) {
    // we don't have a property on the frame directly - we will derive it from the child labels
    // no need to change the frame it self
    for (const localizedLabelId of this.cachedFrames[frameId].localizedLabelIds) {
      // eslint-disable-next-line no-await-in-loop
      this.setLabelUseSampleValues(localizedLabelId, useSampleValues);
    }
  }

  async setLabelUseSampleValues(localizedLabelId: string, showSampleValues: boolean) {
    const localizeLabel = this.cachedLocalisedLabels[localizedLabelId];
    const translationKey = this.keyStore.getKey(localizeLabel.key!);

    if (localizeLabel.keyType !== KeyState.Linked
      || localizeLabel.state!.modified
      || translationKey === undefined) {
      // we don't change any property also not on the parent - no need to update the label at all
      return;
    }

    const versionToApply = BaseTranslationKeyStore.getHistoryEntry(translationKey, localizeLabel.language, localizeLabel.pluralId, localizeLabel.keyVersion);

    const text = versionToApply?.translations?.[localizeLabel.language]?.[localizeLabel.pluralId]?.text;
    if (text) {
      await this.updateLabelProperties(localizedLabelId, {
        showSampleValues,
        text,
      });
    }
  }

  async setFrameLanguage(frameId: string, targetLanguage: Language, missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>) {
    await this.localizedLabelMangerSandbox.updateFrameProperties(frameId, {
      language: targetLanguage,
    });

    for (const localizedLabelId of this.cachedFrames[frameId].localizedLabelIds) {
      const localisedLabel = this.cachedLocalisedLabels[localizedLabelId]!;
      // eslint-disable-next-line no-await-in-loop
      await this.setLabelLanguage(localisedLabel, targetLanguage, missingTranslationProvider);
    }

    // await this.localisedLabelMangerSandbox.updateFrameById(frameId);
  }

  async setLabelLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Language,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>,
  ) {
    const translationKeyName = cachedLabel.key ?? cachedLabel.derivedKey;
    const labelState = cachedLabel.state!;
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
      const translation = await missingTranslationProvider(cachedLabel.text!, cachedLabel.language, targetLanguage);

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
      }], cachedLabel.pluralId !== Plural.OTHER);
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
          let originLanguage = this.keyStore.getBaseLanugage();
          let originText = translationKey.translations[this.keyStore.getBaseLanugage()!]?.[cachedLabel.pluralId]?.text;

          if (originText === undefined) {
            originLanguage = cachedLabel.language;
            originText = translationKey.translations[cachedLabel.language]![cachedLabel.pluralId]?.text!;
          }

          const translation = await missingTranslationProvider(originText, originLanguage as string, targetLanguage);
          translationKey = await this.keyStore.updateKey(translationKeyName, [{
            language: targetLanguage,
            plural: cachedLabel.pluralId,
            text: translation,
            skip: false,
          }]);
        }
        labelVersion = translationKey.latestVersion;
      }

      const versionToApply = BaseTranslationKeyStore.getHistoryEntry(translationKey, targetLanguage, cachedLabel.pluralId, labelVersion);

      await this.updateLabelProperties(cachedLabel.nodeId, {
        key: translationKeyName,
        keyType: KeyState.Linked,
        language: targetLanguage,
        text: versionToApply?.translations?.[targetLanguage]?.[cachedLabel.pluralId]?.text,
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

    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedKey.latestVersion,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToLatestKeyVersion(localizedLabels: LocalizedLabel[]) {
    for (const localizedLabel of localizedLabels) {
      const translationKey = this.keyStore.getKey(localizedLabel.key!)!;
      const historyEntryForVersion = BaseTranslationKeyStore.getHistoryEntry(translationKey, localizedLabel.rootFrameLanguage, localizedLabel.pluralId, translationKey.latestVersion);

      // eslint-disable-next-line no-await-in-loop
      await this.updateLabelProperties(localizedLabel.nodeId, {
        keyVersion: translationKey.latestVersion,
        text: historyEntryForVersion!.translations?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
        language: localizedLabel.rootFrameLanguage,
      });
    }

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async revertDesignChanges(localizedLabel: LocalizedLabel) {
    const translationKey = this.keyStore.getKey(localizedLabel.key!)!;

    const currentLabelVersion = BaseTranslationKeyStore.getHistoryEntry(translationKey, localizedLabel.language, localizedLabel.pluralId, localizedLabel.keyVersion);
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedLabel.keyVersion,
      text: currentLabelVersion!.translations?.[localizedLabel.language]?.[localizedLabel.pluralId]?.text,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async linkKey(localizedLabel: LocalizedLabel, keyToLinkTo: string) {
    let translationKey = this.keyStore.getKey(keyToLinkTo);

    if (translationKey !== undefined) {
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        plural: Plural.OTHER,
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
      }], localizedLabel.pluralId !== Plural.OTHER);
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion, // its save to use latest version here since we created a whole new key here.
        language: localizedLabel.rootFrameLanguage,
        showSampleValues: localizedLabel.rootFrameUseSampleValues,
        text: localizedLabel.text,
      });
    }

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async unlinkKey(localizedLabel: LocalizedLabel, keyName?: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      key: keyName,
      keyType: KeyState.Unlinked,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateLabelName(localizedLabel: LocalizedLabel, labelName: string) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      labelName,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
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
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;
    const changedPropertiesToForwared = changedProperties;

    if (changedProperties.text !== undefined) {
      if (changedProperties.showSampleValues === true || (changedProperties.showSampleValues === undefined && localizedLabelCached.useSampleValues)) {
        const language = changedProperties.language ?? localizedLabelCached.language;
        const plural = changedProperties.plural ?? localizedLabelCached.pluralId;
        // eslint-disable-next-line no-param-reassign
        changedPropertiesToForwared.text = this.keyStore.fillPlaceholdersWithSampleData(changedProperties.text!, language, plural);
        changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(changedPropertiesToForwared.text);
      } else {
        changedPropertiesToForwared.text = changedProperties.text;
      }
    }

    const localisedLabel = await this.localizedLabelMangerSandbox.updateLabelProperties(nodeId, changedPropertiesToForwared);

    // enrich hash state (we cant do this in the sandbox layer - since 'TextEncoder' is not defined there)
    localisedLabel.textChangedAfterGeneration = localisedLabel.filledTemplateHash === undefined || blake.blake2sHex(localisedLabel.text!) !== localisedLabel.filledTemplateHash;

    if (this.refreshCachedLabel(localisedLabel)) {
      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
    }
  }

  async getSelection() {
    return this.localizedLabelMangerSandbox.getSelection();
  }
}
