/* eslint-disable consistent-return */
import Language from '../base/Language';
import Plural from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';

export interface TranslationKeyStore {
  createKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[]) : Promise<TranslationKey>
  getKey(keyName: string) : TranslationKey | undefined
  updateKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[]) : Promise<TranslationKey>
  deleteKey(keyName: string) : Promise<void>
  getHistory(translationKeyName: string) : Promise<HistoryEntry[]>
  load(): Promise<TranslationKeys>
  importFromLocalise() : Promise<void>
}

export abstract class BaseTranslationKeyStore implements TranslationKeyStore {
  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[]): Promise<TranslationKey> {
    const existingKey = this.getKey(keyName);
    if (existingKey) {
      throw Error('tried to create a key that already existed');
    }

    const plurals = [] as Plural[];

    const translationsObj = {} as any;
    for (const translation of translations) {
      if (!translationsObj[translation.language]) {
        translationsObj[translation.language] = {};
      }

      if (!translationsObj[translation.language][translation.plural]) {
        translationsObj[translation.language][translation.plural] = {};
      }

      translationsObj[translation.language][translation.plural].text = translation.text;

      if (plurals.indexOf(translation.plural) === -1) {
        plurals.push(translation.plural);
      }
    }

    const createdKey = {
      latestVersion: 0,
      keyName,
      tags: [],
      plurals,
      translations: translationsObj,
      history: [], // first history entry will be added in persistKey method...
    } as TranslationKey;
    return this.persistKey(createdKey);
  }

  async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[]) {
    const keyToUpdate = this.getKey(keyName);

    if (keyToUpdate === undefined) {
      throw new Error(`Key [${keyName}] not found!`);
    }

    for (const translation of translations) {
      // if no key for the given language exists - create an empty one for plural 'other' with version -1
      if (!keyToUpdate.translations[translation.language]) {
        keyToUpdate.translations[translation.language] = {
          other: {
            version: -1,
            skip: false,
          },
        };
      }

      // if the target plural does not extist yet create a dummy one - vlues get overriden in next step
      if (!keyToUpdate.translations[translation.language]![translation.plural]) {
        keyToUpdate.translations[translation.language]![translation.plural] = {
          version: -1,
          skip: false,
        };
      }

      // create a new translation entry with increased version
      keyToUpdate.translations[translation.language]![translation.plural]!.version = keyToUpdate.latestVersion + 1;
      keyToUpdate.translations[translation.language]![translation.plural]!.text = translation.text;
      keyToUpdate.translations[translation.language]![translation.plural]!.skip = translation.skip;

      if (keyToUpdate.plurals.indexOf(translation.plural as Plural) === -1) {
        keyToUpdate.plurals.push(translation.plural as Plural);
      }
    }
    return this.persistKey(keyToUpdate);
  }

  static getHistoryEntry(key: TranslationKey, language: Language, plural: Plural, version: number) : HistoryEntry | undefined {
    // iterate backward until we have a match
    let currentVersion = version;
    while (currentVersion >= 0) {
      if (key.history[currentVersion]?.[language]?.[plural]) {
        return key.history[currentVersion];
      }
      currentVersion -= 1;
    }
    return undefined;
  }

  static getChangesSince(key: TranslationKey, language: Language, plural: Plural, version: number) {
    let changeCounter = 0;

    let currentVersion = key.latestVersion;
    while (currentVersion >= 0 && currentVersion > version) {
      if (key.history[currentVersion]?.[language]?.[plural]) {
        changeCounter += 1;
      }
      currentVersion -= 1;
    }
    return changeCounter;
  }

  abstract getHistory(translationKeyName: string) : Promise<HistoryEntry[]>;

  abstract getKey(keyName: string): TranslationKey | undefined;

  abstract deleteKey(keyName: string): Promise<void>;

  abstract load(): Promise<TranslationKeys>;

  abstract persistKey(translationKey: TranslationKey): Promise<TranslationKey>;

  abstract importFromLocalise(): Promise<void>;

}
