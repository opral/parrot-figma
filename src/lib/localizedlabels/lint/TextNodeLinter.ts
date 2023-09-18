import BaseTextNodeLintRule from './rules/BaseTextNodeLintRule';
import MixedStyleNotSupported from './rules/MixedStyleNotSupported';
// eslint-disable-next-line import/no-named-as-default
import UnmatchingFontWeightNotSupported from './rules/UnmatchingFontWeightNotSupported';

export default class TextNodeLinter {
  defaultRules = [
    MixedStyleNotSupported.createRuleForField('openTypeFeatures'),
    MixedStyleNotSupported.createRuleForField('textCase'),
    MixedStyleNotSupported.createRuleForField('fontSize'),
    MixedStyleNotSupported.createRuleForField('letterSpacing'),
    MixedStyleNotSupported.createRuleForField('lineHeight'),
    MixedStyleNotSupported.createRuleForField('leadingTrim'),
    new UnmatchingFontWeightNotSupported(),
  ];

  registeredRules = {} as { [ruleName: string]: BaseTextNodeLintRule };

  constructor() {
    for (const defaultRule of this.defaultRules) {
      this.registerRule(defaultRule);
    }
  }

  registerRule(textNodeLintRule: BaseTextNodeLintRule) {
    this.registeredRules[textNodeLintRule.ruleName] = textNodeLintRule;
  }

  lint(textNode: TextNode) {
    const matchingRules = [];
    for (const rule of Object.values(this.registeredRules)) {
      if (rule.matches(textNode)) {
        matchingRules.push(rule.ruleName);
      }
    }
    return matchingRules;
  }

  fix(textNode: TextNode, ruleNames: string[]) {
    for (const ruleNameToFix of ruleNames) {
      this.registeredRules[ruleNameToFix].fix(textNode);
    }
  }
}

// TODO:

// TODO textStyleId ??
// TODO range fills -> only available via getRangeFills

// fontFamily source for bold/italic/regular
// -> check if family does not differ
// - fix find fontfamily that is used the most and replace all others
// -> check if clear mapping to bold/italic is possible
// - fix remove non clear mapping segments (replace with regular for now - later use project configs mapping)
// fontWeight - ignore for - taken care of by bold? but check if it only differs on bold/italic?

// indentation - mixed is ok
// -> check if only 0 and 1 are present
// -> check if 1 is only present within lists

// only known properties
// hyperlink - is ok
// textDecoration:
// -> check if only contains "NONE" | "UNDERLINE" | "STRIKETHROUGH"
// - fix: set unsupported to none

// listOptions
// -> check if only  undefined/ordered/unordered are present
// - fix: set unsupported to undefined
