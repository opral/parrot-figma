/* eslint-disable max-classes-per-file */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import OutsideClickHandler from 'react-outside-click-handler';
import './quill.bubble.css';

import Quill, {
  QuillOptionsStatic,
  DeltaStatic,
  RangeStatic,
  BoundsStatic,
  StringMap,
  Sources,
  Delta as DeltaType,
} from 'quill';
import Emitter from 'quill/core/emitter';
import { Fillins, PlaceholderType } from '../../../lib/keystore/TranslationKey';
import ParrotTheme from './quill/QuillTheme';
import ParrotToolbar from './quill/Toolbar';

const Delta = Quill.import('delta') as typeof DeltaType;
Quill.register('themes/parrot', ParrotTheme, true);
Quill.register('modules/toolbar', ParrotToolbar, false);

// https://stackoverflow.com/questions/50129438/creating-a-quill-js-theme
// const BubbleTheme = Quill.import('themes/bubble');
// console.log(BubbleTheme);

// parsing html:
// Assuming you have an instance of Quill initialized
// const quill = new Quill('#editor', {
//   theme: 'snow'
// });

// // Get the HTML content you want to insert
// const htmlContent = '<p>This is some <strong>HTML content</strong> to insert.</p>';

// // Insert the HTML content into the Quill editor
// quill.clipboard.dangerouslyPasteHTML(htmlContent);

const Inline = Quill.import('blots/inline');

class BoldBlot extends Inline { }
BoldBlot.blotName = 'bold';
BoldBlot.tagName = 'strong';

class ItalicBlot extends Inline { }
ItalicBlot.blotName = 'italic';
ItalicBlot.tagName = 'em';

class TextDecorationBlot extends Inline {
  static create(value: any) {
    if (value === 'UNDERLINE') {
      return document.createElement('u');
    }
    if (value === 'STRIKETHROUGH') {
      return document.createElement('s');
    }
    return super.create(value);
  }

  static formats(domNode: any) {
    if (domNode.tagName === 'U') return 'UNDERLINE';
    if (domNode.tagName === 'S') return 'STRIKETHROUGH';
    return undefined;
  }
}
TextDecorationBlot.blotName = 'textDecoration';
TextDecorationBlot.tagName = ['S', 'U'];

Quill.register(BoldBlot);
Quill.register(ItalicBlot);
Quill.register(TextDecorationBlot);

const icons = Quill.import('ui/icons');
icons.textDecoration = {
  UNDERLINE: icons.underline,
  STRIKETHROUGH: icons.strike,
};

class LinkBlot extends Inline {
  static create(value: string) {
    const node = super.create();
    // Sanitize url value if desired
    node.setAttribute('href', value);
    return node;
  }

  static formats(node: any) {
    // We will only be called with a node already
    // determined to be a Link blot, so we do
    // not need to check ourselves
    return node.getAttribute('href');
  }
}
LinkBlot.blotName = 'link';
LinkBlot.tagName = 'a';

Quill.register(LinkBlot);

interface PlaceholderValue {
  name: string,
  type: PlaceholderType,
  format?: string,
  argumentPosition?: number,
  unnamed: boolean,
  fillin: string,
}

class PlaceholderBlot extends Inline {
  static create(value: PlaceholderValue) {
    const node = super.create() as HTMLElement;
    node.setAttribute('type', value.type);
    value.format = 'test';
    if (value.format) {
      node.setAttribute('format', value.format);
    }

    value.argumentPosition = 10;
    if (value.argumentPosition) {
      node.setAttribute('arg', `${value.argumentPosition}`);
    }

    value.unnamed = true;
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

Quill.register(PlaceholderBlot);

const toolbarContainer = ['bold', 'italic', { textDecoration: 'UNDERLINE' }, { textDecoration: 'STRIKETHROUGH' }];

type QuillEditorProps = {
  value?: string,
  fillins: Fillins,
  onChange: Function,
  onFocus?: Function,
  onBlur?: Function,
};

export default function QuillEditor({
  value,
  fillins,
  onChange,
  onFocus,
  onBlur,
}: QuillEditorProps) {
  const editorPreRef = useRef<HTMLPreElement>(null);
  const [textState, setTextState, textStateRef] = useState(value);
  const [isEditing, setEditingState] = useState(false);

  const inputFieldRef = useRef<HTMLInputElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);
  const [quillEditor, setQuillEditor] = useState<Quill | undefined>(undefined);

  const onEditorChange = (
    eventName: 'text-change' | 'selection-change',
    rangeOrDelta: Range | DeltaStatic,
    oldRangeOrDelta: Range | DeltaStatic,
    source: Sources,
  ) => {
    if (eventName === 'text-change' && source !== 'silent') {
      setTextState(quillEditor!.root.innerHTML);
      const contents = quillEditor?.getContents();

      console.log('text-change---------------');

      const updatedFillins = { ...fillins };
      for (const op of contents!.ops!) {
        const placeholder = op.attributes?.placeholder;
        if (placeholder) {
          if (fillins[placeholder.name.trim()]?.value !== placeholder.fillin.trim()) {
            updatedFillins[placeholder.name.trim()] = { value: placeholder.fillin.trim() };
          }
        }
      }
      let cleanValue = quillEditor!.root.innerHTML;
      console.log('text-change-------RAW');
      console.log(cleanValue);
      cleanValue = cleanValue.split('</p>').join('\n').split('<p>').join('')
        .split('<br>')
        .join('');

      const regex = /.<span contenteditable="false">([^<]*)<\/span>./g;
      cleanValue = cleanValue.replace(/fillin="([^"])*" contenteditable="false">/g, '>');
      cleanValue = cleanValue.replace(regex, (match, group1) => group1);

      if (cleanValue[cleanValue.length - 1] === '\n') {
        cleanValue = cleanValue.substring(0, cleanValue.length - 1);
      }

      console.log('text-change-------CLEAN');
      console.log(cleanValue);
      onChange(cleanValue, updatedFillins);
    } else if (eventName === 'selection-change') {
      // nothing for now
    }
  };

  const handleOutsideClick = () => {
    //    doSave();
  };

  useEffect(() => {
    const keydownFunction = (e: any) => {
      if (e.key === 'Escape') {
        // onCancel();
      } if (e.key === 'Enter') {
      //  doSave();
      }
    };

    const focusInFunction = (e: any) => {
      setEditingState(true);
      if (onFocus) {
        onFocus();
      }
    };

    const focusOutFunction = (e: any) => {
      setEditingState(false);
      if (onBlur) {
        onBlur();
      }
    };

    const onClick = (e: any) => {
      console.log('clicked');
      console.log(e);
      if (e.target.nodeName === 'PH') {
        const range = document.createRange();
        range.selectNodeContents(e.target);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    };

    editorPreRef.current?.addEventListener('focusin', focusInFunction);
    editorPreRef.current?.addEventListener('focusout', focusOutFunction);

    editorPreRef.current?.addEventListener('keydown', keydownFunction);
    editorPreRef.current?.addEventListener('click', onClick);

    return () => {
      editorPreRef.current?.removeEventListener('focusin', focusInFunction);
      editorPreRef.current?.removeEventListener('focusout', focusOutFunction);

      editorPreRef.current?.removeEventListener('keydown', keydownFunction);
      editorPreRef.current?.removeEventListener('click', onClick);
    };
  }, [isEditing]);

  function updateQuill(quillEditorRef: Quill, updatedValue: string, fillins: Fillins) {
    if (quillEditorRef) {
      (quillEditorRef.clipboard as any).matchers[0][1] = function matchText(node: any, delta: any) {
        const text = node.data;
        return delta.insert(text);
      };
      console.log(`updateQuill:\n${updatedValue}`);
      const delta = (quillEditorRef.clipboard as any).convertHTML(updatedValue.split('\n').join('<br>'));

      for (const ops of delta.ops!) {
        const placeholderName = ops.attributes?.placeholder?.name;
        if (placeholderName) {
          ops.attributes.placeholder!.fillin = fillins[placeholderName]?.value ?? 'oh oh';
        }
      }

      quillEditorRef.setContents(delta, 'silent');
      // quillEditorRef?.clipboard.dangerouslyPasteHTML(updatedValue);

      // quillEditorRef.setSelection(0, 0, 'silent' as Sources);
    }
  }

  useEffect(() => {
    if (editorPreRef.current) {
      const editor = new Quill(editorPreRef.current, {
        theme: 'parrot',
        modules: {
          toolbar: {
            container: toolbarContainer,
            handlers: {
              placeholder(value: any) {
                // eslint-disable-next-line react/no-this-in-sfc
                this.quill.theme.tooltip.edit('placeholder');
              },
              link(value: any) {
                // console.log(this.quill.getFormat(this.quill.getSelection()!));
                if (false && !value) {
                  this.quill.format('link', false);
                } else {
                  this.quill.theme.tooltip.edit('link');
                }
              },
            },
          },
          keyboard: {
            bindings: {
              underline: {
                key: 'u',
                shortKey: true,
                handler(_range: any, context: any) {
                  const format = 'textDecoration';
                  // eslint-disable-next-line react/no-this-in-sfc
                  this.quill.format(format, context.format[format] === 'UNDERLINE' ? undefined : 'UNDERLINE', Emitter.sources.USER);
                },
              },
            },
          },
          clipboard: {
            matchers: [
              ['PH', function (node: HTMLElement, delta: any) {
                const fillin = node.getAttribute('fillin');
                const name = node.innerHTML;
                return delta.compose(new Delta().retain(delta.length(), { placeholder: { fillin, name } }));
              }],
              ['S', function (node: HTMLElement, delta: any) {
                return delta.compose(new Delta().retain(delta.length(), { textDecoration: 'STRIKETHROUGH' }));
              }],
              ['U', function (node: HTMLElement, delta: any) {
                return delta.compose(new Delta().retain(delta.length(), { textDecoration: 'UNDERLINE' }));
              }],
            ],
          },
        },
        readOnly: true,
      });
      editor.root.setAttribute('spellcheck', 'false');

      setQuillEditor(editor);

      updateQuill(editor, value ?? '', fillins);
      editor.enable();
    }
    return () => {
      quillEditor?.off('editor-change', onEditorChange);
    };
  }, [editorPreRef]);

  useEffect(() => {
    quillEditor?.on('editor-change', onEditorChange);
    return () => {
      quillEditor?.off('editor-change', onEditorChange);
    };
  }, [quillEditor]);

  useEffect(() => {
    if (!quillEditor || quillEditor?.hasFocus()) {
      return;
    }
    const cleanValue = value?.split('<p>').join('').split('</p>').join('');

    setTextState(cleanValue);

    updateQuill(quillEditor!, value ?? '', fillins);
  }, [value, fillins]);

  return (
    <OutsideClickHandler
      onOutsideClick={handleOutsideClick}
      disabled={!isEditing}
      display="contents"
    >

      <pre ref={editorPreRef} />
    </OutsideClickHandler>
  );
}
