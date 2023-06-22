/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import {
  HistoryTag, HistoryEntry, TranslationKey, TranslationKeys, PlaceholdersByName, Fillins, PlaceholderType,
} from './TranslationKey';
import { UITranslationKey } from './UITranslationKey';

export interface Config {
  baseLanguage?: Language,
  enabledLanguages?: Language[]
}

const defaultStringFillinValue = 'Loren Impsum';
const defaultDecimalFillinValue = 7;
const defaultFloatFillinValue = Math.PI;

export class FigmaFileTranslationKeyStore {
  public proxClassName = 'FigmaFileTranslationKeyStore';

  public static configDataKey = 'aar_c';

  /**
   * we store a version map here:
   * [
   *  { name: 'v-1.0.0', description: '', id: string? },
   * ]
   */
  public static tagsDataKey = 'aar_t';

  /**
   * Prefix for keys - the head version of a key ist stored withing a key of the root node of the document prefixed with the keyPrefix followed by the keyname
   */
  keyPrefix = 'aar_k__';

  /**
   * Prefix for keys version history. Each change of a key is stored in the keys history array - found in keyHistoryPrefix followed by the keyname
   */
  keyHistoryPrefix = 'aar_h__';

  // contains a map from key to state index from the last cache propagation
  keyState = { } as {
    [keyId: string]: number
  };

  public keyToLabels = {} as {
    [keyName: string]: Set<string>
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

  getHistoryTagsSync() {
    const tagsRaw = figma.root.getPluginData(FigmaFileTranslationKeyStore.tagsDataKey);
    let currentTags = [] as HistoryTag[];
    if (tagsRaw !== '') {
      currentTags = JSON.parse(tagsRaw) as HistoryTag[];
    }
    return currentTags;
  }

  async getHistoryTags() {
    return this.getHistoryTagsSync();
  }

  async createTag(tagId: number, title: string, description: string | undefined) {
    const currentTags = this.getHistoryTagsSync();
    if (tagId !== currentTags.length) {
      throw 'tagging in parallel';
    }

    currentTags[tagId] = {
      date: Date.now(),
      user: figma.currentUser!.id!,
      title,
      description,
    };
    figma.root.setPluginData(FigmaFileTranslationKeyStore.tagsDataKey, JSON.stringify(currentTags));

    // add tag to all keys
    for (const keyWithPrefix of figma.root.getPluginDataKeys()) {
      if (keyWithPrefix.startsWith(this.keyPrefix)) {
        const keyData = figma.root.getPluginData(keyWithPrefix);
        if (keyData && keyData !== '') {
          const key = JSON.parse(keyData) as TranslationKey;
          if (!key.historyTags) {
            key.historyTags = [];
          }
          if (!key.labels) {
            key.labels = [];
          }
          key.historyTags[tagId] = key.latestVersion;
          figma.root.setPluginData(keyWithPrefix, JSON.stringify(key));
        }
      }
    }

    // add version entry in figma file
    const versionHistoryEntry = await figma.saveVersionHistoryAsync(title, description);
    currentTags[tagId].versionId = versionHistoryEntry.id;
    figma.root.setPluginData(FigmaFileTranslationKeyStore.tagsDataKey, JSON.stringify(currentTags));

    return currentTags[tagId];
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

    const defaultFillins = {} as Fillins;
    const placeholders = key.placeholders ?? {};

    for (const placeholderName of Object.keys(placeholders)) {
      // if the placeholder does not exist or is flagged as default value, enrich with default value
      const defaultValue = key.defaultFillins?.[placeholderName]?.default === true;
      if (defaultValue) {
        const placehodlder = key.placeholders[placeholderName];
        let fillinDefaultValue = defaultStringFillinValue as string | number;
        if (placehodlder.type === PlaceholderType.float) {
          fillinDefaultValue = defaultFloatFillinValue;
        } else if (placehodlder.type === PlaceholderType.integer) {
          fillinDefaultValue = defaultDecimalFillinValue;
        }
        defaultFillins[placeholderName] = { default: true, value: fillinDefaultValue };
      } else {
        defaultFillins[placeholderName] = key.defaultFillins?.[placeholderName];
      }
    }

    key.defaultFillins = defaultFillins;

    if (!key.historyTags) {
      key.historyTags = [];
    }
    if (!key.labels) {
      key.labels = [];
    }
    const historyObj = this.getHistorySync(keyName);
    key.history = historyObj.keyHistory;
    key.latestVersion = key.history.length - 1;
    key.referencingTextNodes = this.keyToLabels[key.keyName] ? [...this.keyToLabels[key.keyName]] : [];
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

    if (!keyCurrentVersion || FigmaFileTranslationKeyStore.arraysAreEqual(translationKey.labels, keyCurrentVersion.labels)) {
      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.labels = translationKey.labels;
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

    // TODO #8 handle history for placeholder, fillins and quantity!
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

  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural: boolean, quantity?: { value: number } | { placeholder: string }, defaultFillins?: Fillins): Promise<TranslationKey> {
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

    const placeholders = UITranslationKey.extractParameters(translationsObj, this.getConfigSync().baseLanguage!, plural);

    const createdKey = {
      latestVersion: 0,
      keyName,
      labels: [],
      plural,
      translations: translationsObj,
      referencingTextNodes: this.keyToLabels[keyName] ? [...this.keyToLabels[keyName]] : [],
      placeholders,
      quantity,
      defaultFillins,
      history: [], // first history entry will be added in persistKey method...
      historyTags: [],
    } as TranslationKey;
    return this.persistKey(createdKey);
  }

  async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[], plural?: boolean, quantity?: { value: number } | { placeholder: string }, defaultFillins?: Fillins): Promise<TranslationKey> {
    // this one gets a deep clone of the key
    const keyToUpdate = this.getKey(keyName);
    let changeFound = false;

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
            verified: false, // TODO #9 - check if false is correct
          },
        };
      }

      // if the target plural does not extist yet create a dummy one - vlues get overriden in next step
      if (!keyToUpdate.translations[translation.language]![translation.plural]) {
        keyToUpdate.translations[translation.language]![translation.plural] = {
          version: -1,
          skip: false,
          verified: false, // TODO #9 - check if false is correct
        };
      }

      // create a new translation entry with increased version
      if (keyToUpdate.translations[translation.language]![translation.plural]!.text !== translation.text
        || keyToUpdate.translations[translation.language]![translation.plural]!.skip !== translation.skip) {
        changeFound = true;
        keyToUpdate.translations[translation.language]![translation.plural]!.version = keyToUpdate.latestVersion + 1;
        keyToUpdate.translations[translation.language]![translation.plural]!.text = translation.text;
        keyToUpdate.translations[translation.language]![translation.plural]!.skip = translation.skip;
      }
    }

    if (plural !== undefined && plural !== null && keyToUpdate.plural !== plural) {
      changeFound = true;
      keyToUpdate.plural = plural;
    }

    const placeholders = UITranslationKey.extractParameters(keyToUpdate.translations, this.getConfigSync().baseLanguage!, keyToUpdate.plural);

    if (JSON.stringify(keyToUpdate.placeholders) !== JSON.stringify(placeholders)) {
      changeFound = true;
      keyToUpdate.placeholders = placeholders;
    }

    if (quantity !== undefined && quantity !== null && JSON.stringify(keyToUpdate.quantity) !== JSON.stringify(quantity)) {
      changeFound = true;
      keyToUpdate.quantity = quantity;
    }

    if (defaultFillins !== undefined && defaultFillins !== null && JSON.stringify(keyToUpdate.defaultFillins) !== JSON.stringify(defaultFillins)) {
      changeFound = true;
      keyToUpdate.defaultFillins = defaultFillins;
    }

    if (!changeFound) {
      return keyToUpdate;
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
        translationKeys[key] = this.getKey(key)!;
      }
    }
    return translationKeys;
  }

  async commitUndo() {
    return figma.commitUndo();
  }
}
