import { Message } from '../Message';
import { Locale } from '../variants/Locale';
import MessageLintRule, { MessageLintMatch } from './MessageLintRule';

export default class IdenticalPattern extends MessageLintRule {
  constructor() {
    super('IdenticalPattern');
  }

  /**
       *
       * @param message the message to check if the lintRule matches against
       * @returns if the lintrule matches
       */
  // eslint-disable-next-line class-methods-use-this
  matches(message: Message) {
    const refLocale = Locale.DE; // TODO replace hardcoded Locale with project locale
    const projectLocales = [Locale.DE, Locale.EN];

    const matches = [] as MessageLintMatch[];
    MessageLintRule.forEachVariant(message, refLocale, projectLocales, (locale, gender, plural) => {
      if (refLocale !== locale) {
        if (message.variants[refLocale]?.[gender]?.[plural]?.text === message.variants[locale]?.[gender]?.[plural]?.text) {
          matches.push({
            locale,
            gender,
            plural,
          });
        }
      }
    });
    return matches;
  }

  // fix(message: Message): Promise<void>;
  //  resolve: 
  //  - ignore
  //  - change text
}
