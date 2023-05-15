import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { HistoryEntry, TranslationKey } from './TranslationKey';

export interface UITranslationKeyStore {
}

export class UITranslationKey implements TranslationKey {
  keyName: string;

  latestVersion: number;

  historyTags: {
    // map a tag identifier (we use a number for size reasons) to a version index of a key
    [tagIndex: number]: number;
  };

  plural: boolean;

  labels: string[];

  translations: {
    [language in Language]? : {
      [plural in Plural]? : {
        version: number,
        text?: string,
        verified: boolean,
        skip: boolean
      }
    }
  };

  history: HistoryEntry[];

  keyStore: UITranslationKeyStore;

  constructor(keyStore: UITranslationKeyStore, key: TranslationKey) {
    this.keyStore = keyStore;

    this.keyName = key.keyName;
    this.latestVersion = key.latestVersion;
    this.historyTags = key.historyTags;
    this.plural = key.plural;
    this.labels = key.labels;
    this.translations = key.translations;
    this.history = key.history;
  }

  getHistoryEntry(language: Language, plural: Plural, version: number) : HistoryEntry | undefined {
    // iterate backward until we have a match
    let currentVersion = version;
    while (currentVersion >= 0) {
      if (this.history[currentVersion]?.translations?.[language]?.[plural]) {
        return this.history[currentVersion];
      }
      currentVersion -= 1;
    }
    return undefined;
  }

  getChangesSince(language: Language, plural: Plural, version: number) {
    let changeCounter = 0;

    let currentVersion = this.latestVersion;
    while (currentVersion >= 0 && currentVersion > version) {
      if (this.history[currentVersion]?.translations?.[language]?.[plural]) {
        changeCounter += 1;
      }
      currentVersion -= 1;
    }
    return changeCounter;
  }
}
