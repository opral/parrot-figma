import { Plural } from '../base/Plural';

export type ImportTranslationKey = {
  keyName: string,
  plural: Plural;
  tags?: string[];
  text?: string;
};
