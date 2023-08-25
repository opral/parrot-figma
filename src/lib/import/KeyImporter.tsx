/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */
import { Language } from '../message/variants/Locale';
import { Plural } from '../message/variants/Plural';
import MemoryTranslationKeyStore from '../message/store/MessageStoreMemory';

import AppleStringsFileImporter from './AppleStringsFileImporter';
import AndroidXMLImporter from './AndroidXmlImporter';

import { ImportTranslationKey } from './ImportTranslationKey';
import LocalizedLabelManagerUI from '../localizedlabels/LocalizedLabelManagerUI';
import I18NextKeyValueImporter from './I18Next';

function toChangeArray(importKey: ImportTranslationKey, language: Language) {
  return [{
    language,
    plural: importKey.plural,
    text: importKey.text,
    skip: false,
  }] as { language: Language; plural: Plural; text: string | undefined; skip: boolean }[];
}

export enum ImportType {
  UNSUPPORTED = 'not supported',
  IOS_STRINGS = 'iOS Strings File',
  ANDROID_XML = 'Android resource XML',
  L18N_JSON = 'l18next JSON',
}

export type ImportResult = {
  fileName: string,
  type: ImportType,
  keys: ImportTranslationKey[] | undefined,
};

export default class KeyImporter {
  static getImportStatistics(keyStore: MemoryTranslationKeyStore, importKeys: ImportTranslationKey[], language: Language) {
    const changedKeys = {
      language,
      newKeys: [] as ImportTranslationKey[],
      newTranslations: [] as ImportTranslationKey[],
      updatedTranslations: [] as ImportTranslationKey[],
    };

    for (const keyToImport of importKeys) {
      const currentKey = keyStore.getKeyByName(keyToImport.keyName);
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

  static processFile(fileName: string, content: string): ImportResult {
    console.log(`processing file${fileName} content: ${content}`);

    const results = {
      fileName,
      type: ImportType.UNSUPPORTED,
      keys: undefined as ImportTranslationKey[] | undefined,
    };

    let importObject = AppleStringsFileImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.IOS_STRINGS;
      results.keys = importObject;
      return results;
    }

    importObject = AndroidXMLImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.ANDROID_XML;
      results.keys = importObject;
      return results;
    }

    importObject = I18NextKeyValueImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.L18N_JSON;
      results.keys = importObject;
      return results;
    }

    return results;
  }

  static async import(labelManager: LocalizedLabelManagerUI, keysToImport: ImportTranslationKey[], language: Language) {
    for (const keyToImport of keysToImport) {
      const currentKey = labelManager.keyStore.getKeyByName(keyToImport.keyName);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log(`creating key${keyToImport.keyName}`);
        // TODO #8 implement import logic for placeholders and quantities
        const createdKey = await labelManager.keyStore.createKey(keyToImport.keyName, toChangeArray(keyToImport, language), false);
      } else {
        console.log(`updateing key${keyToImport.keyName}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const updatedKey = await labelManager.updateKey(currentKey.id, { translations: toChangeArray(keyToImport, language) });
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
