/* eslint-disable consistent-return */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';

export interface TranslationKeyStore {
  createKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[], plural: boolean) : Promise<TranslationKey>
  getKey(keyName: string) : TranslationKey | undefined
  updateKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[], plural?: boolean) : Promise<TranslationKey>
  deleteKey(keyName: string) : Promise<void>
  getHistory(translationKeyName: string) : Promise<HistoryEntry[]>
  load(): Promise<TranslationKeys>
  importFromLocalise() : Promise<void>
}

export class BaseTranslationKeyStore {
  static getHistoryEntry(key: TranslationKey, language: Language, plural: Plural, version: number) : HistoryEntry | undefined {
    // iterate backward until we have a match
    let currentVersion = version;
    while (currentVersion >= 0) {
      if (key.history[currentVersion]?.translations?.[language]?.[plural]) {
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
      if (key.history[currentVersion]?.translations?.[language]?.[plural]) {
        changeCounter += 1;
      }
      currentVersion -= 1;
    }
    return changeCounter;
  }
}
