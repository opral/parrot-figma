/* eslint-disable no-plusplus */
import { Locale } from './variants/Locale';
import { Plural, getPluralFormsByLanguage } from './variants/Plural';

export interface MessageStoreUI {
  getBaseLanugage(): Locale | undefined
}

