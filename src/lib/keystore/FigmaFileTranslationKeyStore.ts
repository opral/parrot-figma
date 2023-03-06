import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { TranslationKey, TranslationKeys } from "./TranslationKey";
import { BaseTranslationKeyStore } from "./BaseTranslationKeyStore";


export class FigmaFileTranslationKeyStore extends BaseTranslationKeyStore {

    keyPrefix = 'aar_k__1';
    keyHistoryPrefix = 'aar_h__1';

    getKey(keyName: string): TranslationKey | undefined {

        let keyRaw = figma.root.getPluginData(this.keyPrefix + keyName);
        
        if (keyRaw === '' || !keyRaw) {
            return undefined;
        }
    
        console.log('---------------------------- keyName ---------------------');
        console.log(keyName)
        console.log(figma.root.getPluginData(this.keyPrefix + keyName));
        console.log(figma.root.getPluginData(this.keyHistoryPrefix + keyName));

        return JSON.parse(keyRaw) as TranslationKey;
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
                text?: string
            }
        }};

        let currentHistoryIndex = keyHistory.length;

        console.log('finding differences');
        console.log(translationKey);
        // find differences 
        for (let language of Object.keys(translationKey.translations)) {
            let currentLanguage = language as Language

            pluralLoop: 
            for (let plural of Object.keys(translationKey.translations[currentLanguage]!)) {
                let currentPlural = plural as Plural
                if (keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text === translationKey.translations[currentLanguage]![currentPlural]?.text) {
                    console.log('text equal! ' + currentLanguage + ' ' + currentPlural + ' ' + keyCurrentVersion.translations[currentLanguage]?.[currentPlural]?.text);
                    continue pluralLoop;
                }

                if (differences[currentLanguage] === undefined) {
                    differences[currentLanguage] = {
                        [currentPlural]: {
                            text: translationKey.translations[currentLanguage]![currentPlural]!.text
                        }
                    }
                } else if (differences[currentLanguage]![currentPlural] === undefined) {
                    differences[currentLanguage]![currentPlural] = {
                            text: translationKey.translations[currentLanguage]![currentPlural]!.text
                    }
                }

                translationKey.translations[currentLanguage]![currentPlural]!.version = currentHistoryIndex
            }
        }

        if (Object.keys(differences).length == 0) {
            // no differences found!
            return translationKey;
        }

        keyHistory.push(differences);
        
        figma.root.setPluginData(this.keyPrefix + translationKey.keyName, JSON.stringify(translationKey));
        figma.root.setPluginData(this.keyHistoryPrefix + translationKey.keyName, JSON.stringify(keyHistory));

        return translationKey;
    }

    async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string; }[]): Promise<TranslationKey> {
        return await super.createKey(keyName, translations);
    }

    async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string; }[]): Promise<TranslationKey> {
        return super.updateKey(keyName, translations);
    }

    async deleteKey(keyName: string): Promise<void> {
        figma.root.setPluginData(this.keyPrefix + keyName, '');
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

}
