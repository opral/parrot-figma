import { Message } from '../Message';
import { Gender } from '../variants/Gender';
import { Plural } from '../variants/Plural';
import { Locale } from '../variants/Locale';
import MessageLintRule, { MessageLintMatch } from './MessageLintRule';

export default class MissingReview extends MessageLintRule {
  constructor() {
    super('MissingReview');
  }

  /**
       *
       * @param message the message to check if the lintRule matches against
       * @returns if the lintrule matches
       */
  // eslint-disable-next-line class-methods-use-this
  matches(message: Message, locale: Locale, gender: Gender, plural: Plural, refLocale: Locale) {
    // TODO as soon as src is established
    // if (refLocale !== locale) {
    // reviewed will be a flag that is not stored but calculated on applicaiton meta data
    //   if (message.variants[locale]?.[gender]?.[plural]?.reviewed === false) {
    //     return {
    //       ruleName: this.ruleName,
    //       locale,
    //       gender,
    //       plural,
    //     };
    //   }
    // }
    return undefined;
  }

  // fix(message: Message): Promise<void>;
  //  resolve:
  //  - ignore
  //  - change text
}
