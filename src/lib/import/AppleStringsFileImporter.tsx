/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Plural } from '../base/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

export default class AppleStringsFileImporter {
  static reformatPlaceholders(text: string) {
    return text; // TODO #8 map all ios placeholders to plugin format
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
    if (fileExtension !== 'strings') {
      return undefined;
    }

    // split the file contents into an array of lines
    const lines = stringsFileContent.split('\n');

    // create an empty object to hold our key-value pairs
    const importedKeys = [] as ImportTranslationKey[];

    // iterate over each line of the file
    // eslint-disable-next-line no-plusplus
    let inComment = false;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      // handle the start of a /* */ comment
      if (line.startsWith('/*')) {
        inComment = true;
        // handle oneliner comments
        if (line.endsWith('*/')) {
          inComment = false;
        }
        continue;
      }

      // handle the end of a /* */ comment
      if (line.endsWith('*/')) {
        inComment = false;
        continue;
      }

      // skip any comments or empty lines
      if (line.startsWith('//') || line.length === 0 || inComment) {
        continue;
      }

      // split the line into a key and value pair
      const parts = line.split('=');
      let key = parts[0].trim();
      let value = parts[1].trim();
      let quoteWrapped = false;

      // remove any surrounding quotes from the key and value
      if (key.startsWith('"') && key.endsWith('"')) {
        key = key.slice(1, -1);
      }
      if (value.startsWith('"') && value.endsWith('"')) {
        value = value.slice(1, -1);
        quoteWrapped = true;
      }

      if (value.startsWith('"') && value.endsWith('";')) {
        value = value.slice(1, -2);
        quoteWrapped = true;
      }

      if (quoteWrapped) {
        value = value.split('\\"').join('"');
      }
      value = value.replace(/\\n/g, '\n');

      value = this.toParrotPlaceholders(value);

      // add the key-value pair to our result object
      importedKeys.push({
        keyName: key,
        plural: Plural.OTHER,
        text: value,
      });
    }

    return importedKeys;
  }
}
