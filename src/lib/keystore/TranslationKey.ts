import { Language } from "../base/Language"
import { Plural } from "../base/Plural"

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

