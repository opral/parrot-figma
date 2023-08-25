/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Locale } from '../message/variants/Locale';
import { Plural } from '../message/variants/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

export default class AndroidXmlImporter {
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

  private static toParrotFormat(value: string) {
    /*
    Bold: <b>, <em>
    Italic: <i>, <cite>, <dfn>
    25% larger text: <big>
    20% smaller text: <small>
    Setting font properties: <font face=”font_family“ color=”hex_color”>. Examples of possible font families include monospace, serif, and sans_serif.
    Setting a monospace font family: <tt>
    Strikethrough: <s>, <strike>, <del>
    Underline: <u>
    Superscript: <sup>
    Subscript: <sub>
    Bullet points: <ul>, <li>
    Line breaks: <br>
    Division: <div>
    CSS style: <span style=”color|background_color|text-decoration”>
    Paragraphs: <p dir=”rtl | ltr” style=”…”></div>
    */

  }

  private static toParrotPlaceholders(inputString: string) {
    const regex = /%(([\d]*)\$)?(\.[\d]*)*([sdf])/g;

    let index = 1;
    const replacedString = inputString.replace(regex, (match, group1, group2, group3, group4) => {
      const type = group4;
      let format = '';
      let arg = '';
      const parameterName = `unnamed__${index++}`;

      if (type === 'f' && group3) {
        format = ` format="${group3}"`;
      }

      if (group2) {
        arg = ` arg="${group2}"`;
      }

      return `<ph type="${type}"${format}${arg} unnamed>${parameterName}</ph>`;
    });
    return replacedString;
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
          text: this.toParrotPlaceholders(this.unMask(childNode.textContent)),
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
            text: this.toParrotPlaceholders(this.unMask(plurals[pluralType]!.text!)),
          });
        }
      }
    }

    return importedKeys;
  }
}
