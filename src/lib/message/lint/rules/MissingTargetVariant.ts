import { Message } from '../../Message';
import { Gender } from '../../variants/Gender';
import { Locale } from '../../variants/Locale';
import { Plural } from '../../variants/Plural';
import BaseMessageLintRule from './BaseMessageLintRule';

export default class MissingTargetVariant extends BaseMessageLintRule {
  constructor() {
    super('MissingTargetVariant');
  }

  /**
       *
       * @param message the message to check if the lintRule matches against
       * @returns if the lintrule matches
       */
  // eslint-disable-next-line class-methods-use-this
  matches(message: Message, locale: Locale, gender: Gender, plural: Plural, refLocale: Locale) {
    if (refLocale !== locale) {
      if (message.variants[locale]?.[gender]?.[plural]?.text === undefined
        && !message.variants[locale]?.[gender]?.[plural]?.skip) {
        return {
          ruleName: this.ruleName,
          locale,
          gender,
          plural,
        };
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
