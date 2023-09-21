import { Message } from '../Message';
import { Gender, genderList } from '../variants/Gender';
import { Locale } from '../variants/Locale';
import { Plural } from '../variants/Plural';

export interface MessageLintMatch {
  ruleName: string,
  locale: Locale,
  plural: Plural,
  gender: Gender,
}

export default abstract class MessageLintRule {
  ruleName: string;

  constructor(ruleName: string) {
    this.ruleName = ruleName;
  }

  /**
    *
    * @param message the message to check if the lintRule matches against
    * @returns if the lintrule matches
  */
  abstract matches(message: Message, locale: Locale, gender: Gender, plural: Plural, refLang: Locale): MessageLintMatch | undefined;

  // abstract fix(message: Message): Promise<void>;
}
