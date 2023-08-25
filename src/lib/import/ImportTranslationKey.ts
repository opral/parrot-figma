import { Plural } from '../message/variants/Plural';

export type ImportTranslationKey = {
  keyName: string,
  plural: Plural;
  tags?: string[];
  text?: string;
};
