/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import MemoryTranslationKeyStore from '../keystore/MemoryTranslationKeyStore';

import AppleStringsFileImporter from './AppleStringsFileImporter';
import AndroidXMLImporter from './AndroidXmlImporter';
import { ImportTranslationKey } from './ImportTranslationKey';

function toChangeArray(importKey: ImportTranslationKey, language: Language) {
  return [{
    language,
    plural: importKey.plural,
    text: importKey.text,
    skip: false,
  }] as { language: Language; plural: Plural; text: string | undefined; skip: boolean }[];
}

export default class KeyImporter {
  static getImportStatistics(keyStore: MemoryTranslationKeyStore, importKeys: ImportTranslationKey[], language: Language) {
    const changedKeys = {
      newKeys: [] as ImportTranslationKey[],
      newTranslations: [] as ImportTranslationKey[],
      updatedTranslations: [] as ImportTranslationKey[],
    };

    for (const keyToImport of importKeys) {
      const currentKey = keyStore.getKey(keyToImport.keyName);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        changedKeys.newKeys.push(keyToImport);
      } else if (!currentKey.translations[language]) {
        changedKeys.newTranslations.push(keyToImport);
      } else if (!currentKey.translations[language]![keyToImport.plural]) {
        changedKeys.newTranslations.push(keyToImport);
      } else if (currentKey.translations[language]![keyToImport.plural]!.text !== keyToImport.text) {
        changedKeys.updatedTranslations.push(keyToImport);
      }
    }

    return changedKeys;
  }

  static processFile(fileName: string, content: string) {
    console.log(`processing file${fileName} content: ${content}`);

    const results = {
      type: 'unsupported',
      keys: undefined as ImportTranslationKey[] | undefined,
    };

    let importObject = AppleStringsFileImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = 'ios-strings';
      results.keys = importObject;
    } else {
      importObject = AndroidXMLImporter.toImportObject(fileName, content);
      if (importObject) {
        results.type = 'android-xml';
        results.keys = importObject;
      }
    }

    return results;
  }

  static async import(keyStore: MemoryTranslationKeyStore, keysToImport: ImportTranslationKey[], language: Language) {
    for (const keyToImport of keysToImport) {
      
      const currentKey = keyStore.getKey(keyToImport.keyName);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log('creating key' + keyToImport.keyName);
        const createdKey = await keyStore.createKey(keyToImport.keyName, toChangeArray(keyToImport, language), false);
      } else {
        console.log('updateing key' + keyToImport.keyName);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const updatedKey = await keyStore.updateKey(keyToImport.keyName, toChangeArray(keyToImport, language));
      }
    }
    // TODO keyStore.commit();
  }
}
/* const changedKeys = {
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
    } */
