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
  DeltaStatic,
  Sources,
  Delta as DeltaType,
} from 'quill';

import Emitter from 'quill/core/emitter';
import { Fillins, PlaceholderType } from '../../../lib/message/TranslationKey';
import ParrotTheme from './quill/QuillTheme';
import ParrotToolbar from './quill/Toolbar';
import PlaceholderBlot from './blots/PlaceholderBlot';
import BoldBlot from './blots/BoldBlot';
import ItalicBlot from './blots/ItalicBlot';
import LinkBlot from './blots/LinkBlot';
import TextDecorationBlot from './blots/TextDecorationBlot';

Quill.register(LinkBlot);
Quill.register(ItalicBlot);
Quill.register(BoldBlot);
Quill.register(PlaceholderBlot);

Quill.register(TextDecorationBlot);
const icons = Quill.import('ui/icons');
icons.textDecoration = {
  UNDERLINE: icons.underline,
  STRIKETHROUGH: icons.strike,
};
const saveOnEnter = true;

const Delta = Quill.import('delta') as typeof DeltaType;
Quill.register('themes/parrot', ParrotTheme, true);
Quill.register('modules/toolbar', ParrotToolbar, false);

const toolbarContainer = ['bold', 'italic', { textDecoration: 'UNDERLINE' }, { textDecoration: 'STRIKETHROUGH' }];

type QuillEditorProps = {
  value?: string,
  fillins: Fillins,
  onChange: Function,
  onSave: Function,
  onCancel: Function,
  onFocus: Function,
};

export default function QuillEditor({
  value,
  fillins,
  onChange,
  onCancel,
  onSave,
  onFocus,
}: QuillEditorProps) {
  const editorPreRef = useRef<HTMLPreElement>(null);
  const [isEditing, setEditingState] = useState(false);

  const [quillEditor, setQuillEditor] = useState<Quill | undefined>(undefined);

  const onEditorChange = (
    eventName: 'text-change' | 'selection-change',
    rangeOrDelta: Range | DeltaStatic,
    oldRangeOrDelta: Range | DeltaStatic,
    source: Sources,
  ) => {
    if (eventName === 'text-change' && source !== 'silent') {
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
      let htmlContent = quillEditor!.root.innerHTML;
      console.log('QuillEditor.onEditorChange change! ----------------------------------------');
      console.log(`QuillEditor.onEditorChange innerHTML:\n[${htmlContent}]`);
      // start with real carrage returns
      htmlContent = htmlContent.split('<p><br></p>').join('\n');
      const paragraphs = htmlContent.split('</p>');
      if (paragraphs[paragraphs.length - 1] === '') {
        paragraphs.pop();
      }
      htmlContent = paragraphs.join('\n').split('<p>').join('');
      // cleanValue = cleanValue.split('</p>').join('\n').split('<p>').join('')
      //   .split('<br>')
      //   .join('');

      const regex = /.<span contenteditable="false">([^<]*)<\/span>./g;
      htmlContent = htmlContent.replace(/fillin="([^"])*" contenteditable="false">/g, '>');
      htmlContent = htmlContent.replace(regex, (match, group1) => group1);

      if (htmlContent[htmlContent.length - 1] === '\n') {
        // TODO #23 fix last return - change init
        htmlContent = htmlContent.substring(0, htmlContent.length - 1);
      }

      console.log(`QuillEditor.onEditorChange htmlContent:\n[${htmlContent}]`);

      onChange(htmlContent, updatedFillins);
    } else if (eventName === 'selection-change') {
      // nothing for now
    }
  };

  useEffect(() => {
    const focusInFunction = (e: any) => {
      setEditingState(true);
      if (onFocus) {
        onFocus();
      }
    };

    const focusOutFunction = (e: any) => {
      // console.log('onfocusout... save.... but not triggered by quill...');
      setEditingState(false);
      // we use the outside clickhandler to handle focus out other than enter / esc
      // onSave?.();
    };

    const keydownFunction = (e: any) => {
      if (e.key === 'Escape') {
        e.preventDefault(); // Prevent the default behavior
        e.stopPropagation(); // Stop event bubbling
        quillEditor?.blur();
        setEditingState(false);
        onCancel();
      } if (e.key === 'Enter' && !e.shiftKey && saveOnEnter) {
        e.preventDefault(); // Prevent the default behavior
        e.stopPropagation(); // Stop event bubbling
        quillEditor?.blur();
        setEditingState(false);
        onSave();
      }
    };

    const onClick = (e: any) => {
      if (e.target.nodeName === 'PH') {
        const range = document.createRange();
        range.selectNodeContents(e.target);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
    };

    if (editorPreRef.current) {
      editorPreRef.current.addEventListener('focusin', focusInFunction);
      editorPreRef.current.addEventListener('focusout', focusOutFunction);
      editorPreRef.current.addEventListener('keydown', keydownFunction);
      editorPreRef.current.addEventListener('click', onClick);
    }

    return () => {
      if (editorPreRef.current) {
        editorPreRef.current?.removeEventListener('focusin', focusInFunction);
        editorPreRef.current?.removeEventListener('focusout', focusOutFunction);
        editorPreRef.current.removeEventListener('keydown', keydownFunction);
        editorPreRef.current?.removeEventListener('click', onClick);
      }
    };
  }, [isEditing]);

  function initQuill(editorElement: HTMLElement) {
    const editor = new Quill(editorElement, {
      theme: 'parrot',
      modules: {
        toolbar: {
          container: toolbarContainer,
          handlers: {
            placeholder() {
              // eslint-disable-next-line react/no-this-in-sfc
              this.quill.theme.tooltip.edit('placeholder');
            },
            link() {
              // eslint-disable-next-line react/no-this-in-sfc
              this.quill.theme.tooltip.edit('link');
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
            custom: {
              key: 'Enter',
              shiftKey: false,
              handler() {
                // prevent default behaviour of enter key (when shift is not hold)
                if (!saveOnEnter) {
                  return true;
                }
                return false;
              },
            },
          },
        },
        clipboard: {
          matchers: [
            ['PH', (node: HTMLElement, delta: any) => {
              const fillin = node.getAttribute('fillin');
              const name = node.innerHTML;
              return delta.compose(new Delta().retain(delta.length(), { placeholder: { fillin, name } }));
            }],
            ['S', (node: HTMLElement, delta: any) => delta.compose(new Delta().retain(delta.length(), { textDecoration: 'STRIKETHROUGH' }))],
            ['U', (node: HTMLElement, delta: any) => delta.compose(new Delta().retain(delta.length(), { textDecoration: 'UNDERLINE' }))],
          ],
        },
      },
      readOnly: true,
    });
    editor.root.setAttribute('spellcheck', 'false');
    return editor;
  }

  function updateQuill(currentQuillEditor: Quill, updatedValue: string, updatedFillins: Fillins) {
    // eslint-disable-next-line no-param-reassign
    (currentQuillEditor.clipboard as any).matchers[0][1] = function matchText(node: any, delta: any) {
      const text = node.data;
      return delta.insert(text);
    };
    // add extra cr
    updatedValue += '\n';

    const cleanedValue = updatedValue.split('\n').join('<br>');
    const contents = (currentQuillEditor.clipboard as any).convertHTML(cleanedValue) as any;

    for (const ops of contents.ops!) {
      const placeholderName = ops.attributes?.placeholder?.name;
      if (placeholderName) {
        // TODO #23 fix last return - update quill text
        ops.attributes.placeholder!.fillin = updatedFillins[placeholderName]?.value ?? 'oh oh';
      }
    }
    currentQuillEditor.setContents(contents, 'silent');
  }

  useEffect(() => {
    if (editorPreRef.current) {
      const editor = initQuill(editorPreRef.current);
      setQuillEditor(editor);
      updateQuill(editor, value ?? '', fillins);
      editor.enable();
    }
  }, [editorPreRef]);

  useEffect(() => {
    quillEditor?.on('editor-change', onEditorChange);
    return () => {
      quillEditor?.off('editor-change', onEditorChange);
    };
  }, [quillEditor]);

  useEffect(() => {
    if (!quillEditor || isEditing) {
      // console.log('skiping update because of focus');
      return;
    }
    updateQuill(quillEditor!, value ?? '', fillins);
  }, [value, fillins]);

  return (
    <pre ref={editorPreRef} />
  );
}
