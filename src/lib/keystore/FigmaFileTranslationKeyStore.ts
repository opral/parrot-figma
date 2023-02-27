import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { TranslationKey, TranslationKeys } from "./TranslationKey";
import { BaseTranslationKeyStore } from "./BaseTranslationKeyStore";


export class FigmaFileTranslationKeyStore extends BaseTranslationKeyStore {

    keyPrefix = 'aar_k__';

    getKey(keyName: string): TranslationKey | undefined {

        let keyRaw = figma.root.getPluginData(this.keyPrefix + keyName);
        
        if (keyRaw === '' || !keyRaw) {
            return undefined;
        }
        return JSON.parse(keyRaw) as TranslationKey;
    }

    async persistKey(translationKey: TranslationKey): Promise<TranslationKey> {
        console.log('File - persistKey called')
        figma.root.setPluginData(this.keyPrefix + translationKey.keyName, JSON.stringify(translationKey));

        let keyRaw = figma.root.getPluginData(this.keyPrefix + translationKey.keyName);

        console.log('File - persistKey called set to:' + keyRaw)
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
                    translationKeys[key] = JSON.parse(keyData);
                }
                
            }
        }
        return translationKeys;
    }

}
