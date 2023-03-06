import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { LocalizedLabel } from "../localizedlabels/LocalizedLabel";
import { TranslationKey, TranslationKeys } from "./TranslationKey";
import { TranslationKeyStore } from "./MemoryTranslationKeyStore";

export abstract class BaseTranslationKeyStore implements TranslationKeyStore {

    async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string; }[]): Promise<TranslationKey> {
        let existingKey = this.getKey(keyName);
        if (existingKey) {
            throw Error("tried to create a key that already existed");
        }

        let plurals = [] as Plural[];

        let translationsObj = {} as any;
        for (let translation of translations) {
            if (!translationsObj[translation.language]) {
                translationsObj[translation.language] = {};
            }

            if (!translationsObj[translation.language][translation.plural]) {
                translationsObj[translation.language][translation.plural] = {};
            }

            translationsObj[translation.language][translation.plural].text = translation.text;

            if (plurals.indexOf(translation.plural) === -1) {
                plurals.push(translation.plural);
            }
        }

        let createdKey = {
            keyName: keyName,
            tags: [],
            plurals: plurals,
            translations: translationsObj
        } as TranslationKey;
        return await this.persistKey(createdKey);
    }


    async updateKey(keyName: string, translations: { language: Language; plural: Plural; text: string; }[]) {
        let keyToUpdate = this.getKey(keyName);

        if (keyToUpdate === undefined) {
            throw "Key [" + keyName + "] not found!";
        }

        for (let translation of translations) {
            if (!keyToUpdate.translations[translation.language]) {
                keyToUpdate.translations[translation.language] = { 'other': {
                    version: -1
                } };
            }

            if (!keyToUpdate.translations[translation.language]![translation.plural]) {
                keyToUpdate.translations[translation.language]![translation.plural] = {
                    version: keyToUpdate.translations[translation.language]!['other']!.version
                };
            }

            keyToUpdate.translations[translation.language]![translation.plural]!.version = keyToUpdate.translations[translation.language]![translation.plural]!.version + 1;
            keyToUpdate.translations[translation.language]![translation.plural]!.text = translation.text;

            if (keyToUpdate.plurals.indexOf(translation.plural as Plural) === -1) {
                keyToUpdate.plurals.push(translation.plural as Plural);
            }
        }
        return await this.persistKey(keyToUpdate);
    }

    abstract getKey(keyName: string): TranslationKey | undefined;

    abstract deleteKey(keyName: string): Promise<void>;

    abstract load(): Promise<TranslationKeys>;

    abstract persistKey(translationKey: TranslationKey): Promise<TranslationKey>;

    fillPlaceholdersWithSampleData(text: string, language: Language, plural: Plural) {

        const placeholders = new RegExp(`\\[%(s|n|i):(\\w+)\\]`, "g");
        return text.replace(placeholders, (substring, type, key) => {

            // exact match
            let matchingTranslation = this.getKey('sample_values__' + type + ':' + key);
            
            // name match in samples
            if (matchingTranslation === undefined) {
                matchingTranslation = this.getKey('sample_values__' + key);
            }

            // key match
            if (!matchingTranslation === undefined)  {
                matchingTranslation = this.getKey(key);
            }

            if (!matchingTranslation === undefined) {
                return substring
            }
        
            // exact language/plural match
            let matchingLangugae = matchingTranslation!.translations[language]?.[plural]?.text;
            if (matchingLangugae !== undefined) {
                return  matchingLangugae
            }

            let baseLanguage = Object.keys(matchingTranslation!.translations)[0]! as Language;
            if (matchingTranslation!.translations[baseLanguage]![plural]?.text !== undefined) {
                return matchingTranslation!.translations[baseLanguage]![plural]!.text!
            } else if (matchingTranslation!.translations[baseLanguage]![Plural.Other]?.text !== undefined) {
                return matchingTranslation!.translations[baseLanguage]![Plural.Other]?.text! 
            }
        
            // not found
            return substring;

        });
    }

}
