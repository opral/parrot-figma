import BaseTextNodeLintRule from './BaseTextNodeLintRule';

// eslint-disable-next-line max-classes-per-file
export default class FontWeightNotSupported extends BaseTextNodeLintRule {
  styleField: string;

  constructor() {
    super('FontWeightNotSupported');
    this.styleField = 'fontWeight';
  }

  // eslint-disable-next-line class-methods-use-this
  matches(textNode: TextNode): boolean {
    console.log(JSON.stringify(textNode.fontName));
    console.log(JSON.stringify(textNode.fontWeight));
    return false; // (textNode as any)[this.styleField] === figma.mixed;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars, class-methods-use-this
  fix(textNode: TextNode): void {
    // BaseTextNodeLintRule.fixWithMostProminent(textNode, this.styleField);
  }
}
