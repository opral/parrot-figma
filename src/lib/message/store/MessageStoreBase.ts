/* eslint-disable consistent-return */
import { Locale } from '../variants/Locale';
import { Plural } from '../variants/Plural';
import { Message } from '../Message';

export interface MessageStore {
  createKey(keyName: string, translations: { language: Locale, plural: Plural, text: string | undefined, skip: boolean }[], plural: boolean) : Promise<Message>
  getKey(keyName: string) : Message | undefined
  updateKey(keyName: string, translations: { language: Locale, plural: Plural, text: string | undefined, skip: boolean }[], plural?: boolean) : Promise<Message>
  deleteKey(keyName: string) : Promise<void>
}
