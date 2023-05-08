import { Language } from '../base/Language';
import { Plural } from '../base/Plural';

export type HistoryTag = {
  user: string,
  date: number,
  title: string,
  description?: string,
  versionId?: string,
};

export type TranslationEntry = {
  plural: boolean,
  translations?: {
    [language in Language]? : {
      [plural in Plural]? : {
        text?: string,
        verified: boolean,
        skip?: boolean
      }
    }
  }
};

export type HistoryEntry = {
  user: string,
  date: number,
  plural?: boolean,
  labels?: string[],
  translations?: {
    [language in Language]? : {
      [plural in Plural]? : {
        text?: string,
        verified?: boolean,
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
  historyTags: {
    // map a tag identifier (we use a number for size reasons) to a version index of a key
    [tagIndex: number]: number,
  },
  plural: boolean,
  labels: string[],
  translations: {
    [language in Language]? : {
      [plural in Plural]? : {
        version: number,
        text?: string,
        verified: boolean,
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
