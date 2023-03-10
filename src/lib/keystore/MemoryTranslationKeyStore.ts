import { Language } from "../base/Language";
import { Plural } from "../base/Plural";

import { LocalizedLabel } from "../localizedlabels/LocalizedLabel";
import { TranslationKey, TranslationKeys } from "./TranslationKey";
import { BaseTranslationKeyStore } from "./BaseTranslationKeyStore";


export interface TranslationKeyStore {
    createKey(keyName: string, translations: {language: Language, plural: Plural, text: string | undefined}[]) : Promise<TranslationKey>
    getKey(keyName: string) : TranslationKey | undefined
    updateKey(keyName: string, translations: {language: Language, plural: Plural, text: string | undefined}[]) : Promise<TranslationKey>
    deleteKey(keyName: string) : Promise<void>
    getHistory(translationKeyName: string, language: Language, plural: Plural) : Promise<{text?: string}[]>
    load(): Promise<TranslationKeys>
    fillPlaceholdersWithSampleData(text: string, language: Language, plural: Plural): string
    importFromLocalise() : Promise<void>
}

export class MemoryTranslationKeyStore extends BaseTranslationKeyStore {
    
    async getHistory(translationKeyName: string, language: Language, plural: Plural): Promise<{ text?: string | undefined; }[]> {
        return await this.parentKeyStore.getHistory(translationKeyName, language, plural)
    }

    parentKeyStore: TranslationKeyStore

    translationKeys: TranslationKeys = { }

    constructor(parentKeyStore: TranslationKeyStore) {
        super()
        this.parentKeyStore = parentKeyStore
    }

    getKey(keyName: string) : TranslationKey | undefined  {
        return this.translationKeys[keyName]
    }

    async createKey(keyName: string, translations: { language: Language; plural: Plural; text: string | undefined; }[]): Promise<TranslationKey> {
        if (keyName === '') {
            throw new Error('keys mus have at least one character')
        }
        let createdKey = await this.parentKeyStore.createKey(keyName, translations);
        return await this.persistKey(createdKey)
    }

    async updateKey(keyName: string, translations: {language: Language, plural: Plural, text: string | undefined}[]) {
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

    importFromLocalise(): Promise<void> {
        return this.parentKeyStore.importFromLocalise();
    }
    
}
