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
import { Gender } from '../message/variants/Gender';

function toChangeArray(importKey: ImportMessage, locale: Locale) {
  return [{
    locale,
    gender: importKey.gender,
    plural: importKey.plural,
    text: importKey.text,
    skip: false,
  }] as { locale: Locale; gender: Gender; plural: Plural; text: string | undefined; skip: boolean }[];
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
    const changedMessages = {
      language,
      newMessages: [] as ImportMessage[],
      newVariants: [] as ImportMessage[],
      updatedVariants: [] as ImportMessage[],
    };

    // TODO #14 use inlang for import
    // for (const messageToImport of importMessages) {
    //   const currentMessage = messageStore.getMessageByName(messageToImport.name);
    //   if (!currentMessage) {
    //     // eslint-disable-next-line @typescript-eslint/no-unused-vars
    //     changedMessages.newMessages.push(messageToImport);
    //   } else if (!currentMessage.variants[language]) {
    //     changedMessages.newVariants.push(messageToImport);
    //   } else if (!currentMessage.variants[language]![messageToImport.gender]) {
    //     changedMessages.newVariants.push(messageToImport);
    //   } else if (!currentMessage.variants[language]![messageToImport.gender]![messageToImport.plural]) {
    //     changedMessages.newVariants.push(messageToImport);
    //   } else if (currentMessage.variants[language]![messageToImport.gender]![messageToImport.plural]!.text !== messageToImport.text) {
    //     changedMessages.updatedVariants.push(messageToImport);
    //   }
    // }

    return changedMessages;
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
        // TODO #14 implemnt imported 
        // const createdMessage = await labelManager.messageStore.createMessage(messageToImport.name, toChangeArray(messageToImport, language), false, false);
      } else {
        console.log(`updateing key${messageToImport.name}`);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        // TODO #14 implemnt imported 
        // const updatedMessage = await labelManager.updateMessage(currentKey.id, { variants: toChangeArray(messageToImport, language) });
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
