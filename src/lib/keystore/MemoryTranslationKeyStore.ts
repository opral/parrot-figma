import { Language } from "../base/Language";
import { Plural } from "../base/Plural";
import { FigmaLocaliziationHelper } from "../figmalocalization/FigmaLocaliziationHelper"
import { LocalizedLabel } from "../base/LocalizedLabel";
import { TranslationKey, TranslationKeys } from "../base/TranslationKey";
import { BaseTranslationKeyStore } from "./BaseTranslationKeyStore";


export interface TranslationKeyStore {
    createKey(keyName: string, translations: {language: Language, plural: Plural, text: string}[]) : Promise<TranslationKey>
    getKey(keyName: string) : TranslationKey | undefined
    updateKey(keyName: string, translations: {language: Language, plural: Plural, text: string}[]) : Promise<TranslationKey>
    deleteKey(keyName: string) : Promise<void>
    load(): Promise<TranslationKeys>
    enrichLocalizationState(state: LocalizedLabel, language: Language): void
    fillPlaceholdersWithSampleData(text: string, language: Language, plural: Plural): string
}

export class MemoryTranslationKeyStore extends BaseTranslationKeyStore {

    parentKeyStore: TranslationKeyStore

    translationKeys: TranslationKeys = { }

    constructor(parentKeyStore: TranslationKeyStore) {
        super()
        this.parentKeyStore = parentKeyStore
    }

    getKey(keyName: string) : TranslationKey | undefined  {
        return this.translationKeys[keyName]
    }

    async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string; }[]): Promise<TranslationKey> {
        console.log('calling MemoryTranslationKeyStore createKey' )
        let createdKey = await this.parentKeyStore.createKey(keyName, translations);
        return await this.persistKey(createdKey)
    }

    async updateKey(keyName: string, translations: {language: Language, plural: Plural, text: string}[]) {
       let updatedKey = await this.parentKeyStore.updateKey(keyName, translations);
       return await this.persistKey(updatedKey)
    }

    async deleteKey(keyName: string) {
        await this.parentKeyStore.deleteKey(keyName);
        delete this.translationKeys[keyName];
    }

    async load(): Promise<TranslationKeys> {
        this.translationKeys = await this.parentKeyStore.load()
        return this.translationKeys
    }

    async persistKey(translationKey: TranslationKey): Promise<TranslationKey> {
        this.translationKeys[translationKey.keyName] = translationKey;
        return translationKey
    }

}
