import { KeyState, LocalizedLabel } from './LocalizedLabel';
import Plural from '../base/Plural';
import LocalizedLabelManager from './LocalizedLabelManager';
import Language from '../base/Language';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';

export default class LocalizedLabelManagerUI extends EventTarget {
  private cachedLokalisedLabels = {} as { [labelId: string]:
  LocalizedLabel
  };

  private cachedKeysToLabels = {} as {
    [keyId: string]: Set<string>
  };

  private cacheInvalidationIds = {} as { [nodeId: string]: Set<string> };

  private cachedFrames = {} as { [rootFrameId: string]: {
    frameId: string,
    frameName: string,
    lokalizedLabels: LocalizedLabel[]
  } };

  localisedLabelMangerSandbox: LocalizedLabelManager;

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

  invalidateFrame(frameId: string) {
    //  console.log('invalidating frame');
    if (this.cachedFrames[frameId] !== undefined) {
      this.cachedFrames[frameId].lokalizedLabels.forEach((label) => {
        this.invalidateCacheIfNeeded(label, true);
      });
      delete this.cachedFrames[frameId];
    }
  }

  processCacheUpdate(cacheUpdateMessage: any) {
    // console.log('processCacheUpdate');
    for (const frameIdToInvalidate of cacheUpdateMessage.rootFrameIdsToReload) {
    //  console.log(`invalidating frame ${frameIdToInvalidate}`);
      this.invalidateFrame(frameIdToInvalidate);
    }

    for (const changedNodeById of cacheUpdateMessage.changedNodesById) {
      const frameIdsToInvalidate = this.cacheInvalidationIds[changedNodeById];
      if (frameIdsToInvalidate) {
        for (const frameIdToInvalidate of frameIdsToInvalidate) {
          //    console.log(`invalidating frame ${frameIdToInvalidate} - changed child`);
          this.invalidateFrame(frameIdToInvalidate);
        }
      }
    }

    for (const deletedNodeId of cacheUpdateMessage.deletedNodeIds) {
      const frameIdsToInvalidate = this.cacheInvalidationIds[deletedNodeId];
      if (frameIdsToInvalidate) {
        for (const frameIdToInvalidate of frameIdsToInvalidate) {
          //   console.log(`invalidating frame ${frameIdToInvalidate} - deleted child`);
          this.invalidateFrame(frameIdToInvalidate);
        }
      }

      if (this.cachedLokalisedLabels[deletedNodeId] !== undefined) {
        // console.log('removing the cache');
        this.invalidateCacheIfNeeded(this.cachedLokalisedLabels[deletedNodeId], true);
      }
    }

    for (const changedLabel of cacheUpdateMessage.changedLabels) {
      // console.log(`invalidating node${changedLabel.nodeId}`);
      this.invalidateCacheIfNeeded(changedLabel);
      this.cachedLokalisedLabels[changedLabel.nodeId] = changedLabel;
      if (changedLabel.key !== undefined) {
        if (this.cachedKeysToLabels[changedLabel.key] === undefined) {
          this.cachedKeysToLabels[changedLabel.key] = new Set<string>();
        }
        this.cachedKeysToLabels[changedLabel.key].add(changedLabel.nodeId);
      }

      if (this.cachedFrames[changedLabel.rootFrameId]) {
      //  console.log('updating cached');
        const updatedLabels = this.cachedFrames[changedLabel.rootFrameId].lokalizedLabels.map((localizedlabel) => {
          if (localizedlabel.nodeId === changedLabel.nodeId) {
            //   console.log('replacing');
            return changedLabel;
          }
          return localizedlabel;
        });

        this.cachedFrames[changedLabel.rootFrameId].lokalizedLabels = updatedLabels;
      } else {
        // console.log(`no cache found for frame: ${changedLabel.rootFrameId}`);
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

  async setLanguageToFrame(frameId: string, targetLanguage: Language, missingTranslationProvider: (input: string, language: string) => Promise<string | undefined>) {
    for (const localizedLabel of this.cachedFrames[frameId].lokalizedLabels) {
      this.setLanguage(localizedLabel, targetLanguage, missingTranslationProvider);
    }

    this.localisedLabelMangerSandbox.updateFrameProperties(frameId, {
      language: targetLanguage,
    });
  }

  async setLanguage(
    cachedLabel: LocalizedLabel,
    targetLanguage: Language,
    missingTranslationProvider: (input: string, language: string) => Promise<string | undefined>,
  ) {
    let translationKeyName : string | undefined;
    // the label has not yet a linked to a key
    if (cachedLabel.keyType === KeyState.Unset) {
      // derivation possible?
      if (cachedLabel.derivedKey !== undefined) {
        translationKeyName = cachedLabel.derivedKey;
      }
    } else if (cachedLabel.keyType === KeyState.Linked) {
      translationKeyName = cachedLabel.key!;
    }

    if (cachedLabel.keyType === KeyState.Unlinked || translationKeyName === undefined) {
      // key was explicitly unlinked or it can't be derived or is not set
      return;
    }

    const translationKey = this.keyStore.getKey(translationKeyName);
    // check if key exists
    if (translationKey === undefined) {
      const translation = await missingTranslationProvider(cachedLabel.text, targetLanguage);

      // ok we have a fresh key to create - no translation to expect
      const createdKey = await this.keyStore.createKey(translationKeyName, [{
        language: cachedLabel.rootFrameLanguage,
        plural: cachedLabel.pluralId,
        text: cachedLabel.text,
        skip: false,
      }, {
        language: targetLanguage,
        plural: cachedLabel.pluralId,
        text: translation,
        skip: false,
      }]);

      this.updateLocalisedLabelProperties(cachedLabel.nodeId, {
        key: translationKeyName,
        keyType: KeyState.Linked,
        text: translation,
        keyVersion: createdKey.translations[cachedLabel.rootFrameLanguage]![cachedLabel.pluralId]!.version,
      });
    } else {
      // updating key
      // eslint-disable-next-line no-lonely-if -- TODO remove when all todos are mimplemtned
      if (translationKey.translations[targetLanguage]?.[cachedLabel.pluralId]?.text === undefined) {
        if (translationKey.translations[targetLanguage]?.[cachedLabel.pluralId]?.skip === true) {
          // TODO what to do in autotranslate in case a string is not meant to be translated into the given language?
          // - option a: we replace the text with the base language
          // - we set the label to an "unset" text
          // how does the label tell the outside about its state?
          return;
        }
        // TODO check if base language exists and if figmas text differs -> how to handle this?
        // TODO how do we handle labels with useSampleValue == true?
        // translation missing - generate it and update the translation key
        const translation = await missingTranslationProvider(cachedLabel.text, targetLanguage);
        const updatedKey = await this.keyStore.updateKey(translationKeyName, [{
          language: targetLanguage,
          plural: cachedLabel.pluralId,
          text: translation,
          skip: false,
        }]);

        this.updateLocalisedLabelProperties(cachedLabel.nodeId, {
          key: translationKeyName,
          keyType: KeyState.Linked,
          text: translation,
          keyVersion: updatedKey.translations[targetLanguage]![cachedLabel.pluralId]!.version,
        });
      } else {
        // we have a translation - nothing to do - the text will get applied directly as soon as the parent frames language changed
        this.updateLocalisedLabelProperties(cachedLabel.nodeId, {
          key: translationKeyName,
          keyType: KeyState.Linked,
          text: translationKey.translations[targetLanguage]?.[cachedLabel.pluralId]?.text!,
          keyVersion: translationKey.translations[targetLanguage]![cachedLabel.pluralId]!.version,
        });
      }
    }
  }

  async updateLocalisedLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    keyType?: KeyState,
    key?: string,
    keyVersion?: number,
    plural?: Plural,
    text?: string,
    showSampleValues?: boolean,
    showSampleValuesInherited?: boolean
  }) {
    const localisedLabel = await this.localisedLabelMangerSandbox.updateLocalisedLabelProperties(nodeId, changedProperties);
    this.cachedLokalisedLabels[nodeId] = localisedLabel;
  }

  async getLocalizedLabelsByFrame(frameId: string) {
    if (this.cachedFrames[frameId]) {
      return this.cachedFrames[frameId];
    }

    // console.log(`refreshing frame with id ${frameId}`);

    const frameData = await this.localisedLabelMangerSandbox.getFrameById(frameId);

    this.cachedFrames[frameId] = {
      frameId,
      frameName: frameData.name,
      lokalizedLabels: frameData.localizedLabelsInFrame,
    };

    for (const freshLocalizedLabel of frameData.localizedLabelsInFrame) {
      this.invalidateCacheIfNeeded(freshLocalizedLabel);
      this.cachedLokalisedLabels[freshLocalizedLabel.nodeId] = freshLocalizedLabel;
      if (freshLocalizedLabel.key !== undefined) {
        if (this.cachedKeysToLabels[freshLocalizedLabel.key] === undefined) {
          this.cachedKeysToLabels[freshLocalizedLabel.key] = new Set<string>();
        }
        this.cachedKeysToLabels[freshLocalizedLabel.key].add(freshLocalizedLabel.nodeId);
      }
    }

    return this.cachedFrames[frameId];
  }

  invalidateCacheIfNeeded(updatedLocalizedLabel: LocalizedLabel, force: boolean = false) {
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
