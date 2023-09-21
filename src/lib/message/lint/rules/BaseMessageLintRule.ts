import { Message } from '../../Message';
import { Gender } from '../../variants/Gender';
import { Plural } from '../../variants/Plural';
import { Locale } from '../../variants/Locale';

export interface MessageLintMatch {
  ruleName: string,
  locale: Locale,
  plural: Plural,
  gender: Gender,
}

export default abstract class BaseMessageLintRule {
  ruleName: string;

  constructor(ruleName: string) {
    this.ruleName = ruleName;
  }

  /**
    *
    * @param message the message to check if the lintRule matches against
    * @returns if the lintrule matches
  */
  abstract matches(message: Message, locale: Locale, gender: Gender, plural: Plural, refLang: Locale, previousMatches: MessageLintMatch[]): MessageLintMatch | undefined;

  // abstract fix(message: Message): Promise<void>;
}
