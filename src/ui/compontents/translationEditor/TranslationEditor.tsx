/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable max-classes-per-file */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import { autocompletion, CompletionContext, snippetCompletion } from '@codemirror/autocomplete';

import CodeMirror from '@uiw/react-codemirror';
import createTheme from '@uiw/codemirror-themes';
import './TranslationEditor.css';
import {
  EditorView,
} from '@codemirror/view';

import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import placeholderDecorator from './PlaceholderDecorator';
import TranslationView from './TranslationView';

const myTheme = createTheme({
  theme: 'light',
  settings: {
    background: 'var(--figma-color-bg)',
    foreground: '#4D4D4C',
    caret: '#AEAFAD',
    selection: '#D6D6D6',
    selectionMatch: '#D6D6D6',
    gutterBackground: 'var(--figma-color-bg)',
    gutterForeground: 'var(--figma-color-bg)',
    gutterBorder: '#ddd',
    gutterActiveForeground: '',
    lineHighlight: 'transparent',
  },
  styles: [

  ],
});

type TranslationEditorProps = {
  keyName?: string,
  text?: string,
  onSave: Function
  match: { start: number, length: number } | undefined
  editable: boolean,
  translationKeyStore: MemoryTranslationKeyStore,
};

function createCompletion(keyProvider: MemoryTranslationKeyStore) {
  return function myCompletions(context: CompletionContext) {
    const word = context.matchBefore(/\[\[|\[\[*/);
    if (!word || (word.from === word.to && !context.explicit)) {
      return null;
    }

    let options = [snippetCompletion('[[{1}]]', {
      label: '[[',
      detail: 'Text Placeholder',
    })] as any[];

    // options = options.concat(keyProvider.getSampleKeyNames().map((keyName) => ({ label: `[[${keyName}]]` })));

    return {
      from: word.from,
      options,
      /* [
        snippetCompletion('[%s:#{1}]', {
          label: '[%s:',
          detail: 'Text Placeholder',
        }),
        { label: '[%s:name]', type: 'variable' },
        // { label: 'hello', type: 'variable', info: '(World)' },
        // {
        // label: '[%magic', type: 'text', apply: '⠁⭒*.✩.*⭒⠁', detail: 'macro',
        // },
      ], */
    };
  };
}

// We use this view in two ocations:
//  - key editor placeholders no fillins
//  - label editor - text should contain the placeholders but the editor needs to know the fillins?

export default function TranslationEditor({
  text, keyName, onSave, match, editable = true, translationKeyStore,
}: TranslationEditorProps) {
  const [textState, setTextState] = useState(text);
  const [editingState, setEditingState] = useState(false);
  const [isMouseOver, setMouseOver] = useState(false);

  const textDivRef = useRef<HTMLDivElement>(null);

  // useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

  const handleChange = (value: string) => {
    setTextState(value);
  };

  useEffect(() => {
    setTextState(text);
  }, [text]);

  let textToUse;

  if (textState === undefined || textState === '') {
    textToUse = '<no translation>';
  } else if (textState.charAt(textState.length - 1) === '\n') {
    textToUse = `${textState}\n`;
  } else {
    textToUse = textState;
  }
  return (
    <OutsideClickHandler
      onOutsideClick={() => {
        setEditingState(!editingState);
        onSave(textState);
      }}
      disabled={!editingState}
      display="contents"
    >
      <div className={`translation-editor${editingState ? ' editing' : ''}`}>
        <div ref={textDivRef} onMouseOver={() => setMouseOver(true)} onMouseLeave={() => setMouseOver(false)} className={`translation-editor-text${editingState ? ' editing' : ''}`}>

          <div
            className={`translation${editingState ? ' editing ' : ''}${textState === undefined ? ' missing ' : ''}`}
            onClick={() => {
              if (!editingState && editable) {
                setEditingState(!editingState);
              }
            }}
          >
            <TranslationView
              match={match}
              text={textToUse}
            />

          </div>
          { (isMouseOver || editingState) && (

          <CodeMirror
            value={textState}
            maxWidth="100%"
            onChange={handleChange}
            height="auto"
            theme={myTheme}
            placeholder={textToUse}
            basicSetup={{
              closeBrackets: false,
              foldGutter: false,
              lineNumbers: false,
              searchKeymap: false,
            }}
            extensions={[
              autocompletion({ override: [createCompletion(translationKeyStore)] }),
              placeholderDecorator(translationKeyStore, keyName),
              EditorView.lineWrapping,
            ]}
            onFocus={() => setEditingState(true)}
          />
          )}

        </div>
        { editingState && (
        <>
          <input
            type="button"
            value="Save"
            disabled={textState === text}
            onClick={() => {
              setEditingState(!editingState);
              onSave(textState);
            }}
          />
          <input
            type="button"
            value="Cancel"
            onClick={() => {
              setEditingState(!editingState);
            }}
          />
          { text !== undefined && text !== textState && (

          <div onClick={() => {
            setTextState(text!);
          }}
          >
            <div>Figma: </div>
            { text! }
          </div>
          )}
        </>
        )}
      </div>
    </OutsideClickHandler>
  );
}
