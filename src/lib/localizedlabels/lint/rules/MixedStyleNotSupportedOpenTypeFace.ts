import BaseTextNodeLintRule from './BaseTextNodeLintRule';

// eslint-disable-next-line max-classes-per-file
export default class MixedStyleNotSupportedOpenTypeFace extends BaseTextNodeLintRule {
  styleField: string;

  constructor() {
    super('MixedStyleNotSupportedOpenTypeFace');
    this.styleField = 'openTypeFeatures';
  }

  // eslint-disable-next-line class-methods-use-this
  matches(textNode: TextNode) {
    // @ts-expect-error -- openTypeFeatures does not exist in current type def atm
    if (textNode.getStyledTextSegments(['openTypeFeatures']).length > 1) {
      return true;
    }
    return false;
  }

  fix(textNode: TextNode): void {
    BaseTextNodeLintRule.fixWithMostProminent(textNode, this.styleField);
  }
}
