import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import { UITranslationKey } from '../keystore/UITranslationKey';
import { Fillins, PlaceholderType } from '../keystore/TranslationKey';

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

const markerCharacter = '​'; // 'X'; // '​';

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

  textChangedAfterGeneration: boolean;

  translation: string;

  fillins: Fillins;

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
    this.textChangedAfterGeneration = localizedLabel.textChangedAfterGeneration;
    this.derivedKey = localizedLabel.derivedKey;
    this.fillins = localizedLabel.fillins;
    this.translation = this.toTranslation();
    this.state = this.getState();
  }

  static getPlaceholdersSorted(fillins: Fillins) {
    const placeholderByFillin = Object.keys(fillins).sort((placeholderA, placeholderB) => {
      if (fillins[placeholderA].value !== fillins[placeholderB].value) {
        // TODO #8 we just convert the fillin values to a string. The value is a number or a string do we need to take formating into account?
        return (`${fillins[placeholderA].value}`).localeCompare(`${fillins[placeholderB].value}`);
      }
      return placeholderA.localeCompare(placeholderB);
    });
    return placeholderByFillin;
  }

  static fillTranslation(text: string, fillins: Fillins) {
    const pattern = /\[\[([A-Za-z_]{2,})?(?:#(\d+))?(?::*([sdf])(?:\.(\d+))?)?\]\]/g;

    const placeholderByFillin = UILocalizedLabel.getPlaceholdersSorted(fillins);
    // const wholeMatch = paramMatch[0];
    // const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    // const name = paramMatch[2];

    return text.replace(pattern, (match, name, _argumentPosition) => {
      const placeholderName = name;
      if (placeholderName && fillins[placeholderName]) {
        const extensionLength = placeholderByFillin.indexOf(placeholderName) + 1;
        return fillins[placeholderName].value + markerCharacter.repeat(extensionLength);
      }
      return match;
    });
  }

  private toTranslation() {
    const translatedKey = !(this.keyType !== KeyState.Linked) ? this.manager.keyStore.getKey(this.key!) : undefined;
    if (!translatedKey) {
      return this.text; // for now we just return the original text in case we don't have a connected text
    }

    const currentKeyVersion = translatedKey.getHistoryEntry(this.language, this.pluralId, this.keyVersion);
    const currentTranslation = currentKeyVersion?.translations?.[this.language]?.[this.pluralId]?.text;

    if (currentTranslation === undefined) {
      return this.text;
    }

    // takes the text of the label and replaces all fillins with the placeholders
    const placeholderByFillin = UILocalizedLabel.getPlaceholdersSorted(this.fillins);

    // extract the placeholder from the current translation
    const orginalPlaceholders = UITranslationKey.extractPlaceholdersInText(currentTranslation);

    let translation = this.text;
    // eslint-disable-next-line for-direction, no-plusplus
    for (let i = placeholderByFillin.length - 1; i >= 0; i--) {
      const currentPlaceholderName = placeholderByFillin[i];
      const filinValue = this.fillins[currentPlaceholderName].value;
      const nonPlaceholderParts = translation.split(filinValue + markerCharacter.repeat(i + 1));
      const placeholdersInKey = orginalPlaceholders.filter((orgPlaceholder) => orgPlaceholder.name === currentPlaceholderName);

      // eslint-disable-next-line prefer-destructuring
      translation = nonPlaceholderParts[0];
      // eslint-disable-next-line no-plusplus
      for (let nonPlaceHolderPartIndex = 1; nonPlaceHolderPartIndex < nonPlaceholderParts.length; nonPlaceHolderPartIndex++) {
        if (placeholdersInKey.length === 0) {
          translation = `${translation}[[${currentPlaceholderName}]]`;
        } else {
          const nextPlacehoderIndex = Math.min(placeholdersInKey.length - 1, nonPlaceHolderPartIndex - 1);
          const placeholder = placeholdersInKey[nextPlacehoderIndex];
          let renderedPlaceholder = '';
          if (placeholder.type === PlaceholderType.string) {
            if (placeholder.specifiedArgumentPosition !== undefined) {
              renderedPlaceholder = `[[${placeholder.name}#${placeholder.specifiedArgumentPosition}]]`;
            } else {
              renderedPlaceholder = `[[${placeholder.name}]]`;
            }
          } else if (placeholder.type === PlaceholderType.integer) {
            if (placeholder.specifiedArgumentPosition !== undefined) {
              renderedPlaceholder = `[[${placeholder.name}#${placeholder.specifiedArgumentPosition}:d]]`;
            } else {
              renderedPlaceholder = `[[${placeholder.name}:d]]`;
            }
          } else { // float
            const decimalPlaces = placeholder.decimalPlaces ? `.${placeholder.decimalPlaces}` : '';
            if (placeholder.specifiedArgumentPosition !== undefined) {
              renderedPlaceholder = `[[${placeholder.name}#${placeholder.specifiedArgumentPosition}:f${decimalPlaces}]]`;
            } else {
              renderedPlaceholder = `[[${placeholder.name}:f${decimalPlaces}]]`;
            }
          }

          translation = `${translation}${renderedPlaceholder}${nonPlaceholderParts[nonPlaceHolderPartIndex]}`;
        }
      }
    }

    return translation;
  }

  /**
   * The state of a label is represented by two main properties:
   * modified: was the labels text changed in the design compared to the version of the key which the label is pointing to
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
      const currentVersion = translatedKey.getHistoryEntry(this.language, this.pluralId, this.keyVersion);

      if (currentVersion === undefined) {
        state.translationDeleted = true;
      } else {
        state.behind = translatedKey.getChangesSince(this.language, this.pluralId, this.keyVersion);

        const translation = currentVersion.translations[this.language]?.[this.pluralId]?.text!;

        // eslint-disable-next-line no-param-reassign
        if (translation !== this.translation) {
          const filledTranslation = translation ? UILocalizedLabel.fillTranslation(translation, this.fillins) : 'missing translation!'; // TODO #9 how to deal with missing translations?
          state.modified = true;
          state.orginalText = filledTranslation;
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

    const versionToApply = translationKey.getHistoryEntry(this.language, this.pluralId, this.keyVersion);

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

      const versionToApply = translationKey.getHistoryEntry(targetLanguage, this.pluralId, labelVersion);

      await this.manager.updateLabelProperties(this.nodeId, {
        key: translationKeyName,
        keyType: KeyState.Linked,
        language: targetLanguage,
        text: versionToApply?.translations?.[targetLanguage]?.[this.pluralId]?.text,
        keyVersion: labelVersion,
      });
    }
  }

  toJSON() {
    const localizedObject = {
      ...this,
    } as any;
    localizedObject.manager = undefined;
    return localizedObject as LocalizedLabel;
  }
}
