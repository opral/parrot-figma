/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Plural } from '../base/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

export default class JsonKeyValueImporter {
  static reformatPlaceholders(text: string) {
    return text; // TODO #8 map all ios placeholders to plugin format
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

    for (const [key, text] of Object.entries(json)) {
      importedKeys.push({
        keyName: key,
        plural: Plural.OTHER,
        text: this.unMask(text as string),
      });
    }

    return importedKeys;
  }
}
