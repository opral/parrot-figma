import blake from 'blakejs';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import { Plural } from '../base/Plural';
import LocalizedLabelManager from './LocalizedLabelManager';
import { Language } from '../base/Language';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';
import ChangeEvent from './ChangeEvent';

import { ILocalizedLabelManagerUI, UILocalizedLabel } from './UILocalizedLabel';
import { Fillins } from '../keystore/TranslationKey';

export default class LocalizedLabelManagerUI extends EventTarget implements ILocalizedLabelManagerUI {
  // mapping from nodeId to localizied label instance
  private cachedLocalisedLabels = {} as {
    [labelId: string]: UILocalizedLabel
  };

  // mapping from a translationKey to labelId - used to get references of a translation key in design
  private keysToCachedLabels = {} as {
    [keyId: string]: Set<string>
  };

  // cached root frames containing localized labels
  private cachedFrames = {} as { [rootFrameId: string]: {
    frameId: string,
    frameName?: string,
    localizedLabelIds: Set<string>
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
      this.cachedFrames[cachedLabel.rootFrameId].localizedLabelIds.delete(labelId);
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
   * @returns true if a refresh was needed
   */
  private refreshCachedLabel(labelToCache: LocalizedLabel) {
    console.log('refreshCachedLabel');
    const label = new UILocalizedLabel(this, labelToCache);

    // flag that signals if the parents of a node have changed (it was moved to another parent for example)
    let parentsDiffer = true;
    let stateDiffers = true;

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

      // key the lable referres to changed - remove from keys to labels cache
      if (label.key !== cachedLabel.key && cachedLabel.key) {
        if (this.keysToCachedLabels[cachedLabel.key]) {
          this.keysToCachedLabels[cachedLabel.key].delete(cachedLabel.nodeId);
        }
      }

      if (parentsDiffer) {
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
          && cachedLabel.text === label.text
          && cachedLabel.useSampleValues === label.useSampleValues
          && cachedLabel.width === label.width
          && cachedLabel.x === label.x
          && cachedLabel.y === label.y) {
        return false;
      }
    }

    this.cachedLocalisedLabels[label.nodeId] = label;

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

  /**
   * deletion events in figma only provide the node that was deleted - *NO* child node infomation.
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

  constructor(localizedLabelMangerSandbox: LocalizedLabelManager, keyStore: MemoryTranslationKeyStore) {
    super();
    this.localizedLabelMangerSandbox = localizedLabelMangerSandbox;
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
  }

  framesIdToLoad = [] as string[];

  async startFillupCache() {
    // we don't await this promise since it will fill the cache in the background
    this.localizedLabelMangerSandbox.startFillupCache();
  }

  private handleKeyUpdate(keyId: string) {
    let cacheUpdated = false;
    if (!this.keysToCachedLabels[keyId]) return;
    console.log(`handling keyupdate event for ${keyId}`);
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

  getLabelState(localizedLabel: LocalizedLabel): { behind: number, orginalText?: string, modified: boolean } {
    return (new UILocalizedLabel(this, localizedLabel)).getState();
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
    await this.keyStore.updateKey(keyName, translations, plural, fillins, quantity);

    await this.updateUnmodifiedLabelsWithKey(keyName);

    this.keyStore.parentKeyStore.commitUndo();
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
      language: localizedLabel.language as Language, plural: localizedLabel.pluralId as Plural, text: localizedLabel.translation, skip: false,
    }]);

    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedKey.latestVersion,
    });

    await this.updateUnmodifiedLabelsWithKey(localizedLabel.key!);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async updateToLatestKeyVersion(localizedLabels: LocalizedLabel[]) {
    const updatePromises = [];
    for (const localizedLabel of localizedLabels) {
      const translationKey = this.keyStore.getKey(localizedLabel.key!)!;
      const historyEntryForVersion = translationKey.getHistoryEntry(localizedLabel.rootFrameLanguage, localizedLabel.pluralId, translationKey.latestVersion);

      const fillins = { ...localizedLabel.fillins };
      for (const placeholderName of Object.keys(fillins)) {
        if (fillins[placeholderName].default && translationKey.defaultFillins[placeholderName]) {
          fillins[placeholderName].value = translationKey.defaultFillins[placeholderName].value;
        }
      }

      // eslint-disable-next-line no-await-in-loop
      updatePromises.push(this.updateLabelProperties(localizedLabel.nodeId, {
        keyVersion: translationKey.latestVersion,
        translation: historyEntryForVersion!.translations?.[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
        language: localizedLabel.rootFrameLanguage,
        fillins,
      }));
    }

    await Promise.all(updatePromises);

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async revertDesignChanges(localizedLabel: UILocalizedLabel) {
    await this.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: localizedLabel.keyVersion,
      translation: localizedLabel.state?.orginalText,
    });

    await this.localizedLabelMangerSandbox.commitUndo();
  }

  async linkKey(localizedLabel: LocalizedLabel, keyToLinkTo: string, language: Language, plural: Plural) {
    let translationKey = this.keyStore.getKey(keyToLinkTo);

    if (translationKey !== undefined) {
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        plural,
        language,
        keyVersion: translationKey.latestVersion,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        translation: localizedLabel.text,
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      translationKey = await this.keyStore.createKey(keyToLinkTo, [{
        language,
        plural,
        text: localizedLabel.text,
        skip: false,
      }], plural !== Plural.OTHER);
      await this.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion, // its save to use latest version here since we created a whole new key here.
        language,
        plural,
        // showSampleValues: localizedLabel.rootFrameUseSampleValues,
        translation: localizedLabel.text,
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

  async updateLabelTranslation(localizedLabel: LocalizedLabel, translation: string) {
    this.updateLabelProperties(localizedLabel.nodeId, {
      translation,
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
    translation?: string,
    fillins?: Fillins,
    filledTemplateHash?: string
  }) {
    const localizedLabelCached = this.cachedLocalisedLabels[nodeId]!;
    const changedPropertiesToForwared = changedProperties;

    const key = changedProperties.key ?? localizedLabelCached.key;
    const translationKey = key ? this.keyStore.getKey(key) : undefined;

    const defaultFillIns = translationKey ? { ...translationKey.defaultFillins } : {} as Fillins;
    const labelFillins = changedProperties.fillins ?? localizedLabelCached.fillins;

    // eslint-disable-next-line no-param-reassign
    changedPropertiesToForwared.fillins = labelFillins;

    for (const parameterName of Object.keys(defaultFillIns)) {
      if (labelFillins[parameterName] && labelFillins[parameterName].default) {
        labelFillins[parameterName] = { default: true, value: defaultFillIns[parameterName].value };
      }
    }

    let translation = changedProperties.translation ?? localizedLabelCached.translation as string | undefined;

    if (changedProperties.language !== undefined
      || changedProperties.plural !== undefined
      || changedProperties.keyVersion !== undefined) {
      if (localizedLabelCached.keyType === KeyState.Linked) {
        const language = changedProperties.language ?? localizedLabelCached.language;
        const plural = changedProperties.plural ?? localizedLabelCached.pluralId;
        const version = changedProperties.keyVersion ?? localizedLabelCached.keyVersion;
        translation = changedProperties.translation ? changedProperties.translation : translationKey?.getInVersion(version).translations[language]?.[plural]?.text;
      }
    }
    
    // eslint-disable-next-line no-param-reassign
    changedPropertiesToForwared.translation = translation ? UILocalizedLabel.toText(translation, labelFillins) : 'missing translation!'; // TODO #9 how to deal with missing translations?
    changedPropertiesToForwared.filledTemplateHash = blake.blake2sHex(changedPropertiesToForwared.translation);

    const localizedLabel = await this.localizedLabelMangerSandbox.updateLabelProperties(nodeId, changedPropertiesToForwared);

    if (this.refreshCachedLabel(localizedLabel)) {
      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
    }
  }

  async getSelection() {
    const selectionFromFigma = await this.localizedLabelMangerSandbox.getSelection();
    const selectionEnhanced = {} as {
      [keyId: string]: {
        rootFrameId: string | undefined;
        selectedNodeId: string,
        parentSelected: boolean,
        isLabel: boolean,
      }
    };

    for (const selectedNode of selectionFromFigma) {
      if (this.cachedLocalisedLabels[selectedNode.selectedNodeId]) {
        // the node within the selection is a label
        selectionEnhanced[selectedNode.selectedNodeId] = {
          parentSelected: false,
          isLabel: true,
          ...selectedNode,
        };
      } else if (selectedNode.rootFrameId && this.cachedFrames[selectedNode.rootFrameId]) {
        // node is not a label - could be a container - check if a label within the same frame exist with the selected node as parent
        for (const localisedLabelIdInFrame of this.cachedFrames[selectedNode.rootFrameId].localizedLabelIds) {
          if (!selectionEnhanced[selectedNode.selectedNodeId] && this.cachedLocalisedLabels[localisedLabelIdInFrame].parentIds.includes(selectedNode.selectedNodeId)) {
            // is one of the labels parents the selected node and has not been taken into account yet
            selectionEnhanced[selectedNode.selectedNodeId] = {
              parentSelected: true,
              isLabel: true,
              rootFrameId: selectedNode.rootFrameId,
              selectedNodeId: localisedLabelIdInFrame,
            };
          }
        }
      } else if (!selectionEnhanced[selectedNode.selectedNodeId]) {
        selectionEnhanced[selectedNode.selectedNodeId] = {
          parentSelected: false,
          isLabel: false,
          rootFrameId: selectedNode.rootFrameId,
          selectedNodeId: selectedNode.selectedNodeId,
        };
      }
    }

    return selectionEnhanced;
  }
}
