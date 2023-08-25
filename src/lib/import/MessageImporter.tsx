/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */
import { Locale } from '../message/variants/Locale';
import { Plural } from '../message/variants/Plural';
import MessageStoreMemory from '../message/store/MessageStoreMemory';

import AppleStringsFileImporter from './AppleStringsFileImporter';
import AndroidXMLImporter from './AndroidXmlImporter';

import { ImportMessage } from './ImportMessage';
import LocalizedLabelManagerUI from '../localizedlabels/LocalizedLabelManagerUI';
import I18NextKeyValueImporter from './I18Next';

function toChangeArray(importKey: ImportMessage, language: Locale) {
  return [{
    language,
    plural: importKey.plural,
    text: importKey.text,
    skip: false,
  }] as { language: Locale; plural: Plural; text: string | undefined; skip: boolean }[];
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
  messages: ImportMessage[] | undefined,
};

export default class MessageImporter {
  static getImportStatistics(messageStore: MessageStoreMemory, importMessages: ImportMessage[], language: Locale) {
    const changedKeys = {
      language,
      newKeys: [] as ImportMessage[],
      newTranslations: [] as ImportMessage[],
      updatedTranslations: [] as ImportMessage[],
    };

    for (const messageToImport of importMessages) {
      const currentKey = messageStore.getMessageByName(messageToImport.name);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        changedKeys.newKeys.push(messageToImport);
      } else if (!currentKey.variants[language]) {
        changedKeys.newTranslations.push(messageToImport);
      } else if (!currentKey.variants[language]![messageToImport.plural]) {
        changedKeys.newTranslations.push(messageToImport);
      } else if (currentKey.variants[language]![messageToImport.plural]!.text !== messageToImport.text) {
        changedKeys.updatedTranslations.push(messageToImport);
      }
    }

    return changedKeys;
  }

  static processFile(fileName: string, content: string): ImportResult {
    console.log(`processing file${fileName} content: ${content}`);

    const results = {
      fileName,
      type: ImportType.UNSUPPORTED,
      messages: undefined as ImportMessage[] | undefined,
    };

    let importObject = AppleStringsFileImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.IOS_STRINGS;
      results.messages = importObject;
      return results;
    }

    importObject = AndroidXMLImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.ANDROID_XML;
      results.messages = importObject;
      return results;
    }

    importObject = I18NextKeyValueImporter.toImportObject(fileName, content);
    if (importObject) {
      results.type = ImportType.L18N_JSON;
      results.messages = importObject;
      return results;
    }

    return results;
  }

  static async import(labelManager: LocalizedLabelManagerUI, messagesToImport: ImportMessage[], language: Locale) {
    for (const messageToImport of messagesToImport) {
      const currentKey = labelManager.messageStore.getMessageByName(messageToImport.name);
      if (!currentKey) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        console.log(`creating key${messageToImport.name}`);
        // TODO #8 implement import logic for placeholders and quantities
        const createdMessage = await labelManager.messageStore.createMessage(messageToImport.name, toChangeArray(messageToImport, language), false);
      } else {
        console.log(`updateing key${messageToImport.name}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const updatedMessage = await labelManager.updateKey(currentKey.id, { variants: toChangeArray(messageToImport, language) });
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
      } else if (currentKey!.messages[lang]?.other?.text !== result[key]) {
        const skip = currentKey!.messages[lang]?.other?.skip ?? false;
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
