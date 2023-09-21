import { Message } from '../../Message';
import { Gender } from '../../variants/Gender';
import { Plural } from '../../variants/Plural';
import { Locale } from '../../variants/Locale';
import BaseMessageLintRule, { MessageLintMatch } from './BaseMessageLintRule';

export default class MissingRefVariant extends BaseMessageLintRule {
  constructor() {
    super('MissingRefVariant');
  }

  /**
       *
       * @param message the message to check if the lintRule matches against
       * @returns if the lintrule matches
       */
  // eslint-disable-next-line class-methods-use-this
  matches(message: Message, locale: Locale, gender: Gender, plural: Plural, refLocale: Locale, previousMatches: MessageLintMatch[]) {
    if (refLocale !== locale) {
      if (message.variants[refLocale]?.[gender]?.[plural]?.text === undefined
        && message.variants[refLocale]?.[gender]?.[plural]?.skip) {
        if (!previousMatches.find((existingMatch) => existingMatch.gender === gender && existingMatch.plural === plural)) {
          return {
            ruleName: this.ruleName,
            locale: refLocale,
            gender,
            plural,
          };
        }
      }
    }
    return undefined;
  }

  // fix(message: Message): Promise<void>;
  // resolve:
  //    - delete
  //    - disable (variant not needed in language)
  //    -
}
