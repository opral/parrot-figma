import Quill from 'quill';
import { ParameterType, Placeholder } from '../../../../lib/message/MessageExtnesions';

const Inline = Quill.import('blots/inline');

export default class PlaceholderBlot extends Inline {
  static create(value: Placeholder) {
    const node = super.create() as HTMLElement;
    if (value.formatFunctionName) {
      node.setAttribute('formatFn', value.formatFunctionName);
    }

    if (value.specifiedArgumentPosition) {
      node.setAttribute('arg', `${value.specifiedArgumentPosition}`);
    }
    
    if (value.named === false) {
      node.setAttribute('unnamed', '');
    }

    // TODO #19 variables add formatOptions as namespaced attributes

    node.setAttribute('contenteditable', 'false');
    return node;
  }

  static value(node: HTMLElement): Placeholder {
    return {
      name: node.innerText!,
      named: node.getAttribute('unnamed') === null,
      formatFunctionName: node.getAttribute('format') ?? undefined,
      specifiedArgumentPosition: node.getAttribute('arg') ? parseInt(node.getAttribute('arg')!, 10) : undefined,
      // TODO #19 variables handle options as attributes with option- prefix
    };
  }

  static formats(domNode: HTMLElement): Placeholder {
    return {
      name: domNode.innerText!,
      named: domNode.getAttribute('unnamed') === null,
      specifiedArgumentPosition: domNode.getAttribute('arg') ? parseInt(domNode.getAttribute('arg')!, 10) : undefined,
      formatFunctionName: domNode.getAttribute('formatFn') ?? undefined,
      // TODO #19 variables handle options as attributes with option- prefix
    };
  }

  static extractPlaceholdersFromPatterHTML(text: string): { start: number, length: number, placeholder: Placeholder }[] {
    // <ph type="s" format=".3" arg="" unnamed >unnamed_arg</ph>
    const pattern = /<ph([^>])*>([^<]*)<\/ph>/g;

    const patternGroups = {
      attributes: 1,
      name: 2,
    };
    // type -> 2
    // format -> 4
    // arg -> 6
    // unnamed -> 7
    // name -> -> 10
    // name, argumentPosition, unnamed, decimalplaces
    //

    const placeholderMatches = [] as { start: number, length: number, placeholder: Placeholder }[];

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = pattern.exec(text)) !== null) {
      const placeholder = this.extractFromRawHtml(match[patternGroups.name], match[patternGroups.attributes]);

      placeholderMatches.push({
        start: match.index,
        length: match[0].length,
        placeholder,
      });
    }

    return placeholderMatches;
  }

  /// accespts an attributes strig
  static extractFromRawHtml(name: string, attributeString: string) {
    const attributeRegex = /(\w+)(?:="([^"]*)")?|(\w+)(?=\s|$)/g;
    const attributes = {} as any;
    const optionsPrefix = 'options-';
    let options: any | undefined;

    let match;
    // eslint-disable-next-line no-cond-assign
    while ((match = attributeRegex.exec(attributeString)) !== null) {
      const [, attrWithVal, value, attrWithoutVal] = match;
      const attributeName = attrWithVal || attrWithoutVal;

      if (value !== undefined && attributeName.startsWith(optionsPrefix)) {
        if (options === undefined) {
          options = {};
        }
        options[attributeName.substring(optionsPrefix.length)] = value!;
      } else {
        // If the attribute has a value, use it; otherwise, set it to true
        attributes[attributeName] = value !== undefined ? value : true;
      }
    }

    const foundPlaceholder = {
      name,
      named: attributes.unnamed !== undefined,
      specifiedArgumentPosition: attributes.arg !== undefined ? parseInt(attributes.arg, 10) : undefined,
      formatFunctionName: attributes.formatFn,
      options,
    } as Placeholder;

    // TODO #19 variables - extract all atributes from the attributes like options
    return foundPlaceholder;
  }
}
PlaceholderBlot.blotName = 'placeholder';
PlaceholderBlot.tagName = 'ph';
