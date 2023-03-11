import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { TranslationKey, TranslationKeys } from "./TranslationKey";
import { BaseTranslationKeyStore } from "./BaseTranslationKeyStore";


export class FigmaFileTranslationKeyStore extends BaseTranslationKeyStore {

    public proxClassName = 'LocalizedLabelManager'

    keyPrefix = 'aar_k__1';
    keyHistoryPrefix = 'aar_h__1';

    getKey(keyName: string): TranslationKey | undefined {

        let keyRaw = figma.root.getPluginData(this.keyPrefix + keyName);
        
        if (keyRaw === '' || !keyRaw) {
            return undefined;
        }

    
        return JSON.parse(keyRaw) as TranslationKey;
    }

    async getHistory(translationKeyName: string, language: Language, plural: Plural) : Promise<{text?: string}[]> {
        let keyHistoryRaw = figma.root.getPluginData(this.keyHistoryPrefix + translationKeyName);
        let keyHistory = (keyHistoryRaw !== undefined && keyHistoryRaw !== '' ? JSON.parse(keyHistoryRaw) : []) as { [language in Language]? : {
            [plural in Plural]? : {
                text?: string
            }
        }}[];

        let specificHistory = [];
        
        let historyIndex = 0; 

        // filter relevant history changes for the given key
        for (let keyHistoryEntry of keyHistory) {
            if (keyHistoryEntry[language]?.[plural] !== undefined) {
                specificHistory.push(keyHistoryEntry[language]![plural]!);
            }
        }

        return specificHistory;
    }

    async persistKey(translationKey: TranslationKey): Promise<TranslationKey> {
        
        let keyHistoryRaw = figma.root.getPluginData(this.keyHistoryPrefix + translationKey.keyName);
        let keyHistory = (keyHistoryRaw !== undefined && keyHistoryRaw !== '' ? JSON.parse(keyHistoryRaw) : []);

        let keyCurrentVersionRaw = figma.root.getPluginData(this.keyPrefix + translationKey.keyName);
        let keyCurrentVersion = (keyCurrentVersionRaw !== undefined && keyCurrentVersionRaw !== '' ? JSON.parse(keyCurrentVersionRaw) : {
            keyName: translationKey.keyName,
            plurals: [],
            translations: {}
        }) as TranslationKey;

        let differences = {} as { [language in Language]? : {
            [plural in Plural]? : {
                text?: string,
                skip: boolean
            }
        }};

        let currentHistoryIndex = keyHistory.length;

        // find differences 
        for (let language of Object.keys(translationKey.translations)) {
            let currentLanguage = language as Language

            pluralLoop: 
            for (let plural of Object.keys(translationKey.translations[currentLanguage]!)) {
                let currentPlural = plural as Plural
                if (keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text === translationKey.translations[currentLanguage]![currentPlural]?.text && 
                    keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.skip === translationKey.translations[currentLanguage]![currentPlural]?.skip) {
                    console.log('text equal! ' + currentLanguage + ' ' + currentPlural + ' ' + keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text);
                    continue pluralLoop;
                }

                if (differences[currentLanguage] === undefined) {
                    differences[currentLanguage] = {
                        [currentPlural]: {
                            text: translationKey.translations[currentLanguage]![currentPlural]!.text,
                            skip: translationKey.translations[currentLanguage]![currentPlural]!.skip
                        }
                    }
                } else if (differences[currentLanguage]![currentPlural] === undefined) {
                    differences[currentLanguage]![currentPlural] = {
                            text: translationKey.translations[currentLanguage]![currentPlural]!.text,
                            skip: translationKey.translations[currentLanguage]![currentPlural]!.skip
                    }
                }

                translationKey.translations[currentLanguage]![currentPlural]!.version = currentHistoryIndex
            }
        }

        if (Object.keys(differences).length == 0) {
            // no differences found!
            return translationKey;
        }

        translationKey.latestVersion = currentHistoryIndex;

        keyHistory.push(differences);
        
        if (translationKey.keyName === undefined) {
            throw new Error('key name must be defined');
        }


        if (translationKey.keyName === 'undefined') {
            throw new Error('key name must not be "undefined"');
        }


        figma.root.setPluginData(this.keyPrefix + translationKey.keyName, JSON.stringify(translationKey));
        figma.root.setPluginData(this.keyHistoryPrefix + translationKey.keyName, JSON.stringify(keyHistory));

        return translationKey;
    }

    async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string; skip: boolean}[]): Promise<TranslationKey> {
        return await super.createKey(keyName, translations);
    }

    async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string; skip: boolean}[]): Promise<TranslationKey> {
        return await super.updateKey(keyName, translations);
    }

    async deleteKey(keyName: string): Promise<void> {
        figma.root.setPluginData(this.keyPrefix + keyName, '');
        figma.root.setPluginData(this.keyHistoryPrefix + keyName, '');
    }

    async load(): Promise<TranslationKeys> {
        let translationKeys = {} as TranslationKeys;
        for (let keyWithPrefix of figma.root.getPluginDataKeys()) {
            if (keyWithPrefix.startsWith(this.keyPrefix)) {
                let key = keyWithPrefix.substring(this.keyPrefix.length, keyWithPrefix.length);
                let keyData = figma.root.getPluginData(keyWithPrefix);
                if (keyData && keyData !== '') {
                    translationKeys[key] = this.getKey(key)!
                }
                
            }
        }
        return translationKeys;
    }

    async importFromLocalise(): Promise<void> {
        let result = await fetch('http://localhost:3333/api/v1/lokalise', {
          method: 'GET',
          /*headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          },*/ 
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
          
        })
        let lokaliseKeys = await result.json();

        let start = Date.now();
        
        let translationKeys = [] as TranslationKey[];

        for (let key of lokaliseKeys.keys) {
            let keyName = key.key_name['other'];
            let keyPlurals = [ Plural.Other ];

            let translations ={} as {
                [language in Language]? : {
                    [plural in Plural]? : {
                        version: number,
                        text?: string,
                        skip: boolean
                    } 
                }
            }
            for (let transalation of key.translations) {
                
                let lokaliseLanguage = transalation.language_iso as Language;

                let plurals = {} as {
                    [plural in Plural]? : {
                        version: number,
                        text?: string,
                        skip: boolean

                    } 
                }
                
                if (key.is_plural) {
                    let pluralsLokalise = JSON.parse(transalation.translation);
                    
                    for (let plural of Object.keys(pluralsLokalise)) {
                        plurals[plural as Plural] = {
                            version: -1,
                            text: pluralsLokalise[plural],
                            skip: false
                        };

                        if (keyPlurals.indexOf(plural as Plural) !== -1) {
                            keyPlurals.push(plural as Plural)
                        }
                    }
                } else {
                    console.log(transalation);
                    plurals[Plural.Other] = {
                        version: -1,
                        text: transalation.translation,
                        skip: false
                    };

                }

                translations[lokaliseLanguage] = plurals;
            }

            translationKeys.push({
                keyName: keyName,
                latestVersion: 0,
                plurals: keyPlurals,
                translations: translations
            })
        }

        console.log(`Execution time: Response processing: ${Date.now() - start} ms`);


        console.log(translationKeys.length + ' keys found ');

        for (let tanslationKey of translationKeys) {
            this.persistKey(tanslationKey);
        }
        console.log(`Execution time: persisting keys: ${Date.now() - start} ms`);
        
    }

}
