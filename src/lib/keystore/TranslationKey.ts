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
        baseLangHash?: string,
        verified: boolean,
        skip?: boolean
      }
    }
  }
};

export type HistoryEntry = {
  user: string,
  date: number,
  name?: string,
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

export enum PlaceholderType {
  string = 's',
  float = 'f',
  integer = 'd',
}

export interface Placeholder {
  name: string, // name of the placeholder - always preferred to have one but optional as some imports do not provide this
  named: boolean, // false if no name provided
  type: PlaceholderType, // s: string | f: float | d: decimal
  decimalPlaces: undefined | number, // in case of type float this gives the number of decimal places after the .
  specifiedArgumentPosition: undefined | number, // if defined the position to provide the argument at when using printf for example
  derivedArgumentPosition: undefined | number, // the argument position derived by analyzing all translations
  parameterNumber: number // the 0-based position the parameter apeared. in a string like "Hello [[first_name]] [[last_name]]" first_name would get 0, last_name would get 1.

  // the argumentPosition is fixed by the first apearance - this can lead to conflicts like same parameter has different arumentPostions set or multiple placeholders block the same position
  // in such cases it will be ignored
  positionSpecifiedByLanguage?: Language,
  positionSpecifiedInPlural?: Plural,

  positionInString: number,
  length: number,
}

export interface PlaceholdersByName {
  [placeholderName: string] : Placeholder
}

export interface Fillins {
  [placeholderName: string]: { value: string | number, default?: boolean }
}

export type Translations = {
  [language in Language]? : {
    [plural in Plural]? : {
      version: number,
      text?: string,
      verified: boolean,
      skip: boolean
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
  id: string,
  keyName: string,
  latestVersion: number,
  historyTags: {
    // map a tag identifier (we use a number for size reasons) to a version index of a key
    [tagIndex: number]: number,
  },
  labels: string[],
  referencingTextNodes: string[],
  plural: boolean,
  translations: Translations,
  quantity: { value: number } | { placeholder: string },
  placeholders: PlaceholdersByName,
  defaultFillins: Fillins
}

export interface TranslationKey extends SerializableTranslationKey {
  history: HistoryEntry[]
}

export interface TranslationKeys {
  [keyName: string]: TranslationKey
}
