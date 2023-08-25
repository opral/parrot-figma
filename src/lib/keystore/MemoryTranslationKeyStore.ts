/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import { Language } from '../base/Language';
import { Plural, getPluralFormsByLanguage } from '../base/Plural';
import {
  Fillins,
  HistoryEntry, HistoryTag, PlaceholdersByName, TranslationEntry, TranslationKey, TranslationKeys,
} from './TranslationKey';
import { Config, FigmaFileTranslationKeyStore } from './FigmaFileTranslationKeyStore';
import { UITranslationKey } from './UITranslationKey';
import { NodeSelection } from '../localizedlabels/LocalizedLabelManager';

export type SearchQuery = {
  selected?: 'FRAME' | 'LABEL' | undefined,
  hasLabel?: string[] | undefined,
  oneLabelOf?: string[] | undefined,
  unverified?: boolean | undefined,
  missingTranslation?: boolean | undefined,
  key?: string | undefined, // suggestion n with key
  keyAtEnd?: boolean | undefined,
  text?: string | undefined,
  exactText?: boolean | undefined,
  searchString?: string | undefined,
};

export type SearchResult = {

  inKeys: Set<string>,
  inText: Set<string>,
  withMissingTranslations: Set<string>,
  withMissingTranslationsPerLanguage: {
    [language in Language]? : Set<string>
  },
  withMissingReview: Set<string>,
  matchingKeys: Set<string>,
  referencedInFrame: Set<string>,
  referencedInLabels: Set<string>,
  matches: { [key: string] : {
    keyMatch: { start: number, length: number } | undefined,
    textMatches: {
      [language in Language]?: { [plural in Plural]?: { start: number, length: number } }
    }
  } },

};

export interface UITranslationKeys {
  [keyName: string]: UITranslationKey
}

export default class MemoryTranslationKeyStore extends EventTarget {
  parentKeyStore: FigmaFileTranslationKeyStore;

  config: Config | undefined;

  historyTags: HistoryTag[] = [];

  translationKeys: UITranslationKeys = { };

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

  public async updateKeyLinks(keys: string[]) {
    const changes = {
      updated: [] as string[],
      changedKeys: keys,
    };

    for (const updatedKeyLink of keys) {
      const key = await this.parentKeyStore.getKeyAsync(updatedKeyLink);
      if (key) {
        this.upsertCache(key);
      }
    }

    const event = new CustomEvent<any>('updated', { detail: changes });
    this.dispatchEvent(event);
  }

  private async processCacheUpdate(changedKeys: { deleted: string[], added: string[], updated: string[] }, updatedHistoryTags: HistoryTag[] | undefined) {
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

  private async upsertCache(translationKey: TranslationKey): Promise<UITranslationKey> {
    debugger;
    this.translationKeys[translationKey.id] = new UITranslationKey(this, translationKey);
    return this.translationKeys[translationKey.id];
  }

  private removeCache(id: string) {
    delete this.translationKeys[id];
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

  getTagIndexByVersionId(versionId: string) {
    let tagIndex = -1;
    for (let i = 0; i < this.historyTags.length; i++) {
      if (this.historyTags[i].versionId === versionId) {
        tagIndex = i;
      }
    }
    return tagIndex;
  }

  getTranslationsByKeyName(language: Language, versionId: string | undefined): { [keyName: string]: TranslationEntry } {
    const translationKeys = {} as { [id: string]: TranslationKey };

    const tagIndex = versionId ? this.getTagIndexByVersionId(versionId) : -1;

    for (const keyId of Object.keys(this.translationKeys)) {
      const currentKey = this.translationKeys[keyId];
      if (tagIndex >= 0) {
        const keyVerson = currentKey.getKeyVersionByTagIndex(tagIndex);
        if (keyVerson !== undefined) {
          const keyInVersion = currentKey.getInVersion(keyVerson);
          translationKeys[keyInVersion.keyName] = keyInVersion;
        }
      } else if (currentKey.translations[language]) {
        translationKeys[currentKey.keyName] = currentKey;
      }
    }

    return translationKeys;
  }

  getKey(id: string) : UITranslationKey | undefined {
    return this.translationKeys[id];
  }

  getKeyByName(messageName: string) : UITranslationKey | undefined {
    for (const message of Object.values(this.translationKeys)) {
      if (message.keyName === messageName) {
        return message;
      }
    }
    return undefined;
  }

  static toSearchString(searchQuery: SearchQuery): string {
    let searchString = '';
    if (searchQuery.selected === 'FRAME') {
      searchString += 'selected:FRAME ';
    }

    if (searchQuery.selected === 'LABEL') {
      searchString += 'selected:LABEL ';
    }

    if (searchQuery.hasLabel && searchQuery.hasLabel.length > 0) {
      searchString += `label:${searchQuery.hasLabel.join(' label:')} `;
    }

    if (searchQuery.oneLabelOf && searchQuery.oneLabelOf.length > 0) {
      searchString += `one_label_of:${searchQuery.oneLabelOf.join(',')} `;
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

  static toQueryObject(searchString: string): SearchQuery {
    const searchQueryObj = {
      selected: undefined,
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
        if (filterParts[0] === 'selected') {
          if (filterParts[1] === 'FRAME') {
            searchQueryObj.selected = 'FRAME';
          } else if (filterParts[1] === 'LABEL') {
            searchQueryObj.selected = 'LABEL';
          }
        } else if (filterParts[0] === 'label' && filterParts.length > 1) {
          searchQueryObj.hasLabel!.push(filterParts[1]);
        } else if (filterParts[0] === 'one_label_of' && filterParts.length > 1) {
          searchQueryObj.oneLabelOf = searchQueryObj.oneLabelOf!.concat(filterParts[1].split(','));
        } else if (filterParts[0] === 'missing_translation' && filterParts.length > 1) {
          searchQueryObj.missingTranslation = filterParts[1] === 'true';
        } else if (filterParts[0] === 'unverified' && filterParts.length > 1) {
          searchQueryObj.unverified = filterParts[1] === 'true';
        } else if (filterParts[0] === 'exact_text' && filterParts.length > 1) {
          searchQueryObj.exactText = filterParts[1] === 'true';
        } else if (filterParts[0] === 'key' && filterParts.length > 1) {
          // eslint-disable-next-line prefer-destructuring
          searchQueryObj.key = filterParts[1];
        } else {
          // eslint-disable-next-line no-continue
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
  findKeys(query: SearchQuery, selection?: NodeSelection): SearchResult {
    const results = {
      inKeys: new Set<string>(),
      inText: new Set<string>(),
      withMissingTranslations: new Set<string>(),
      withMissingTranslationsPerLanguage: { } as {
        [language in Language]? : Set<string>
      },
      withMissingReview: new Set<string>(),
      matchingKeys: new Set<string>(),
      referencedInFrame: new Set<string>(),
      referencedInLabels: new Set<string>(),
      matches: {} as { [key:string] : {
        keyMatch: { start: number, length: number } | undefined,
        textMatches: {
          [language in Language]?: { [plural in Plural]?: { start: number, length: number } }
        }
      } },
    };

    if (selection) {
      Object.values(selection).forEach((selectedNode) => {
        if (selectedNode.key !== undefined) {
          if (!selectedNode.directSelection) {
            results.referencedInLabels.add(selectedNode.key);
          }
          results.referencedInFrame.add(selectedNode.key);
        }
      });
    }

    for (const key of Object.values(this.translationKeys)) {
      for (const language of this.getLanugages()!) {
        const plurals = key.translations[language];
        for (const plural of getPluralFormsByLanguage(language as Language)) {
          if (query.text === undefined || query.text === '') {
            results.matchingKeys.add(key.id);
          } else if (plurals?.[plural]?.text !== undefined) {
            const matchStartText = plurals[plural]!.text!.toLowerCase().indexOf(query.text.toLowerCase());
            if ((query.exactText && matchStartText === 0 && plurals[plural]!.text!.length === query.text.length)
              || (!query.exactText && matchStartText !== -1)) {
              if (!results.matches[key.id]) {
                results.matches[key.id] = { textMatches: {}, keyMatch: undefined };
              }

              if (!results.matches[key.id].textMatches![language as Language]) {
                results.matches[key.id].textMatches![language as Language]! = {};
              }
              results.matches[key.id].textMatches![language as Language]![plural as Plural] = { start: matchStartText, length: query.text.length };
              results.matchingKeys.add(key.id);
              results.inText.add(key.id);
            }
          }

          if (plurals?.[plural]?.text === undefined) {
            if (plurals?.[plural]?.skip !== true) {
              if (key.plural || plural === Plural.OTHER) {
                if ((!plurals?.[plural]?.text || plurals?.[plural]?.text === '')) {
                  if (key.plural || plural === Plural.OTHER) {
                    results.withMissingTranslations.add(key.id);

                    if (results.withMissingTranslationsPerLanguage[language] === undefined) {
                      results.withMissingTranslationsPerLanguage[language] = new Set<string>();
                    }
                    results.withMissingTranslationsPerLanguage[language]!.add(key.id);
                  }
                }
              }
            }
          }

          if (plurals?.[plural] && !plurals[plural]!.verified) {
            results.withMissingReview.add(key.id);
          }
        }
      }

      if (query.key) {
        if (query.key !== '*') {
          const keyMatchStart = key.keyName.toLowerCase().indexOf(query.key.toLowerCase());

          if (keyMatchStart === 0) {
            if (!results.matches[key.id]) {
              results.matches[key.id] = { textMatches: {}, keyMatch: undefined };
            }
            results.matches[key.id].keyMatch = { start: keyMatchStart, length: query.key.length };
            results.inKeys.add(key.id);
          } else {
            // eslint-disable-next-line no-continue
            results.matchingKeys.delete(key.id);
          }
        }
      } else if (query.text !== undefined && query.text !== '') {
        const keyMatchStart = key.keyName.toLowerCase().indexOf(query.text.toLowerCase());
        if (keyMatchStart !== -1) {
          if (!results.matches[key.id]) {
            results.matches[key.id] = { textMatches: {}, keyMatch: undefined };
          }
          results.matches[key.id].keyMatch = { start: keyMatchStart, length: query.text.length };
          results.inKeys.add(key.id);
          results.matchingKeys.add(key.id);
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

    if (query.selected === 'FRAME') {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => results.referencedInFrame.has(x)));
    } else if (query.selected === 'LABEL') {
      results.matchingKeys = new Set([...results.matchingKeys].filter((x) => results.referencedInLabels.has(x)));
    }

    // in case we have no specific we want to suggest specific like
    // - matches in keys (n)
    // - matches in text (n)
    // - with missing translations (n)
    // - with missing review (n)
    return results;
  }

  async createTag(title: string, description: string | undefined) {
    // TODO #11 we update the translation keys here - shouldn't we wait for the messaage bus instead?
    const tagId = this.historyTags.length;
    for (const key of Object.keys(this.translationKeys)) {
      this.translationKeys[key].historyTags[tagId] = this.translationKeys[key].latestVersion;
    }

    this.historyTags[tagId] = await this.parentKeyStore.createTag(tagId, title, description);
    return this.historyTags[tagId];
  }

  async createKey(messageName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural: boolean, fillins?: Fillins, quantity?: { value: number } | { placeholder: string }): Promise<UITranslationKey> {
    if (messageName === '') {
      throw new Error('keys mus have at least one character');
    }
    const createdKey = await this.parentKeyStore.createKey(messageName, translations, plural, quantity, fillins);
    return this.upsertCache(createdKey);
  }

  async updateKey(id: string, properties: {
    name?: string,
    translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[],
    plural?: boolean,
    fillins?: Fillins,
    quantity?: { value: number } | { placeholder: string }
  }) {
    const updatedKey = await this.parentKeyStore.updateKey(id, properties);
    return this.upsertCache(updatedKey);
  }

  async deleteKey(id: string) {
    await this.parentKeyStore.deleteKey(id);
    this.removeCache(id);
  }

  async load(): Promise<UITranslationKeys> {
    this.config = await this.parentKeyStore.getConfig();
    this.historyTags = await this.parentKeyStore.getHistoryTags();
    this.translationKeys = {} as UITranslationKeys;

    const allTranslationKeys = await this.parentKeyStore.load();
    
    for (const key of Object.values(allTranslationKeys)) {
      this.translationKeys[key.id] = new UITranslationKey(this, key);
    }
    return this.translationKeys;
  }
}
