import BaseTextNodeLintRule from './BaseTextNodeLintRule';

// eslint-disable-next-line max-classes-per-file
export default class MixedStyleNotSupportedOpenTypeFace extends BaseTextNodeLintRule {
  styleField: string;

  constructor() {
    super('MixedStyleNotSupportedOpenTypeFace');
  }

  matches(textNode: TextNode) {
    if (textNode.getStyledTextSegments(['openTypeFeatures']).length > 1) {
      return true;
    }
    return false;
  }

  fix(textNode: TextNode): void {
    BaseTextNodeLintRule.fixWithMostProminent(textNode, this.styleField);
  }
}
