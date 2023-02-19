import { Language } from "./Language"
import { Plural } from "./Plural"

export interface TranslationKey {
    keyName: string

    plurals: Plural[],
    translations: {
        [language in Language]? : {
            [plural in Plural]? : {
                text?: string
            } 
        }
    }
}

export interface TranslationKeys {
    [keyName: string]: TranslationKey
}

