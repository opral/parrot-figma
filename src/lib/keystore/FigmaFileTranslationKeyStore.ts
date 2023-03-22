/* eslint-disable no-await-in-loop */
import Language from '../base/Language';
import Plural from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';
import { BaseTranslationKeyStore } from './BaseTranslationKeyStore';

export interface Config {
  baseLanguage?: Language,
  enabledLanguages?: Language[]
}

export class FigmaFileTranslationKeyStore extends BaseTranslationKeyStore {
  public proxClassName = 'LocalizedLabelManager';

  public static languageConfigDataKey = 'aar_l_';

  keyPrefix = 'aar_k__1';

  keyHistoryPrefix = 'aar_h__1';

  getKey(keyName: string): TranslationKey | undefined {
    const keyRaw = figma.root.getPluginData(this.keyPrefix + keyName);

    if (keyRaw === '' || !keyRaw) {
      return undefined;
    }

    const key = JSON.parse(keyRaw) as TranslationKey;
    key.history = this.getHistorySync(keyName);

    return key;
  }

  async getConfig() {
    const keyRaw = figma.root.getPluginData(FigmaFileTranslationKeyStore.languageConfigDataKey);

    if (keyRaw === '' || !keyRaw) {
      return {
        baseLanguage: undefined,
        enabledLanguages: undefined,
      } as Config;
    }

    return (JSON.parse(keyRaw) as Config);
  }

  // eslint-disable-next-line class-methods-use-this
  async setConfig(languageConfig: Config) {
    figma.root.setPluginData(FigmaFileTranslationKeyStore.languageConfigDataKey, JSON.stringify(languageConfig));
  }

  async getHistory(translationKeyName: string) : Promise<HistoryEntry[]> {
    return this.getHistorySync(translationKeyName);
  }

  getHistorySync(translationKeyName: string) {
    const keyHistoryRaw = figma.root.getPluginData(this.keyHistoryPrefix + translationKeyName);
    const keyHistory = (keyHistoryRaw !== undefined && keyHistoryRaw !== '' ? JSON.parse(keyHistoryRaw) : []) as { [language in Language]? : {
      [plural in Plural]? : {
        text?: string
      }
    } }[];

    return keyHistory;
  }

  async persistKey(translationKeyPased: TranslationKey): Promise<TranslationKey> {
    const translationKey = translationKeyPased;
    const keyCurrentVersion = this.getKey(translationKey.keyName);

    const differences = {} as { [language in Language]? : {
      [plural in Plural]? : {
        text?: string,
        skip: boolean
      }
    } };

    // find differences
    for (const language of Object.keys(translationKey.translations)) {
      const currentLanguage = language as Language;

      for (const plural of Object.keys(translationKey.translations[currentLanguage]!)) {
        const currentPlural = plural as Plural;
        if (keyCurrentVersion?.translations[currentLanguage]?.[currentPlural]?.text === translationKey.translations[currentLanguage]![currentPlural]?.text
                    && keyCurrentVersion?.translations[currentLanguage]?.[currentPlural]?.skip === translationKey.translations[currentLanguage]![currentPlural]?.skip) {
          // console.log(`text equal! ${currentLanguage} ${currentPlural} ${keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text}`);
          // eslint-disable-next-line no-continue
          continue;
        }

        if (differences[currentLanguage] === undefined) {
          differences[currentLanguage] = {
            [currentPlural]: {
              text: translationKey.translations[currentLanguage]![currentPlural]!.text,
              skip: translationKey.translations[currentLanguage]![currentPlural]!.skip,
            },
          };
        } else if (differences[currentLanguage]![currentPlural] === undefined) {
          differences[currentLanguage]![currentPlural] = {
            text: translationKey.translations[currentLanguage]![currentPlural]!.text,
            skip: translationKey.translations[currentLanguage]![currentPlural]!.skip,
          };
        }

        translationKey.translations[currentLanguage]![currentPlural]!.version = translationKey.history.length;
      }
    }

    if (Object.keys(differences).length === 0) {
      // no differences found!
      return translationKey;
    }

    translationKey.latestVersion = translationKey.history.length;

    translationKey.history.push(differences);

    if (translationKey.keyName === undefined) {
      throw new Error('key name must be defined');
    }

    if (translationKey.keyName === 'undefined') {
      throw new Error('key name must not be "undefined"');
    }

    const serializableTranslationKey = translationKey as any;
    const { history } = serializableTranslationKey;
    delete serializableTranslationKey.history;

    figma.root.setPluginData(this.keyPrefix + translationKey.keyName, JSON.stringify(serializableTranslationKey));
    figma.root.setPluginData(this.keyHistoryPrefix + translationKey.keyName, JSON.stringify(history));

    translationKey.history = history;

    return translationKey;
  }

  async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[]): Promise<TranslationKey> {
    return super.createKey(keyName, translations);
  }

  async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; skip: boolean }[]): Promise<TranslationKey> {
    return super.updateKey(keyName, translations);
  }

  async deleteKey(keyName: string): Promise<void> {
    figma.root.setPluginData(this.keyPrefix + keyName, '');
    figma.root.setPluginData(this.keyHistoryPrefix + keyName, '');
  }

  async load(): Promise<TranslationKeys> {
    const translationKeys = {} as TranslationKeys;
    for (const keyWithPrefix of figma.root.getPluginDataKeys()) {
      if (keyWithPrefix.startsWith(this.keyPrefix)) {
        const key = keyWithPrefix.substring(this.keyPrefix.length, keyWithPrefix.length);
        const keyData = figma.root.getPluginData(keyWithPrefix);
        if (keyData && keyData !== '') {
          translationKeys[key] = this.getKey(key)!;
          translationKeys[key].history = await this.getHistory(key);
        }
      }
    }
    return translationKeys;
  }

  async importFromLocalise(): Promise<void> {
    const result = await fetch('http://localhost:3333/api/v1/lokalise', {
      method: 'GET',
      /* headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          }, */
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },

    });
    const lokaliseKeys = await result.json();

    // const start = Date.now();

    const translationKeys = [] as TranslationKey[];

    for (const key of lokaliseKeys.keys) {
      const keyName = key.key_name.other;
      const keyPlurals = [Plural.Other];

      const translations = {} as {
        [language in Language]? : {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean
          }
        }
      };
      for (const transalation of key.translations) {
        const lokaliseLanguage = transalation.language_iso as Language;

        const plurals = {} as {
          [plural in Plural]? : {
            version: number,
            text?: string,
            skip: boolean

          }
        };

        if (key.is_plural) {
          const pluralsLokalise = JSON.parse(transalation.translation);

          for (const plural of Object.keys(pluralsLokalise)) {
            plurals[plural as Plural] = {
              version: -1,
              text: pluralsLokalise[plural],
              skip: false,
            };

            if (keyPlurals.indexOf(plural as Plural) !== -1) {
              keyPlurals.push(plural as Plural);
            }
          }
        } else {
          // console.log(transalation);
          plurals[Plural.Other] = {
            version: -1,
            text: transalation.translation,
            skip: false,
          };
        }

        translations[lokaliseLanguage] = plurals;
      }

      translationKeys.push({
        keyName,
        latestVersion: 0,
        plurals: keyPlurals,
        translations,
        history: [],
      });
    }

    // console.log(`Execution time: Response processing: ${Date.now() - start} ms`);

    // console.log(`${translationKeys.length} keys found `);

    for (const tanslationKey of translationKeys) {
      this.persistKey(tanslationKey);
    }
    // console.log(`Execution time: persisting keys: ${Date.now() - start} ms`);
  }
}
