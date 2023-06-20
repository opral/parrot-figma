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
import { Fillins, PlaceholderType } from '../../../lib/keystore/TranslationKey';
import ParrotTheme from './QuillTheme';

const Delta = Quill.import('delta') as typeof DeltaType;
Quill.register('themes/parrot', ParrotTheme, true);

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

Quill.register(BoldBlot);
Quill.register(ItalicBlot);

class LinkBlot extends Inline {
  static create(value: string) {
    const node = super.create();
    // Sanitize url value if desired
    node.setAttribute('href', value);
    // Okay to set other non-format related attributes
    // These are invisible to Parchment so must be static
    node.setAttribute('target', '_blank');
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

const BlockEmbed = Quill.import('blots/block');

interface PlaceholderValue {
  name: string,
  type: PlaceholderType,
  fillin: string,
}

class PlaceholderBlot extends Inline {
  static create(value: PlaceholderValue) {
    const node = super.create() as HTMLElement;
    node.setAttribute('type', value.type);
    node.setAttribute('fillin', value.fillin);
    node.setAttribute('contenteditable', 'false');
    return node;
  }

  static value(node: HTMLElement): PlaceholderValue {
    return {
      name: node.innerText!,
      type: node.getAttribute('type')! as PlaceholderType,
      fillin: node.getAttribute('fillin')!,
    };
  }

  static formats(domNode: HTMLElement) {
    return {
      type: domNode.getAttribute('type')!,
      fillin: domNode.getAttribute('fillin')!,
      name: domNode.innerText!,
    };
  }

}

PlaceholderBlot.blotName = 'placeholder';
PlaceholderBlot.tagName = 'ph';

Quill.register(PlaceholderBlot);

const toolbarContainer = ['bold', 'italic', 'link', 'placeholder'];

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
  const editorDivRef = useRef<HTMLDivElement>(null);
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

      const updatedFillins = { ...fillins };
      for (const op of contents!.ops!) {
        const placeholder = op.attributes?.placeholder;
        if (placeholder) {
          if (fillins[placeholder.name.trim()]?.value !== placeholder.fillin.trim()) {
            updatedFillins[placeholder.name.trim()] = { value: placeholder.fillin.trim() };
          }
        }
      }

      let cleanValue = quillEditor!.root.innerHTML.split('<p>').join('').split('</p>').join('');

      const regex = /.<span contenteditable="false">([^<]*)<\/span>./g;
      cleanValue = cleanValue.replace(regex, (match, group1) => group1);

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

    editorDivRef.current?.addEventListener('focusin', focusInFunction);
    editorDivRef.current?.addEventListener('focusout', focusOutFunction);

    editorDivRef.current?.addEventListener('keydown', keydownFunction);

    return () => {
      editorDivRef.current?.removeEventListener('focusin', focusInFunction);
      editorDivRef.current?.removeEventListener('focusout', focusOutFunction);

      editorDivRef.current?.removeEventListener('keydown', keydownFunction);
    };
  }, [isEditing]);

  function updateQuill(quillEditorRef: Quill, updatedValue: string, fillins: Fillins) {
    console.log('value was set from outside');
    if (quillEditorRef) {
      console.log(`updating quil${updatedValue}`);

      /* const delta = (quillEditorRef.clipboard as any).convert({ html: updatedValue });

      console.log('OPERATIONS:');
      for (const ops of delta.ops!) {
        const placeholderName = ops.insert?.placeholder?.name;
        if (placeholderName) {
        //   ops.insert!.placeholder!.fillin = fillins[placeholderName]?.value ?? 'oh oh';
        }
      }

      quillEditorRef.setContents(delta); */
      quillEditorRef?.clipboard.dangerouslyPasteHTML(updatedValue);

      // quillEditorRef.setSelection(0, 0, 'silent' as Sources);
    }
  }

  useEffect(() => {
    if (editorDivRef.current) {
      console.log('creating editor');
      const editor = new Quill(editorDivRef.current, {
        theme: 'parrot',
        modules: {
          toolbar: {
            container: toolbarContainer,
            handlers: {
              placeholder(value: any) {
                // eslint-disable-next-line react/no-this-in-sfc
                this.quill.theme.tooltip.edit('placeholder');
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

            ],
          },
        },
        readOnly: true,
      });

      setQuillEditor(editor);

      updateQuill(editor, value ?? '', fillins);
      editor.enable();
    }
    return () => {
      quillEditor?.off('editor-change', onEditorChange);
    };
  }, [editorDivRef]);

  useEffect(() => {
    console.log('setting events on editor');
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
  }, [value]);

  return (
    <OutsideClickHandler
      onOutsideClick={handleOutsideClick}
      disabled={!isEditing}
      display="contents"
    >

      <div ref={editorDivRef} />
    </OutsideClickHandler>
  );
}
