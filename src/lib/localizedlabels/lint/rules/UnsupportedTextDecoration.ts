import BaseTextNodeLintRule from './BaseTextNodeLintRule';

// eslint-disable-next-line max-classes-per-file
export default class UnsupportedTextDecoration extends BaseTextNodeLintRule {
  constructor() {
    super('UnsupportedTextDecoration');
  }

  // eslint-disable-next-line class-methods-use-this
  matches(textNode: TextNode): boolean {
    if (textNode.characters.length === 0) {
      return false;
    }
    
    if (textNode.textDecoration !== figma.mixed) {
      return false;
    }

    const styleSegments = textNode.getStyledTextSegments(['textDecoration']);
    for (const styleSegment of styleSegments) {
      if (styleSegment.textDecoration !== 'NONE'
        && styleSegment.textDecoration !== 'STRIKETHROUGH'
        && styleSegment.textDecoration !== 'UNDERLINE') {
        return true;
      }
    }
    return false;
  }

  // eslint-disable-next-line class-methods-use-this
  fix(textNode: TextNode): void {
    const styleSegments = textNode.getStyledTextSegments(['textDecoration']);
    for (const styleSegment of styleSegments) {
      // change unsupported listoptions type to none
      if (styleSegment.textDecoration !== 'NONE'
      && styleSegment.textDecoration !== 'STRIKETHROUGH'
      && styleSegment.textDecoration !== 'UNDERLINE') {
        textNode.setRangeTextDecoration(styleSegment.start, styleSegment.end, 'NONE');
      }
    }
  }
}
