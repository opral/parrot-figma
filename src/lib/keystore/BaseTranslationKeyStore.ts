/* eslint-disable consistent-return */
import { Language } from '../base/Language';
import { Plural } from '../base/Plural';
import { HistoryEntry, TranslationKey, TranslationKeys } from './TranslationKey';

export interface TranslationKeyStore {
  createKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[], plural: boolean) : Promise<TranslationKey>
  getKey(keyName: string) : TranslationKey | undefined
  updateKey(keyName: string, translations: { language: Language, plural: Plural, text: string | undefined, skip: boolean }[], plural?: boolean) : Promise<TranslationKey>
  deleteKey(keyName: string) : Promise<void>
  load(): Promise<TranslationKeys>
}
