/* eslint-disable no-await-in-loop */
import Language from '../base/Language';
import Plural from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';
import { BaseTranslationKeyStore } from './BaseTranslationKeyStore';
import { Config, FigmaFileTranslationKeyStore } from './FigmaFileTranslationKeyStore';

export default class MemoryTranslationKeyStore extends BaseTranslationKeyStore {
  async getHistory(translationKeyName: string): Promise<HistoryEntry[]> {
    return this.parentKeyStore.getHistory(translationKeyName);
  }

  parentKeyStore: FigmaFileTranslationKeyStore;

  config: Config | undefined;

  translationKeys: TranslationKeys = { };

  constructor(parentKeyStore: FigmaFileTranslationKeyStore) {
    super();
    this.parentKeyStore = parentKeyStore;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'TranslationKeyStore') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          this.processCacheUpdate(event.data.pluginMessage.changedKeys);
        }
      }
    });
  }

  async processCacheUpdate(changedKeys: { delted: string[], added: string[], updeted: string[] }) {
    for (const deltedKey of changedKeys.delted) {
      delete this.translationKeys[deltedKey];
    }

    for (const updatedKey of changedKeys.updeted) {
      const freshKey = await this.parentKeyStore.getKey(updatedKey);
      if (!freshKey) {
        throw new Error(`fresh key does not exist... [${updatedKey}]`);
      }

      this.persistKey(freshKey);
    }

    for (const addedKey of changedKeys.added) {
      const freshKey = await this.parentKeyStore.getKey(addedKey);
      if (!freshKey) {
        throw new Error(`fresh key does not exist... [${addedKey}]`);
      }

      this.persistKey(freshKey);
    }
  }

  getKey(keyName: string) : TranslationKey | undefined {
    return this.translationKeys[keyName];
  }

  // eslint-disable-next-line class-methods-use-this
  getLanugages(): Language[] | undefined {
    return this.config!.enabledLanguages;
  }

  async setLanguages(languages: Language[]) {
    this.config!.enabledLanguages = languages;
    const parentConfig = await this.parentKeyStore.getConfig();

    parentConfig.enabledLanguages = languages;
    await this.parentKeyStore.setConfig(parentConfig);
  }

  // eslint-disable-next-line class-methods-use-this
  getBaseLanugage(): Language | undefined {
    return this.config!.baseLanguage;
  }

  async setBaseLanguage(language: Language) {
    this.config!.baseLanguage = language;
    const parentConfig = await this.parentKeyStore.getConfig();
    parentConfig.baseLanguage = language;
    await this.parentKeyStore.setConfig(parentConfig);
  }

  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[]): Promise<TranslationKey> {
    if (keyName === '') {
      throw new Error('keys mus have at least one character');
    }
    const createdKey = await this.parentKeyStore.createKey(keyName, translations);
    return this.persistKey(createdKey);
  }

  async updateKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[]) {
    const updatedKey = await this.parentKeyStore.updateKey(keyName, translations);
    return this.persistKey(updatedKey);
  }

  async deleteKey(keyName: string) {
    await this.parentKeyStore.deleteKey(keyName);
    delete this.translationKeys[keyName];
  }

  async load(): Promise<TranslationKeys> {
    this.config = await this.parentKeyStore.getConfig();
    this.translationKeys = await this.parentKeyStore.load();
    return this.translationKeys;
  }

  async persistKey(translationKey: TranslationKey): Promise<TranslationKey> {
    this.translationKeys[translationKey.keyName] = translationKey;
    return translationKey;
  }

  importFromLocalise(): Promise<void> {
    return this.parentKeyStore.importFromLocalise();
  }

  fillPlaceholdersWithSampleData(text: string, language: Language, plural: Plural) {
    const placeholders = /\[%(s|n|i):(\w+)\]/g;
    return text.replace(placeholders, (substring, type, key) => {
      // exact match
      let matchingTranslation = this.getKey(`sample_values__${type}:${key}`);

      // name match in samples
      if (matchingTranslation === undefined) {
        matchingTranslation = this.getKey(`sample_values__${key}`);
      }

      // key match
      if (!matchingTranslation === undefined) {
        matchingTranslation = this.getKey(key);
      }

      if (!matchingTranslation === undefined) {
        return substring;
      }

      // exact language/plural match
      const matchingLangugae = matchingTranslation!.translations[language]?.[plural]?.text;
      if (matchingLangugae !== undefined) {
        return matchingLangugae;
      }

      const baseLanguage = Object.keys(matchingTranslation!.translations)[0]! as Language;
      if (matchingTranslation!.translations[baseLanguage]![plural]?.text !== undefined) {
        return matchingTranslation!.translations[baseLanguage]![plural]!.text!;
      } if (matchingTranslation!.translations[baseLanguage]![Plural.Other]?.text !== undefined) {
        return matchingTranslation!.translations[baseLanguage]![Plural.Other]?.text!;
      }

      // not found
      return substring;
    });
  }
}
