import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';
import { KeyState, LocalizedLabel } from './LocalizedLabel';

export interface ILocalizedLabelManagerUI {
  keyStore: any;
  updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    keyType?: KeyState,
    key?: string,
    keyVersion?: number,
    language?: Language,
    plural?: Plural,
    text?: string,
    filledTemplateHash?: string,
    showSampleValues?: boolean,
  }): Promise<void>;

}

export class UILocalizedLabel implements LocalizedLabel {
  parentIds: string[];

  pageId: string;

  pageName: string;

  rootFrameId: string;

  rootFrameName: string;

  nodeId: string;

  name: string;

  x: number;

  y: number;

  width: number;

  height: number;

  rootFrameLanguage: Language;

  language: Language;

  rootFrameUseSampleValues: boolean;

  useSampleValues: boolean;

  keyType: KeyState;

  key?: string | undefined;

  keyVersion: number;

  pluralId: Plural;

  text: string;

  state?: { behind: number; orginalText?: string | undefined; modified: boolean; } | undefined;

  filledTemplateHash?: string | undefined;

  textChangedAfterGeneration: boolean;

  derivedKey?: string | undefined;

  // utils
  // to manage the label within the UI keep a reference of the Label manager
  manager: ILocalizedLabelManagerUI;

  constructor(manager: ILocalizedLabelManagerUI, localizedLabel: LocalizedLabel) {
    this.manager = manager;

    this.parentIds = localizedLabel.parentIds;
    this.pageId = localizedLabel.pageId;
    this.pageName = localizedLabel.pageName;
    this.rootFrameId = localizedLabel.rootFrameId;
    this.rootFrameName = localizedLabel.rootFrameName;
    this.nodeId = localizedLabel.nodeId;
    this.name = localizedLabel.name;
    this.x = localizedLabel.x;
    this.y = localizedLabel.y;
    this.width = localizedLabel.width;
    this.height = localizedLabel.height;
    this.rootFrameLanguage = localizedLabel.rootFrameLanguage;
    this.language = localizedLabel.language;
    this.rootFrameUseSampleValues = localizedLabel.rootFrameUseSampleValues;
    this.useSampleValues = localizedLabel.useSampleValues;
    this.keyType = localizedLabel.keyType;
    this.key = localizedLabel.key;
    this.keyVersion = localizedLabel.keyVersion;
    this.pluralId = localizedLabel.pluralId;
    this.text = localizedLabel.text;
    this.state = localizedLabel.state;
    this.filledTemplateHash = localizedLabel.filledTemplateHash;
    this.textChangedAfterGeneration = localizedLabel.textChangedAfterGeneration;
    this.derivedKey = localizedLabel.derivedKey;
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
  getState(): { behind: number, orginalText?: string, modified: boolean } {
    const state = {
      modified: false,
      translationDeleted: false,
      behind: 0,
      orginalText: undefined as string | undefined,
    };

    const translatedKey = this.keyType !== KeyState.Unset ? this.manager.keyStore.getKey(this.key!) : undefined;

    if (translatedKey) {
      const currentVersion = MemoryTranslationKeyStore.getHistoryEntry(translatedKey, this.language, this.pluralId, this.keyVersion);

      if (currentVersion === undefined) {
        state.translationDeleted = true;
      } else {
        state.behind = MemoryTranslationKeyStore.getChangesSince(translatedKey, this.language, this.pluralId, this.keyVersion);

        if ((!this.useSampleValues && currentVersion.translations?.[this.language]?.[this.pluralId]?.text !== this.text)
          || (this.useSampleValues && this.textChangedAfterGeneration)) {
          state.modified = true;
          state.orginalText = currentVersion.translations?.[this.language]?.[this.pluralId]?.text;
        }
      }
    }

    return state;
  }

  async setUseSampleValues(showSampleValues: boolean) {
    if (this.keyType !== KeyState.Linked) {
      return;
    }

    const translationKey = this.manager.keyStore.getKey(this.key!);

    if (this.keyType !== KeyState.Linked
      || this.state!.modified
      || translationKey === undefined) {
      // we don't change any property also not on the parent - no need to update the label at all
      return;
    }

    const versionToApply = MemoryTranslationKeyStore.getHistoryEntry(translationKey, this.language, this.pluralId, this.keyVersion);

    const text = versionToApply?.translations?.[this.language]?.[this.pluralId]?.text;
    if (text) {
      await this.manager.updateLabelProperties(this.nodeId, {
        showSampleValues,
        text,
      });
    }
  }

  async setLanguage(
    targetLanguage: Language,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>,
  ) {
    if (this.keyType === KeyState.Unset) {
      return;
    }

    const translationKeyName = this.key ?? this.derivedKey;
    const labelState = this.state!;
    let labelVersion = this.keyVersion;

    if (this.keyType === KeyState.NoKey // we don't update unlinked labels
      || translationKeyName === undefined // or labels where we cant derive or get the key
      || labelState.modified) { // or that are modified
      // root language has changed - trigger cache update
      await this.manager.updateLabelProperties(this.nodeId, {});
      return;
    }

    let translationKey = this.manager.keyStore.getKey(translationKeyName);
    // check if key exists
    if (translationKey === undefined) {
      const translation = await missingTranslationProvider(this.text!, this.language, targetLanguage);

      // ok we have a fresh key to create - no translation to expect
      translationKey = await this.manager.keyStore.createKey(translationKeyName, [{
        language: this.language,
        plural: this.pluralId,
        text: this.text,
        skip: false,
      }, {
        language: targetLanguage,
        plural: this.pluralId,
        text: translation,
        skip: false,
      }], this.pluralId !== Plural.OTHER);
      labelVersion = translationKey.latestVersion;
    } else {
      if (labelState.behind === 0) {
        // updating key
        if (translationKey.translations[targetLanguage]?.[this.pluralId]?.text === undefined) {
          if (translationKey.translations[targetLanguage]?.[this.pluralId]?.skip === true) {
            // TODO #3 think about fall back mechanism:
            // in case the key for the given plural is skipped try to fall back to others
            // if this is skipped as well fall back to base language
            //  - for now we just don't change the label
            await this.manager.updateLabelProperties(this.nodeId, {});
            return;
          }

          // translation missing - generate it and update the translation key
          let originLanguage = this.manager.keyStore.getBaseLanugage();
          let originText = translationKey.translations[this.manager.keyStore.getBaseLanugage()!]?.[this.pluralId]?.text;

          if (originText === undefined) {
            originLanguage = this.language;
            originText = translationKey.translations[this.language]![this.pluralId]?.text!;
          }

          const translation = await missingTranslationProvider(originText, originLanguage as string, targetLanguage);
          translationKey = await this.manager.keyStore.updateKey(translationKeyName, [{
            language: targetLanguage,
            plural: this.pluralId,
            text: translation,
            skip: false,
          }]);
        }
        labelVersion = translationKey.latestVersion;
      }

      const versionToApply = MemoryTranslationKeyStore.getHistoryEntry(translationKey, targetLanguage, this.pluralId, labelVersion);

      await this.manager.updateLabelProperties(this.nodeId, {
        key: translationKeyName,
        keyType: KeyState.Linked,
        language: targetLanguage,
        text: versionToApply?.translations?.[targetLanguage]?.[this.pluralId]?.text,
        keyVersion: labelVersion,
      });
    }
  }
}
