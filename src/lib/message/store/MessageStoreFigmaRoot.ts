/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */

import TextEncoding from 'text-encoding';

import blake from 'blakejs';
import { Locale } from '../variants/Locale';
import { Plural } from '../variants/Plural';
import {
  HistoryTag, HistoryEntry, Message, Messages, PlaceholdersByName, Fillins, PlaceholderType,
} from '../Message';
import { MessageUI } from '../MessageUI';

const encoder = new TextEncoding.TextEncoder();

export interface Config {
  baseLanguage?: Locale,
  enabledLanguages?: Locale[]
}

const defaultStringFillinValue = 'Loren Impsum';
const defaultDecimalFillinValue = 7;
const defaultFloatFillinValue = Math.PI;

export class MessageStoreFigmaRoot {
  public proxyClassName = 'MessageStoreFigmaRoot';

  public static configDataKey = 'aar_c';

  /**
   * we store a version map here:
   * [
   *  { name: 'v-1.0.0', description: '', id: string? },
   * ]
   */
  public static tagsDataKey = 'aar_t';

  /**
   * Prefix for keys - the head version of a key is stored withing a key of the root node of the document prefixed with the keyPrefix followed by the keyname
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
              const id = currentFileStorageKey.slice(this.keyHistoryPrefix.length);

              if (this.keyState[id] === undefined) {
                if (JSON.parse(figma.root.getPluginData(currentFileStorageKey)).ref === undefined) {
                  changedKeys.added.push(id);
                }
              } else {
                if (figma.root.getPluginData(currentFileStorageKey).length !== this.keyState[id]) {
                  changedKeys.updated.push(id);
                }

                currentCachedKeys = currentCachedKeys.filter((key) => key !== id);
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
    const keyRaw = figma.root.getPluginData(MessageStoreFigmaRoot.configDataKey);

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
    figma.root.setPluginData(MessageStoreFigmaRoot.configDataKey, JSON.stringify(languageConfig));
  }

  getHistoryTagsSync() {
    const tagsRaw = figma.root.getPluginData(MessageStoreFigmaRoot.tagsDataKey);
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
    figma.root.setPluginData(MessageStoreFigmaRoot.tagsDataKey, JSON.stringify(currentTags));

    // add tag to all keys
    for (const keyWithPrefix of figma.root.getPluginDataKeys()) {
      if (keyWithPrefix.startsWith(this.keyPrefix)) {
        const keyData = figma.root.getPluginData(keyWithPrefix);
        if (keyData && keyData !== '') {
          const keyAny = JSON.parse(keyData) as any;
          if (keyAny.ref !== undefined) {
            // eslint-disable-next-line no-continue
            continue;
          }

          const key = keyAny as Message;
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
    figma.root.setPluginData(MessageStoreFigmaRoot.tagsDataKey, JSON.stringify(currentTags));

    return currentTags[tagId];
  }

  async getHistory(messageName: string) : Promise<HistoryEntry[]> {
    return this.getHistorySync(messageName).keyHistory;
  }

  getHistorySync(messageName: string) {
    const keyHistoryRaw = figma.root.getPluginData(this.keyHistoryPrefix + messageName);
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

  private createKeyId(keyName: string, bucket: number) {
    
    const messageNameHash = blake.blake2sHex(encoder.encode(keyName), undefined, 5);
    // debugging: const messageNameHash = keyName;
    return `${bucket}_${messageNameHash}`;
  }

  private findUnusedId(messageName: string) {
    let currentBuket = 0;
    let idToTest = this.createKeyId(messageName, currentBuket);
    while (figma.root.getPluginData(`${this.keyPrefix}${idToTest}`) !== '') {
      currentBuket += 1;
      idToTest = this.createKeyId(messageName, currentBuket);
    }
    return idToTest;
  }

  getKeyByName(keyName: string) {
    let currentBuket = 0;
    let id = this.createKeyId(keyName, currentBuket);
    let message = undefined as Message | undefined;

    while (figma.root.getPluginData(`${this.keyPrefix}${id}`) !== '') {
      message = this.resolveMessageReference(id, keyName);
      if (message !== undefined) {
        return message;
      }
      currentBuket += 1;
      id = this.createKeyId(keyName, currentBuket);
    }
    return undefined;
  }

  resolveMessageReference(id: string, name: string): Message | undefined {
    const referencedMessageRaw = figma.root.getPluginData(`${this.keyPrefix}${id}`);
    if (referencedMessageRaw === '' || !referencedMessageRaw) {
      return undefined;
    }
    const referencedMessage = JSON.parse(referencedMessageRaw) as any;
    if (referencedMessage.ref) {
      return this.resolveMessageReference(referencedMessage.ref, name);
    }
    if (referencedMessage.keyName && referencedMessage.keyName === name) {
      return this.getKey(id);
    }
    return undefined;
  }

  getKey(id: string): Message | undefined {
    const keyRaw = figma.root.getPluginData(this.keyPrefix + id);

    if (keyRaw === '' || !keyRaw) {
      return undefined;
    }

    const keyAny = JSON.parse(keyRaw) as any;

    if (keyAny.ref !== undefined) {
      return undefined;
    }

    const key = keyAny as Message;


    // this is where we add the id from the bucket it was found in
    key.id = id;

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
    const historyObj = this.getHistorySync(id);
    key.history = historyObj.keyHistory;
    key.latestVersion = key.history.length - 1;
    key.referencingTextNodes = this.keyToLabels[key.id] ? [...this.keyToLabels[key.id]] : [];
    this.keyState[id] = historyObj.state;

    return key;
  }

  async getKeyAsync(id: string) {
    return this.getKey(id);
  }

  private async persistKey(messagePased: Message): Promise<Message> {
    const message = messagePased;
    const keyCurrentVersion = this.getKey(message.id);

    let historyEntry: HistoryEntry | undefined;
    const userId = figma.currentUser?.id ?? 'anonymous';
    const dateOfChange = Date.now();

    // find differences
    for (const language of Object.keys(message.variants)) {
      const currentLanguage = language as Locale;

      for (const plural of Object.keys(message.variants[currentLanguage]!)) {
        const currentPlural = plural as Plural;
        if (message.variants[currentLanguage]![currentPlural]) {
          message.variants[currentLanguage]![currentPlural]!.text = message.variants[currentLanguage]![currentPlural]?.text === '' ? undefined : message.variants[currentLanguage]![currentPlural]?.text;
        }
        if (keyCurrentVersion?.variants[currentLanguage]?.[currentPlural]?.text === message.variants[currentLanguage]![currentPlural]?.text
                    && keyCurrentVersion?.variants[currentLanguage]?.[currentPlural]?.skip === message.variants[currentLanguage]![currentPlural]?.skip) {
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
              text: message.variants[currentLanguage]![currentPlural]!.text,
              skip: message.variants[currentLanguage]![currentPlural]!.skip,
            },
          };
        } else if (historyEntry.translations![currentLanguage]![currentPlural] === undefined) {
          historyEntry.translations![currentLanguage]![currentPlural] = {
            text: message.variants[currentLanguage]![currentPlural]!.text,
            skip: message.variants[currentLanguage]![currentPlural]!.skip,
          };
        }

        message.variants[currentLanguage]![currentPlural]!.version = message.history.length;
      }
    }

    if (!keyCurrentVersion || message.plural !== keyCurrentVersion?.plural) {
      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.plural = message.plural;
    }

    if (!keyCurrentVersion || MessageStoreFigmaRoot.arraysAreEqual(message.labels, keyCurrentVersion.labels)) {
      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.labels = message.labels;
    }

    let createMessageNameRef = undefined as string | undefined;

    if (keyCurrentVersion && keyCurrentVersion.keyName !== message.keyName) {
      const existingKeyWithName = this.getKeyByName(message.keyName);
      if (existingKeyWithName && existingKeyWithName.id !== message.id) {
        throw new Error(`Key with name ${message.keyName} exists already.`);
      }

      if (existingKeyWithName === undefined) {
        createMessageNameRef = message.keyName;
      }

      if (!historyEntry) {
        historyEntry = { user: userId, date: dateOfChange };
      }

      historyEntry.name = message.keyName;
    }

    if (!historyEntry) {
      // no differences found!
      return message;
    }

    message.latestVersion = message.history.length;

    message.history.push(historyEntry);

    if (message.keyName === undefined) {
      throw new Error('key name must be defined ');
    }

    const serializableTranslationKey = message as any;
    const { history } = serializableTranslationKey;
    delete serializableTranslationKey.history;
    const messageId = message.id;
    delete serializableTranslationKey.id;

    figma.root.setPluginData(this.keyPrefix + messageId, JSON.stringify(serializableTranslationKey));
    figma.root.setPluginData(this.keyHistoryPrefix + messageId, JSON.stringify(history));

    if (createMessageNameRef !== undefined) {
      // we don't have a reference that acutally points to the name create a new one in the next free bucket.
      // NOTE: we can't reuse buckets that no longer point the the correct key since labels eventually still use the reference...
      const unusedId = this.findUnusedId(message.keyName);
      figma.root.setPluginData(this.keyPrefix + unusedId, JSON.stringify({ ref: messageId }));
    }

    // storage idea:
    // Use KEYNAME as initial Message id and store the data in arr_k_KEYNAME
    // on rename to NEW_KEYNAME keep KEYNAME as Message Id - since labels referencing to it already and we want to keep the history
    // But: Store a "reference" entity within arr_k_NEW_KEYNAME this allows us to detect collision on keynames without checking all message for id collision
    // If the place arr_k_NEW_KEYNAME is taken we potentially have a conflict:
    // - check what is stored within arr_k_NEW_KEYNAME.
    //   - if it is a key - check the current key name - if it is != arr_k_NEW_KEYNAME the key has been renamed in the meantime - no collision on this enitity
    //   - if it is a reference: - resolve the reference and check its  current key - if it is != arr_k_NEW_KEYNAME the key has been renamed in the meantime - no collision on this enitity
    //      - check what is stored within arr_k_NEW_KEYNAME_1
    //   - else we have a conflict

    // TODO #8 handle history for placeholder, fillins and quantity!
    // TODO key history: pause event event handling using a flag;

    message.history = history;
    message.id = messageId;
    return message;
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

  async createKey(keyName: string, translations: { language: Locale; plural: Plural; text: string | undefined; skip: boolean }[], plural: boolean, quantity?: { value: number } | { placeholder: string }, defaultFillins?: Fillins): Promise<Message> {
    const existingKey = this.getKeyByName(keyName);
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

    const placeholders = MessageUI.extractParameters(translationsObj, this.getConfigSync().baseLanguage!, plural);

    const unusedId = this.findUnusedId(keyName);
    const createdKey = {
      id: unusedId,
      latestVersion: 0,
      keyName,
      labels: [],
      plural,
      variants: translationsObj,
      referencingTextNodes: this.keyToLabels[keyName] ? [...this.keyToLabels[keyName]] : [],
      placeholders,
      quantity,
      defaultFillins,
      history: [], // first history entry will be added in persistKey method...
      historyTags: [],
    } as Message;
    return this.persistKey(createdKey);
  }

  async updateKey(keyId: string, properties: {
    name?: string,
    translations: { language: Locale; plural: Plural; text: string | undefined; skip: boolean }[], 
    plural?: boolean, 
    quantity?: { value: number } | { placeholder: string }, 
    defaultFillins?: Fillins
  }): Promise<Message> {
    // this one gets a deep clone of the key
    const keyToUpdate = this.getKey(keyId);
    let changeFound = false;

    if (keyToUpdate === undefined) {
      throw new Error(`Key [${keyId}] not found!`);
    }

    for (const translation of properties.translations) {
      // if no key for the given language exists - create an empty one for plural 'other' with version -1
      if (!keyToUpdate.variants[translation.language]) {
        keyToUpdate.variants[translation.language] = {
          other: {
            version: -1,
            skip: false,
            verified: false, // TODO #9 - check if false is correct
          },
        };
      }

      // if the target plural does not extist yet create a dummy one - vlues get overriden in next step
      if (!keyToUpdate.variants[translation.language]![translation.plural]) {
        keyToUpdate.variants[translation.language]![translation.plural] = {
          version: -1,
          skip: false,
          verified: false, // TODO #9 - check if false is correct
        };
      }

      // create a new translation entry with increased version
      if (keyToUpdate.variants[translation.language]![translation.plural]!.text !== translation.text
        || keyToUpdate.variants[translation.language]![translation.plural]!.skip !== translation.skip) {
        changeFound = true;
        keyToUpdate.variants[translation.language]![translation.plural]!.version = keyToUpdate.latestVersion + 1;
        keyToUpdate.variants[translation.language]![translation.plural]!.text = translation.text;
        keyToUpdate.variants[translation.language]![translation.plural]!.skip = translation.skip;
      }
    }

    if (properties.plural !== undefined && properties.plural !== null && keyToUpdate.plural !== properties.plural) {
      changeFound = true;
      keyToUpdate.plural = properties.plural;
    }

    const placeholders = MessageUI.extractParameters(keyToUpdate.variants, this.getConfigSync().baseLanguage!, keyToUpdate.plural);

    if (JSON.stringify(keyToUpdate.placeholders) !== JSON.stringify(placeholders)) {
      changeFound = true;
      keyToUpdate.placeholders = placeholders;
    }

    if (properties.quantity !== undefined && properties.quantity !== null && JSON.stringify(keyToUpdate.quantity) !== JSON.stringify(properties.quantity)) {
      changeFound = true;
      keyToUpdate.quantity = properties.quantity;
    }

    if (properties.defaultFillins !== undefined && properties.defaultFillins !== null && JSON.stringify(keyToUpdate.defaultFillins) !== JSON.stringify(properties.defaultFillins)) {
      changeFound = true;
      keyToUpdate.defaultFillins = properties.defaultFillins;
    }

    if (properties.name !== undefined && keyToUpdate.keyName !== properties.name) {
      changeFound = true;
      keyToUpdate.keyName = properties.name;
    }

    if (!changeFound) {
      return keyToUpdate;
    }
    return this.persistKey(keyToUpdate);
  }

  async deleteKey(keyId: string): Promise<void> {
    figma.root.setPluginData(this.keyPrefix + keyId, '');
    figma.root.setPluginData(this.keyHistoryPrefix + keyId, '');
  }

  async load(): Promise<Messages> {
    const messages = {} as Messages;
    for (const keyWithPrefix of figma.root.getPluginDataKeys()) {
      if (keyWithPrefix.startsWith(this.keyPrefix)) {
        const key = keyWithPrefix.substring(this.keyPrefix.length, keyWithPrefix.length);
        const message = this.getKey(key);
        if (message !== undefined) {
          messages[key] = message;
        }
      }
    }
    return messages;
  }

  async commitUndo() {
    return figma.commitUndo();
  }
}
