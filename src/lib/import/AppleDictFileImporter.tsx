/* eslint-disable no-await-in-loop */
/* eslint-disable no-continue */
/* eslint-disable no-plusplus */

import { Plural } from '../base/Plural';
import { ImportTranslationKey } from './ImportTranslationKey';

export default class AppleDictFileImporter {
  static reformatPlaceholders(text: string) {
    return text; // TODO #8 map all ios placeholders to plugin format
  }

  static toImportObject(filename: string, stringsdictFileContent: string): ImportTranslationKey[] | undefined {
    const fileNameParts = filename.split('.');
    const fileExtension = fileNameParts[fileNameParts.length - 1];
    if (fileExtension !== 'dict') {
      return undefined;
    }

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(stringsdictFileContent, 'text/xml');

      const translationKeys: ImportTranslationKey[] = [];

      // get all the dict elements in the document
      const dictElements = xmlDoc.getElementsByTagName('dict');

      // loop through each dict element
      for (let i = 0; i < dictElements.length; i++) {
        const dictElement = dictElements[i];

        // get the key name from the first child element
        const keyName = dictElement.getElementsByTagName('key')[0].textContent!;

        // check if the dict element contains a plural rule type
        const pluralRulesElement = dictElement.querySelector(
          'key:contains("NSStringPluralRuleType")',
        );
        if (pluralRulesElement) {
          const pluralRules = pluralRulesElement.nextElementSibling;

          // extract the translations for each plural rule
          for (let j = 0; j < pluralRules!.children.length; j++) {
            const rule = pluralRules!.children[j];
            const plural = rule.tagName as Plural;
            const text = rule.textContent ?? undefined;

            translationKeys.push({
              keyName,
              plural,
              text,
            });
          }
        } else {
          // the dict element does not contain a plural rule type
          // add the key to the translation keys with the 'other' plural rule
          const valueElement = dictElement.querySelector('dict > string');
          const text = valueElement && valueElement.textContent ? valueElement.textContent : undefined;
          translationKeys.push({
            keyName,
            plural: Plural.OTHER,
            text,
          });
        }
      }

      return translationKeys;
    } catch (error) {
      console.error('Failed to parse strings file content:', error);
      return undefined;
    }
  }
}
