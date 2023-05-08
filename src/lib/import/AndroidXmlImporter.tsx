/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

export default class AndroidXmlImporter {
  static reformatPlaceholders(text: string) {
    return text; // TODO map all ios placeholders to plugin format
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
    let str = value;
    let quotWrapped = false;

    if (str.startsWith('"') && str.endsWith('"')) {
      quotWrapped = true;
      str = str.slice(1, -1);
    } if (str.startsWith('&quot;') && str.endsWith('&quot;')) {
      quotWrapped = true;
      str = str.slice(6, -6);
    }

    if (!quotWrapped) {
      str = str.split('\\@').join('@');
      str = str.split('\\?').join('?');
      str = str.split('\\n').join('\n');
      str = str.split("\\'").join("'");
    } else {
      str = str.split('\\"').join('"');
    }

    return str;
  }

  static toImportObject(filename: string, stringsFileContent: string): ImportTranslationKey[] | undefined {
    const fileNameParts = filename.split('.');
    const fileExtension = fileNameParts[fileNameParts.length - 1];
    if (fileExtension !== 'xml') {
      return undefined;
    }

    let resources : Element;

    try {
      const xml = new DOMParser().parseFromString(stringsFileContent, 'text/xml');
      const resourcesNodes = xml.getElementsByTagName('resources');
      if (resourcesNodes.length === 0) {
        return undefined;
      }

      // eslint-disable-next-line prefer-destructuring
      resources = resourcesNodes[0];
    } catch (e) {
      console.warn(e);
      return undefined;
    }

    // create an empty object to hold our key-value pairs
    const importedKeys = [] as ImportTranslationKey[];

    for (const childNode of resources.childNodes) {
      if (childNode.nodeType !== Node.ELEMENT_NODE) {
        // Skip non-Element nodes
        continue;
      }

      if (childNode.nodeName === 'string') {
        const stringNode = childNode as Element;
        if (!stringNode.getAttribute('name')) {
          continue;
        }

        if (!childNode.textContent) {
          continue;
        }

        importedKeys.push({
          keyName: stringNode.getAttribute('name') as string,
          plural: Plural.OTHER,
          text: this.unMask(childNode.textContent),
        });
      } else if (childNode.nodeName === 'plurals') {
        const pluralNode = childNode as Element;
        if (!pluralNode.getAttribute('name')) {
          continue;
        }

        const plurals = AndroidXmlImporter.getPluralItems(pluralNode);
        for (const pluralType of (Object.keys(plurals) as Plural[])) {
          importedKeys.push({
            keyName: pluralNode.getAttribute('name') as string,
            plural: pluralType,
            text: this.unMask(plurals[pluralType]!.text!),
          });
        }
      }
    }

    return importedKeys;
  }
}
