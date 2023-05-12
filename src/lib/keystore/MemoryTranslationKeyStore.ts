/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import { Language } from '../base/Language';
import { Plural, getPluralFormsByLanguage } from '../base/Plural';
import {
  HistoryEntry, HistoryTag, TranslationEntry, TranslationKey, TranslationKeys,
} from './TranslationKey';
import { TranslationKeyStore } from './BaseTranslationKeyStore';
import { Config, FigmaFileTranslationKeyStore } from './FigmaFileTranslationKeyStore';

export type SearchQuery = {
  selected: boolean,
  hasLabel: string[],
  oneLabelOf: string[],
  unverified?: boolean,
  missingTranslation?: boolean,
  key?: string, // suggestion n with key
  keyAtEnd: boolean,
  text: string,
  exactText: boolean,
  searchString: string,
};

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
                      verified: false, // TODO #9 also collect this info! check when text appeared in history last time (change) and that verfied followed afer - but also check the base language chage
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

  getKeysByText(text: string) : TranslationKey[] {
    const matchingKeys = [] as TranslationKey[];
    for (const key of Object.values(this.translationKeys)) {
      for (const translation of Object.values(key.translations)) {
        for (const pluralForm of Object.values(translation)) {
          if (pluralForm.text === text) {
            matchingKeys.push(key);
          }
        }
      }
    }
    return matchingKeys;
  }

  toSearchString(searchQuery: SearchQuery): string {
    let searchString = '';
    if (searchQuery.selected) {
      searchString += 'selected:true ';
    }
    if (searchQuery.hasLabel.length > 0) {
      searchString += `label:${searchQuery.hasLabel.join(' label:')} `;
    }

    if (searchQuery.oneLabelOf.length > 0) {
      searchString += `one_label_of:${searchQuery.hasLabel.join(',')} `;
    }

    if (searchQuery.unverified !== undefined) {
      searchString += `unverified:${searchQuery.unverified ? 'true' : 'false'} `;
    }

    if (searchQuery.missingTranslation !== undefined) {
      searchString += `missing_translation:${searchQuery.missingTranslation ? 'true' : 'false'} `;
    }

    if (searchQuery.exactText === true) {
      searchString += 'exact_text:true ';
    }

    if (searchQuery.key !== undefined) {
      searchString += `key:${searchQuery.key}`;
      if (!searchQuery.keyAtEnd) {
        searchString += ' ';
      }
    }

    searchString += searchQuery.text;

    return searchString;
  }

  toQueryObject(searchString: string): SearchQuery {
    const searchQueryObj = {
      selected: false,
      hasLabel: [],
      oneLabelOf: [],
      verified: undefined,
      key: undefined, // suggestion n with key
      keyAtEnd: false,
      text: '',
      exactText: false,
      searchString,
    } as SearchQuery;

    let processedInputString = searchString;

    // extract the text surrounded by quotest first:
    const textInQuotesRe = /"((?:[^"\\]|\\.)*)"(?![^\\]*\\)/g;
    const quotedTextMatches = processedInputString.match(textInQuotesRe);

    if (quotedTextMatches) {
      for (const quotedTextMatch of quotedTextMatches) {
        searchQueryObj.text += quotedTextMatch;
        processedInputString = searchString.split(quotedTextMatch).join('');
      }
    }

    // extract and remove all filters
    const filterRe = /((\b\w+:[\w,*:]+))\s/g;
    const filterMatches = processedInputString.match(filterRe);
    const filters = [] as string[];

    if (filterMatches) {
      for (const filterMatch of filterMatches!.sort((match) => match.length)) {
        const filterParts = filterMatch.split(' ').join('').split(':');
        if (filterParts[0] === 'selected' && filterParts[1] === 'true') {
          searchQueryObj.selected = true;
        } else if (filterParts[0] === 'label' && filterParts.length > 1) {
          searchQueryObj.hasLabel.push(filterParts[1]);
        } else if (filterParts[0] === 'one_label_of' && filterParts.length > 1) {
          searchQueryObj.oneLabelOf = searchQueryObj.oneLabelOf.concat(filterParts[1].split(','));
        } else if (filterParts[0] === 'missing_translation' && filterParts.length > 1) {
          searchQueryObj.missingTranslation = filterParts[1] === 'true';
        } else if (filterParts[0] === 'unverified' && filterParts.length > 1) {
          searchQueryObj.unverified = filterParts[1] === 'true';
        } else if (filterParts[0] === 'exact_text' && filterParts.length > 1) {
          searchQueryObj.exactText = filterParts[1] === 'true';
        } else if (filterParts[0] === 'key' && filterParts.length > 1) {
          console.log(filterParts);
          // eslint-disable-next-line prefer-destructuring
          searchQueryObj.key = filterParts[1];
        } else {
          continue;
        }

        filters.push(filterMatch.split(' ').join(''));
        processedInputString = processedInputString.split(filterMatch).join('');
      }
    }

    if (!searchQueryObj.key) {
      // the regex expects a leading space - if we haven't found the key filter yet - try to find it at
      // the very end

      const keyAtTheEnd = /key:([\w,*:]+)$/g;
      const matches = processedInputString.match(keyAtTheEnd);
      if (matches) {
        // eslint-disable-next-line prefer-destructuring
        searchQueryObj.key = matches[0].split(':')[1];
        processedInputString = processedInputString.split(matches[0]).join('');
        searchQueryObj.keyAtEnd = true;
      }
    }

    // extract the rest as text if none was found previously
    if (searchQueryObj.text === '') {
      searchQueryObj.text = processedInputString;
    }

    return searchQueryObj;
  }

  /**
   * what do we want to search
   * "emission"
   *  - all keys with "emission" in their name
   * or
   *  - all keys with "emission" in their text
   * or
   *  - all keys with a tag called "emmission"
   *
   * key:emision
   *  - all keys with emmision in their name
   *    - asterix not adding a lot of value
   *
   * text:"emision"
   *  - all keys with emmision in thair text
   *
   * "translation:missing:de"
   * "translation:complete"
   *
   * "one_tag_of:tag_a,tag_b,"
   * "tag:tag_a"
   *
   * "verified:true"
   *
   *
   * " verified:true "
   *
   * key:asdasd_asdasd_asd
   *
   * all filter but text have no space, and a leading no space name spearated by colon
   *
   *
   */
  findKeys(query: SearchQuery) {
    const results = {
      inKeys: new Set<string>(),
      inText: new Set<string>(),
      withMissingTranslations: new Set<string>(),
      withMissingReview: new Set<string>(),
      matchingKeys: new Set<string>(),
      matches: {} as { [key:string] : {
        keyMatch: { start: number, length: number } | undefined,
        textMatches: {
          [language in Language]?: { [plural in Plural]?: { start: number, length: number } }
        }
      } },
    };

    for (const key of Object.values(this.translationKeys)) {
      for (const [language, languages] of Object.entries(key.translations)) {
        for (const plural of getPluralFormsByLanguage(language as Language)) {
          if (query.text === '') {
            results.matchingKeys.add(key.keyName);
          } else if (languages[plural]?.text !== undefined) {
            const matchStartText = languages[plural]!.text!.toLowerCase().indexOf(query.text.toLowerCase());
            if ((query.exactText && matchStartText === 0 && languages[plural]!.text!.length === query.text.length)
              || (!query.exactText && matchStartText !== -1)) {
              if (!results.matches[key.keyName]) {
                results.matches[key.keyName] = { textMatches: {}, keyMatch: undefined };
              }

              if (!results.matches[key.keyName].textMatches![language as Language]) {
                results.matches[key.keyName].textMatches![language as Language]! = {};
              }
              results.matches[key.keyName].textMatches![language as Language]![plural as Plural] = { start: matchStartText, length: query.text.length };
              results.matchingKeys.add(key.keyName);
              results.inText.add(key.keyName);
            }
          }

          if (
            (key.plural || plural === Plural.OTHER)
            && (languages[plural] === undefined || (!languages[plural]?.skip && (!languages[plural]?.text || languages[plural]?.text === '')))) {
            results.withMissingTranslations.add(key.keyName);
          }

          if (languages[plural] && !languages[plural]!.verified) {
            results.withMissingReview.add(key.keyName);
          }
        }
      }

      if (query.key) {
        if (query.key !== '*') {
          const keyMatchStart = key.keyName.toLowerCase().indexOf(query.key.toLowerCase());

          if (keyMatchStart === -1) {
            // eslint-disable-next-line no-continue
            results.matchingKeys.delete(key.keyName);
          } else {
            if (!results.matches[key.keyName]) {
              results.matches[key.keyName] = { textMatches: {}, keyMatch: undefined };
            }
            results.matches[key.keyName].keyMatch = { start: keyMatchStart, length: query.key.length };
            results.inKeys.add(key.keyName);
          }
        }
      } else if (query.text !== '') {
        const keyMatchStart = key.keyName.toLowerCase().indexOf(query.text.toLowerCase());
        if (keyMatchStart !== -1) {
          if (!results.matches[key.keyName]) {
            results.matches[key.keyName] = { textMatches: {}, keyMatch: undefined };
          }
          results.matches[key.keyName].keyMatch = { start: keyMatchStart, length: query.text.length };
          results.inKeys.add(key.keyName);
          results.matchingKeys.add(key.keyName);
        }
      }
    }

    results.withMissingReview = new Set([...results.withMissingReview].filter((x) => results.matchingKeys.has(x)));
    results.withMissingTranslations = new Set([...results.withMissingTranslations].filter((x) => results.matchingKeys.has(x)));

    if (query.missingTranslation === true) {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => results.withMissingTranslations.has(x)));
    } else if (query.missingTranslation === false) {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => !results.withMissingTranslations.has(x)));
    }

    if (query.unverified === true) {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => results.withMissingReview.has(x)));
    } else if (query.unverified === false) {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => !results.withMissingReview.has(x)));
    }
    // in case we have no specific we want to suggest specific like
    // - matches in keys (n)
    // - matches in text (n)
    // - with missing translations (n)
    // - with missing review (n)
    return results;
  }

  getSampleKeyNames() {
    const prefix = 'sample_values__';
    return Object.keys(this.translationKeys).filter((keyName) => keyName.indexOf(prefix) === 0).map((keyName) => keyName.substring(prefix.length));
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
    const placeholders = /\[%(s|n|i):(\w+)\]/g; // TODO #8 this is also the current format - needs to be changed if we don't like it
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
