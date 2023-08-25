import { Plural } from '../message/variants/Plural';

export type ImportMessage = {
  name: string,
  plural: Plural;
  tags?: string[];
  text?: string;
};
