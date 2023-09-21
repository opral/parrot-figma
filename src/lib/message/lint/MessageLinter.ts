import { Message } from "../Message";
import BaseMessageLintRule, { MessageLintMatch } from "./rules/BaseMessageLintRule";
import IdenticalPattern from "./rules/IdenticalPattern";
import MachineTranslation from "./rules/MachineTranslation";
import MissingRefVariant from "./rules/MissingRefVariant";
import MissingReview from "./rules/MissingReview";
import MissingTargetVariant from "./rules/MissingTargetVariant";
import { Gender, genderList } from "../variants/Gender";
import { Plural } from "../variants/Plural";
import { Locale } from "../variants/Locale";

export default class MessageLinter {
  defaultRules = [
    new IdenticalPattern(),
    new MachineTranslation(),
    new MissingRefVariant(),
    new MissingReview(),
    new MissingTargetVariant(),
  ] as BaseMessageLintRule[];

  registeredRules = {} as { [ruleName: string]: BaseMessageLintRule };

  constructor() {
    for (const defaultRule of this.defaultRules) {
      this.registerRule(defaultRule);
    }
  }

  registerRule(textNodeLintRule: BaseMessageLintRule) {
    this.registeredRules[textNodeLintRule.ruleName] = textNodeLintRule;
  }

  lint(messaage: Message, refLocale: Locale, projectLocales: Locale[]) {
    let matchingRules = []  as MessageLintMatch[];
    for (const rule of Object.values(this.registeredRules)) {
      const messageMatches = [] as MessageLintMatch[];
      this.forEachVariant(messaage, refLocale, projectLocales, (locale, gender, plural) => {
        const match = rule.matches(messaage, locale, gender, plural, refLocale, messageMatches);
        if (match) {
          messageMatches.push(match);
        }
      })

      matchingRules = matchingRules.concat(messageMatches);
    }
    return matchingRules;
  }

  private forEachVariant(message: Message, refLocale: Locale, projectLocales: Locale[], variant: (locale: Locale, gender: Gender, plural: Plural, message: Message) => void) {

    // iterate through all Locales
    for (const locale of projectLocales) {
      const genders = !message.gender ? [Gender.NEUTRAL] : genderList;
      for (const gender of genders) {
        const plurals = message.plural && message.variants[refLocale] !== undefined ? Object.keys(message.variants[refLocale]![gender]!) : [Plural.OTHER];
        for (const plural of plurals) {
          variant(locale, gender, plural as Plural, message);
        }
      }
    }
  }

}

// Missing Review - 
 
// Outdated translation - the message variant has not changed after the reference has updated
//  -> hash(ref variant) != targetVariant.sourceHash

 