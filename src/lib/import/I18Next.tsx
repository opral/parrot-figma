/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Plural } from '../message/variants/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

const separator = '__';

export default class I18NextKeyValueImporter {
  static toParrotPlaceholders(inputString: string) {
    const regex = /{{([^}]*)}}/g;

    const replacedString = inputString.replace(regex, (match, group1) => {
      const type = group1 === 'count' ? 'd' : 's';
      const format = '';
      const arg = '';
      const parameterName = group1;
      return `<ph type="${type}"${format}${arg} unnamed>${parameterName}</ph>`;
    });
    return replacedString;
  }

  static extractPlural(key: string) {
    const pluralPostfixes = {
      _one: Plural.ONE,
      _other: Plural.OTHER,
    };

    for (const [pluralPostfix, pluralForm] of Object.entries(pluralPostfixes)) {
      if (key.endsWith(pluralPostfix)) {
        return {
          plural: pluralForm,
          key: key.substring(0, key.length - pluralPostfix.length),
        };
      }
    }

    return {
      plural: Plural.OTHER,
      key,
    };
  }

  private static getPluralItems(pluralNode: Element) {
    const items = pluralNode.getElementsByTagName('item');
    const plurals = {} as {
      [plural in Plural]? : {
        text?: string,
        // TODO #9 verified
        skip?: boolean
      }
    };
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const quantity = item.getAttribute('quantity') as string;
      plurals[quantity as Plural] = { text: item.textContent! };
    }
    return plurals;
  }

  private static unMask(value: string) {
    return value;
  }

  static toImportObject(filename: string, stringsFileContent: string): ImportTranslationKey[] | undefined {
    const fileNameParts = filename.split('.');
    const fileExtension = fileNameParts[fileNameParts.length - 1];
    if (fileExtension !== 'json') {
      return undefined;
    }

    let json = {} as any;

    try {
      json = JSON.parse(stringsFileContent);

      if (Object.keys(json).length === 0) {
        return undefined;
      }
    } catch (e) {
      console.warn(e);
      return undefined;
    }

    // create an empty object to hold our key-value pairs
    const importedKeys = [] as ImportTranslationKey[];

    this.nodeToImpotObjects('', json, importedKeys);

    return importedKeys;
  }

  static nodeToImpotObjects(keyName: string, node: any, keys: ImportTranslationKey[]) {
    for (const [key, subNode] of Object.entries(node)) {
      const currentKeyName = `${keyName}${key}`;
      if (typeof subNode === 'string') {
        const keyAndPlrual = I18NextKeyValueImporter.extractPlural(currentKeyName);
        keys.push({
          keyName: keyAndPlrual.key,
          plural: keyAndPlrual.plural,
          text: this.toParrotPlaceholders(subNode as string),
        });
      } else if (typeof subNode === 'object') {
        I18NextKeyValueImporter.nodeToImpotObjects((currentKeyName + separator), subNode, keys);
      }
    }
  }
}
