import { Language } from "../base/Language"
import { Plural } from "../base/Plural"


// base language changed: baseVersionID > translation id
// Each label stores the key + version of the translation > we need to know the latest version of each translation

export interface TranslationKey {
    keyName: string

    plurals: Plural[],
    translations: {
        [language in Language]? : {
            [plural in Plural]? : {
                //version: number,
                text?: string
            } 
        }
    }
}

export interface TranslationKeys {
    [keyName: string]: TranslationKey
}

