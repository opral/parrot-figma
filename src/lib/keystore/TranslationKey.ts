import { Language } from "../base/Language"
import { Plural } from "../base/Plural"


// base language changed: baseVersionID > translation id
// Each label stores the key + version of the translation > we need to know the latest version of each translation

// we need to know the latest version of the base transalation to know if a key needs to be checked
// a version needs an author (editor) and a method (manual/deepl/google translate) 
// additional like qa done, tags should be stored separately? 
//

export interface TranslationKey {
    keyName: string
    latestVersion: number, 
    plurals: Plural[],
    translations: {
        [language in Language]? : {
            [plural in Plural]? : {
                version: number,
                text?: string,
                skip: boolean 
            } 
        }
    }
}

export interface TranslationKeys {
    [keyName: string]: TranslationKey
}

