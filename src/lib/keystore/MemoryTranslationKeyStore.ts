/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import {
  HistoryEntry, HistoryTag, TranslationEntry, TranslationKey, TranslationKeys,
} from './TranslationKey';
import { TranslationKeyStore } from './BaseTranslationKeyStore';
import { Config, FigmaFileTranslationKeyStore } from './FigmaFileTranslationKeyStore';

export default class MemoryTranslationKeyStore extends EventTarget implements TranslationKeyStore {
  parentKeyStore: FigmaFileTranslationKeyStore;

  config: Config | undefined;

  historyTags: HistoryTag[] = [];

  translationKeys: TranslationKeys = { };

  constructor(parentKeyStore: FigmaFileTranslationKeyStore) {
    super();
    this.parentKeyStore = parentKeyStore;

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'TranslationKeyStore') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          this.processCacheUpdate(event.data.pluginMessage.changedKeys, event.data.pluginMessage.updatedHistoryTags);
        }
      }
    });
  }

  private async processCacheUpdate(changedKeys: { deleted: string[], added: string[], updated: string[] }, updatedHistoryTags: HistoryTag[] | undefined) {
    const changes = {
      deleted: [] as string[],
      updated: [] as string[],
      added: [] as string[],
      changedKeys: [] as string[],
      historyTags: updatedHistoryTags,
    };

    if (updatedHistoryTags) {
      this.historyTags = updatedHistoryTags;
    }

    for (const deltedKey of changedKeys.deleted) {
      this.removeCache(deltedKey);
      changes.deleted.push(deltedKey);
      changes.changedKeys.push(deltedKey);
    }

    for (const updatedKey of changedKeys.updated) {
      const freshKey = await this.parentKeyStore.getKeyAsync(updatedKey);
      if (!freshKey) {
        throw new Error(`fresh key does not exist... [${updatedKey}]`);
      }

      this.upsertCache(freshKey);
      changes.updated.push(updatedKey);
      changes.changedKeys.push(updatedKey);
    }

    for (const addedKey of changedKeys.added) {
      const freshKey = await this.parentKeyStore.getKeyAsync(addedKey);
      if (!freshKey) {
        throw new Error(`fresh key does not exist... [${addedKey}]`);
      }

      this.upsertCache(freshKey);
      changes.added.push(addedKey);
      changes.changedKeys.push(addedKey);
    }

    const event = new CustomEvent<any>('updated', { detail: changes });
    this.dispatchEvent(event);
  }

  private async upsertCache(translationKey: TranslationKey): Promise<TranslationKey> {
    this.translationKeys[translationKey.keyName] = translationKey;
    return translationKey;
  }

  private removeCache(keyName: string) {
    delete this.translationKeys[keyName];
  }

  getLanugages(): Language[] | undefined {
    return this.config!.enabledLanguages;
  }

  async setLanguages(languages: Language[]) {
    this.config!.enabledLanguages = languages;
    const parentConfig = await this.parentKeyStore.getConfig();

    parentConfig.enabledLanguages = languages;
    await this.parentKeyStore.setConfig(parentConfig);
  }

  getBaseLanugage(): Language | undefined {
    return this.config!.baseLanguage;
  }

  async setBaseLanguage(language: Language) {
    this.config!.baseLanguage = language;
    const parentConfig = await this.parentKeyStore.getConfig();
    parentConfig.baseLanguage = language;
    await this.parentKeyStore.setConfig(parentConfig);
  }

  async getHistory(translationKeyName: string): Promise<HistoryEntry[]> {
    return this.parentKeyStore.getHistory(translationKeyName);
  }

  getTagIndexByVersionId(versionId: string) {
    let tagIndex = -1;
    for (let i = 0; i < this.historyTags.length; i++) {
      if (this.historyTags[i].versionId === versionId) {
        tagIndex = i;
      }
    }
    return tagIndex;
  }

  getTranslations(language: Language, versionId: string | undefined): { [keyName: string]: TranslationEntry } {
    const translationKeys = {} as { [keyName: string]: TranslationEntry };

    const tagIndex = versionId ? this.getTagIndexByVersionId(versionId) : -1;
    
    for (const keyName of Object.keys(this.translationKeys)) {
      const currentKey = this.translationKeys[keyName];
      if (tagIndex >= 0) {
        
        const keysHistoryEntryIndex = currentKey.historyTags[tagIndex];
        if (keysHistoryEntryIndex) {
          const transalationEntry = {
            translations: {},
          } as TranslationEntry;
          for (let currentIndex = keysHistoryEntryIndex; currentIndex >= 0; currentIndex--) {
            if (currentKey.history[currentIndex].translations?.[language]) {
              for (const plural of (Object.keys(currentKey.history[currentIndex].translations![language]!) as Plural[])) {
                if (currentKey.history[currentIndex].translations?.[language]?.[plural]?.text) {
                  if (!transalationEntry.translations![language]) {
                    transalationEntry.translations![language] = {};
                  }
                  if (!transalationEntry.translations![language]![plural]) {
                    transalationEntry.translations![language]![plural] = {
                      text: currentKey.history[currentIndex].translations![language]![plural]!.text!,
                    };
                  }
                }
              }
            }
          }

          if (transalationEntry.translations?.[language]) {
            transalationEntry.plural = Object.keys(transalationEntry.translations![language]!).length > 1;
            translationKeys[keyName] = transalationEntry;
          }
        }
      } else if (currentKey.translations[language]) {
        translationKeys[keyName] = currentKey;
      }
    }

    return translationKeys;
  }

  getKey(keyName: string) : TranslationKey | undefined {
    return this.translationKeys[keyName];
  }

  async createTag(title: string, description: string | undefined) {
    const tagId = this.historyTags.length;
    for (const key of Object.keys(this.translationKeys)) {
      this.translationKeys[key].historyTags[tagId] = this.translationKeys[key].latestVersion;
    }

    this.historyTags[tagId] = await this.parentKeyStore.createTag(tagId, title, description);
    return this.historyTags[tagId];
  }

  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural: boolean): Promise<TranslationKey> {
    if (keyName === '') {
      throw new Error('keys mus have at least one character');
    }
    const createdKey = await this.parentKeyStore.createKey(keyName, translations, plural);
    return this.upsertCache(createdKey);
  }

  async updateKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[], plural?: boolean) {
    const updatedKey = await this.parentKeyStore.updateKey(keyName, translations, plural);
    return this.upsertCache(updatedKey);
  }

  async deleteKey(keyName: string) {
    await this.parentKeyStore.deleteKey(keyName);
    this.removeCache(keyName);
  }

  async load(): Promise<TranslationKeys> {
    this.config = await this.parentKeyStore.getConfig();
    this.historyTags = await this.parentKeyStore.getHistoryTags();
    this.translationKeys = await this.parentKeyStore.load();
    return this.translationKeys;
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
      } if (matchingTranslation!.translations[baseLanguage]![Plural.OTHER]?.text !== undefined) {
        return matchingTranslation!.translations[baseLanguage]![Plural.OTHER]?.text!;
      }

      // not found
      return substring;
    });
  }
}
