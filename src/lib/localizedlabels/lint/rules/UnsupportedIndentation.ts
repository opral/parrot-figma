import BaseTextNodeLintRule from "./BaseTextNodeLintRule";

// eslint-disable-next-line max-classes-per-file
export default class UnsupportedIndentation extends BaseTextNodeLintRule {
  constructor() {
    super('UnsupportedIndentation');
  }

  // eslint-disable-next-line class-methods-use-this
  matches(textNode: TextNode): boolean {
    const indentations = textNode.getRangeIndentation(0, textNode.characters.length);
    if (indentations !== figma.mixed) {
      return false;
    }

    const styleSegments = textNode.getStyledTextSegments(['indentation', 'listOptions']);
    for (const styleSegment of styleSegments) {
      if (styleSegment.indentation !== 0 && styleSegment.listOptions.type === 'NONE') {
        return true;
      }
      if (styleSegment.indentation > 1) {
        return true;
      }
    }
    return false;
  }

  // eslint-disable-next-line class-methods-use-this
  fix(textNode: TextNode): void {
    const styleSegments = textNode.getStyledTextSegments(['indentation', 'listOptions']);
    for (const styleSegment of styleSegments) {
      // -> check if !=0 is only present within lists
      if (styleSegment.indentation !== 0 && styleSegment.listOptions.type === 'NONE') {
        textNode.setRangeIndentation(styleSegment.start, styleSegment.end, 0);
      }
      // -> check if only 0 and 1 are present
      if (styleSegment.indentation > 1) {
        textNode.setRangeIndentation(styleSegment.start, styleSegment.end, 1);
      }
    }
  }
}
