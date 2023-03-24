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
}
