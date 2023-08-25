import Quill from 'quill';

import { PlaceholderType } from '../../../../lib/message/Message';

interface PlaceholderValue {
  name: string,
  type: PlaceholderType,
  format?: string,
  argumentPosition?: number,
  unnamed: boolean,
  fillin: string,
}

const Inline = Quill.import('blots/inline');

export default class PlaceholderBlot extends Inline {
  static create(value: PlaceholderValue) {
    const node = super.create() as HTMLElement;
    node.setAttribute('type', value.type);
    if (value.format) {
      node.setAttribute('format', value.format);
    }

    if (value.argumentPosition) {
      node.setAttribute('arg', `${value.argumentPosition}`);
    }

    if (value.unnamed) {
      node.setAttribute('unnamed', '');
    }

    node.setAttribute('fillin', value.fillin);
    node.setAttribute('contenteditable', 'false');
    return node;
  }

  static value(node: HTMLElement): PlaceholderValue {
    return {
      name: node.innerText!,
      type: node.getAttribute('type')! as PlaceholderType,
      unnamed: node.getAttribute('unnamed') !== null,
      format: node.getAttribute('format') ?? undefined,
      fillin: node.getAttribute('fillin')!,
      argumentPosition: node.getAttribute('arg') ? parseInt(node.getAttribute('arg')!, 10) : undefined,
    };
  }

  static formats(domNode: HTMLElement) {
    return {
      type: domNode.getAttribute('type')!,
      unnamed: domNode.getAttribute('unnamed') !== null,
      format: domNode.getAttribute('format') ?? undefined,
      fillin: domNode.getAttribute('fillin')!,
      name: domNode.innerText!,
      argumentPosition: domNode.getAttribute('arg') ? parseInt(domNode.getAttribute('arg')!, 10) : undefined,
    };
  }
}
PlaceholderBlot.blotName = 'placeholder';
PlaceholderBlot.tagName = 'ph';

