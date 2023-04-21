/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';
import { TranslationKeyStore } from './BaseTranslationKeyStore';

export interface Config {
  baseLanguage?: Language,
  enabledLanguages?: Language[]
}

export class FigmaFileTranslationKeyStore implements TranslationKeyStore {
  public proxClassName = 'FigmaFileTranslationKeyStore';

  public static configDataKey = 'aar_c';

  keyPrefix = 'aar_k__';

  keyHistoryPrefix = 'aar_h__';

  // contains a map from key to state index from the last cache propagation
  keyState = { } as {
    [keyId: string]: number
  };

  constructor(asProxy: boolean) {
    if (!asProxy) {
      figma.on('documentchange', this.forwardDocumentChanges.bind(this));
    }
  }

  // eslint-disable-next-line class-methods-use-this
  forwardDocumentChanges(event: any) {
    for (const change of event.documentChanges) {
      // eslint-disable-next-line default-case
      switch (change.type) {
        case 'PROPERTY_CHANGE': {
          if (change.node.parent === null // easy way to check if the node is the root node
          && change.properties.indexOf('pluginData') !== -1) {
            const currentFileStorageKeys = figma.root.getPluginDataKeys().filter((value) => value.indexOf(this.keyHistoryPrefix) === 0);
            let currentCachedKeys = Object.keys(this.keyState);

            const changedKeys = {
              deleted: [] as string[],
              updated: [] as string[],
              added: [] as string[],
            };

            for (const currentFileStorageKey of currentFileStorageKeys) {
              const keyName = currentFileStorageKey.slice(this.keyHistoryPrefix.length);

              if (this.keyState[keyName] === undefined) {
                changedKeys.added.push(keyName);
              } else {
                if (figma.root.getPluginData(currentFileStorageKey).length !== this.keyState[keyName]) {
                  changedKeys.updated.push(keyName);
                }

                currentCachedKeys = currentCachedKeys.filter((key) => key !== keyName);
              }
            }
            changedKeys.deleted = currentCachedKeys;

            for (const deletedKey of currentCachedKeys) {
              delete this.keyState[deletedKey];
            }

            if (changedKeys.deleted.length > 0
              || changedKeys.added.length > 0
              || changedKeys.updated.length > 0) {
              figma.ui.postMessage({
                target: 'TranslationKeyStore',
                type: 'cacheUpdate',
                changedKeys,
              });
            }
          }
          break;
        }
      }
    }
  }

  getConfigSync() {
    const keyRaw = figma.root.getPluginData(FigmaFileTranslationKeyStore.configDataKey);

    if (keyRaw === '' || !keyRaw) {
      return {
        baseLanguage: undefined,
        enabledLanguages: undefined,
      } as Config;
    }

    return (JSON.parse(keyRaw) as Config);
  }

  async getConfig() {
    return this.getConfigSync();
  }

  async setConfig(languageConfig: Config) {
    figma.root.setPluginData(FigmaFileTranslationKeyStore.configDataKey, JSON.stringify(languageConfig));
  }

  async getHistory(translationKeyName: string) : Promise<HistoryEntry[]> {
    return this.getHistorySync(translationKeyName).keyHistory;
  }

  getHistorySync(translationKeyName: string) {
    const keyHistoryRaw = figma.root.getPluginData(this.keyHistoryPrefix + translationKeyName);
    let keyHistory = (keyHistoryRaw !== undefined && keyHistoryRaw !== '' ? JSON.parse(keyHistoryRaw) : []);

    if (keyHistory.length > 0 && keyHistory[0].translations === undefined) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      keyHistory = keyHistory.map((keyHistory: any) => ({
        user: 123,
        translations: keyHistory,
      }));
    }

    return {
      keyHistory,
      state: keyHistoryRaw.length,
    };
  }

  getKey(keyName: string): TranslationKey | undefined {
    const keyRaw = figma.root.getPluginData(this.keyPrefix + keyName);

    if (keyRaw === '' || !keyRaw) {
      return undefined;
    }

    const key = JSON.parse(keyRaw) as TranslationKey;
    const historyObj = this.getHistorySync(keyName);
    key.history = historyObj.keyHistory;
    this.keyState[keyName] = historyObj.state;

    return key;
  }

  async getKeyAsync(keyName: string) {
    return this.getKey(keyName);
  }

  private async persistKey(translationKeyPased: TranslationKey): Promise<TranslationKey> {
    const translationKey = translationKeyPased;
    const keyCurrentVersion = this.getKey(translationKey.keyName);

    let historyEntry: HistoryEntry | undefined;
    const userId = figma.currentUser?.id ?? 'anonymous';
    const dateOfChange = Date.now();
    // find differences
    for (const language of Object.keys(translationKey.translations)) {
      const currentLanguage = language as Language;

      for (const plural of Object.keys(translationKey.translations[currentLanguage]!)) {
        const currentPlural = plural as Plural;
        if (translationKey.translations[currentLanguage]![currentPlural]) {
          translationKey.translations[currentLanguage]![currentPlural]!.text = translationKey.translations[currentLanguage]![currentPlural]?.text === '' ? undefined : translationKey.translations[currentLanguage]![currentPlural]?.text;
        }
        if (keyCurrentVersion?.translations[currentLanguage]?.[currentPlural]?.text === translationKey.translations[currentLanguage]![currentPlural]?.text
                    && keyCurrentVersion?.translations[currentLanguage]?.[currentPlural]?.skip === translationKey.translations[currentLanguage]![currentPlural]?.skip) {
          // console.log(`text equal! ${currentLanguage} ${currentPlural} ${keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text}`);
          // eslint-disable-next-line no-continue
          continue;
        }

        if (!historyEntry) {
          historyEntry = { user: userId, date: dateOfChange, translations: {} };
        }

        if (historyEntry.translations![currentLanguage] === undefined) {
          historyEntry.translations![currentLanguage] = {
            [currentPlural]: {
              text: translationKey.translations[currentLanguage]![currentPlural]!.text,
              skip: translationKey.translations[currentLanguage]![currentPlural]!.skip,
            },
          };
        } else if (historyEntry.translations![currentLanguage]![currentPlural] === undefined) {
          historyEntry.translations![currentLanguage]![currentPlural] = {
            text: translationKey.translations[currentLanguage]![currentPlural]!.text,
            skip: translationKey.translations[currentLanguage]![currentPlural]!.skip,
          };
        }

        translationKey.translations[currentLanguage]![currentPlural]!.version = translationKey.history.length;
      }
    }

    if (!keyCurrentVersion || translationKey.plural !== keyCurrentVersion?.plural) {
      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.plural = translationKey.plural;
    }

    if (!keyCurrentVersion || FigmaFileTranslationKeyStore.arraysAreEqual(translationKey.tags, keyCurrentVersion.tags)) {
      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.tags = translationKey.tags;
    }

    if (!historyEntry) {
      // no differences found!
      return translationKey;
    }

    translationKey.latestVersion = translationKey.history.length;

    translationKey.history.push(historyEntry);

    if (translationKey.keyName === undefined) {
      throw new Error('key name must be defined');
    }

    if (translationKey.keyName === 'undefined') {
      throw new Error('key name must not be "undefined"');
    }

    const serializableTranslationKey = translationKey as any;
    const { history } = serializableTranslationKey;
    delete serializableTranslationKey.history;

    figma.root.setPluginData(this.keyPrefix + translationKey.keyName, JSON.stringify(serializableTranslationKey));
    figma.root.setPluginData(this.keyHistoryPrefix + translationKey.keyName, JSON.stringify(history));

    // TODO key history: pause event event handling using a flag;

    translationKey.history = history;

    return translationKey;
  }

  private static arraysAreEqual(arr1: string[], arr2: string[]) {
    if (arr1.length !== arr2.length) {
      return false;
    }
    // eslint-disable-next-line no-plusplus
    for (let i = 0; i < arr1.length; i++) {
      if (!arr2.includes(arr1[i])) {
        return false;
      }
    }
    return true;
  }

  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural: boolean): Promise<TranslationKey> {
    const existingKey = this.getKey(keyName);
    if (existingKey) {
      throw Error('tried to create a key that already existed');
    }

    const translationsObj = {} as any;
    for (const translation of translations) {
      if (!translationsObj[translation.language]) {
        translationsObj[translation.language] = {};
      }

      if (!translationsObj[translation.language][translation.plural]) {
        translationsObj[translation.language][translation.plural] = {};
      }

      translationsObj[translation.language][translation.plural].text = translation.text;
    }

    const createdKey = {
      latestVersion: 0,
      keyName,
      tags: [],
      plural,
      translations: translationsObj,
      history: [], // first history entry will be added in persistKey method...
    } as TranslationKey;
    return this.persistKey(createdKey);
  }

  async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural?: boolean): Promise<TranslationKey> {
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
    }

    if (plural !== undefined && plural !== null) {
      keyToUpdate.plural = plural;
    }

    return this.persistKey(keyToUpdate);
  }

  async deleteKey(keyName: string): Promise<void> {
    figma.root.setPluginData(this.keyPrefix + keyName, '');
    figma.root.setPluginData(this.keyHistoryPrefix + keyName, '');
  }

  async load(): Promise<TranslationKeys> {
    const translationKeys = {} as TranslationKeys;
    for (const keyWithPrefix of figma.root.getPluginDataKeys()) {
      if (keyWithPrefix.startsWith(this.keyPrefix)) {
        const key = keyWithPrefix.substring(this.keyPrefix.length, keyWithPrefix.length);
        const keyData = figma.root.getPluginData(keyWithPrefix);
        if (keyData && keyData !== '') {
          translationKeys[key] = this.getKey(key)!;
        }
      }
    }
    return translationKeys;
  }

  async commitUndo() {
    return figma.commitUndo();
  }

  async importStringsFile(language: string, stringsFileContent: string) {
    // split the file contents into an array of lines
    const lines = stringsFileContent.split('\n');

    // create an empty object to hold our key-value pairs
    const result = {} as any;

    // iterate over each line of the file
    // eslint-disable-next-line no-plusplus
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // handle the start of a /* */ comment
      if (line.startsWith('/*')) {
        inComment = true;
        if (line.endsWith('*/')) {
          inComment = false;
        }
        continue;
      }

      // handle the end of a /* */ comment
      if (line.endsWith('*/')) {
        inComment = false;
        continue;
      }

      // skip any comments or empty lines
      if (line.startsWith('//') || line.length === 0 || inComment) {
        continue;
      }

      // split the line into a key and value pair
      const parts = line.split('=');
      let key = parts[0].trim();
      let value = parts[1].trim();


      // remove any surrounding quotes from the key and value
      if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
      }
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
      }

      if (value.startsWith('"') && value.endsWith('";')) {
        value = value.slice(1, -2);
      }


      // add the key-value pair to our result object
      result[key] = value;
    }

    const changedKeys = {
      added: [] as TranslationKey[],
      updated: [] as TranslationKey[],
      deleted: [] as TranslationKey[],
    };

    
    for (const key of Object.keys(result)) {
      console.log('processing key ' + key);
      const lang = language as Language;
      const currentKey = this.getKey(key);
      if (!currentKey) {
        const createdKey = await this.createKey(key, [{
          language: lang, plural: Plural.OTHER, text: result[key], skip: false,
        }], false);
        changedKeys.added.push(createdKey);
      } else if (currentKey!.translations[lang]?.other?.text !== result[key]) {
        const skip = currentKey!.translations[lang]?.other?.skip ?? false;
        const updatedKey = await this.updateKey(key, [{
          language: lang, plural: Plural.OTHER, text: result[key], skip,
        }]);
        changedKeys.updated.push(updatedKey);
      } else {
        console.log('skipping '+ key + ' text is equal');
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    figma.commitUndo();

    if (changedKeys.added.length > 0
      || changedKeys.updated.length > 0) {
      figma.ui.postMessage({
        target: 'TranslationKeyStore',
        type: 'cacheUpdate',
        changedKeys,
      });
    }
  }

  async importFromLocalise(): Promise<void> {
    const result = await fetch('http://localhost:3333/api/v1/lokalise', {
      method: 'GET',
      /* headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          }, */
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },

    });
    const lokaliseKeys = await result.json();

    // const start = Date.now();

    const translationKeys = [] as TranslationKey[];

    for (const key of lokaliseKeys.keys) {
      const keyName = key.key_name.other;
      const keyPlurals = [Plural.OTHER];

      const translations = {} as {
        [language in Language]? : {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean
          }
        }
      };
      for (const transalation of key.translations) {
        const lokaliseLanguage = transalation.language_iso as Language;

        const plurals = {} as {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean

          }
        };

        if (key.is_plural) {
          const pluralsLokalise = JSON.parse(transalation.translation);

          for (const plural of Object.keys(pluralsLokalise)) {
            plurals[plural as Plural] = {
              version: -1,
              text: pluralsLokalise[plural],
              skip: false,
            };

            if (keyPlurals.indexOf(plural as Plural) === -1) {
              keyPlurals.push(plural as Plural);
            }
          }
        } else {
          // console.log(transalation);
          plurals[Plural.OTHER] = {
            version: -1,
            text: transalation.translation,
            skip: false,
          };
        }

        translations[lokaliseLanguage] = plurals;
      }

      translationKeys.push({
        keyName,
        latestVersion: 0,
        plural: keyPlurals.length > 1,
        translations,
        history: [],
        tags: [], // TODO add tags
      });
    }

    // console.log(`Execution time: Response processing: ${Date.now() - start} ms`);

    // console.log(`${translationKeys.length} keys found `);

    for (const tanslationKey of translationKeys) {
      this.persistKey(tanslationKey);
    }

    figma.commitUndo();
    // console.log(`Execution time: persisting keys: ${Date.now() - start} ms`);
  }
}
