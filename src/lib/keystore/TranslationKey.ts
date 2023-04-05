import { Language } from '../base/Language';
import { Plural } from '../base/Plural';

export type HistoryEntry = {
  user: string,
  date: number,
  plural?: boolean,
  tags?: string[],
  translations?: {
    [language in Language]? : {
      [plural in Plural]? : {
        text?: string,
        // TODO verified
        skip?: boolean
      }
    }
  }
};

// base language changed: baseVersionID > translation id
// Each label stores the key + version of the translation > we need to know the latest version of each translation

// we need to know the latest version of the base transalation to know if a key needs to be checked
// a version needs an author (editor) and a method (manual/deepl/google translate)
// additional like qa done, tags should be stored separately?
//

export interface SerializableTranslationKey {
  keyName: string
  latestVersion: number,
  plural: boolean,
  tags: string[],
  translations: {
    [language in Language]? : {
      [plural in Plural]? : {
        version: number,
        text?: string,
        // TODO verified
        skip: boolean
      }
    }
  }
}

export interface TranslationKey extends SerializableTranslationKey {
  history: HistoryEntry[]
}

export interface TranslationKeys {
  [keyName: string]: TranslationKey
}
