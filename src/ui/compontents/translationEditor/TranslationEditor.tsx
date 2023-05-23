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
  Decoration, DecorationSet, EditorView, MatchDecorator, ViewPlugin, ViewUpdate, WidgetType,
} from '@codemirror/view';

import MatchView from '../matchview/MatchView';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import LanguageContextProvider from '../../LanguageContext';
import { PlaceholderType } from '../../../lib/keystore/UITranslationKey';

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
    lineHighlight: 'var(--figma-color-bg)',
  },
  styles: [

  ],
});

type TranslationEditorProps = {
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

    options = options.concat(keyProvider.getSampleKeyNames().map((keyName) => ({ label: `[[${keyName}]]` })));

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



const placeholderMatcher = new MatchDecorator({
  regexp: /\[\[(?:(\d+):)?([A-Za-z_]{2,})?(?::*([sdf])(?:\.(\d+))?)?\]\]/g, // TODO #8 this is what lokalise uses - to nerdy? think about [[]] for example

  decoration(match, editorView, position) {
    const cursorPos = editorView.state.selection.ranges[0].from;
    if (cursorPos > match.index && cursorPos < (match.index + match[0].length)) {
      // we don't decorate if the curser is placed within the atomic
      return null;
    }

    const argumentPosition = position; //match[1] ? parseInt(match[1], 10) : undefined;
    let name = match[2];
    
    if (!name) {
      name = '?';
    }

    const type = (match[3] || 's') as PlaceholderType;
    const decimalPlaces = match[4] ? parseInt(match[4], 10) : undefined;

    return Decoration.replace({
      widget: new PlaceholderWidget(name, argumentPosition, argumentPosition ?? 0, type, decimalPlaces),
    });
  },
});

// XXX we monkey patch the update Deco to redraw the decoratores also on cursor move - this is ugly but it works for now
const orgUpdateDeco = placeholderMatcher.updateDeco as Function;

placeholderMatcher.updateDeco = function (update, deco) {
  return placeholderMatcher.createDeco(update.view);
  // return orgUpdateDeco.apply(placeholderMatcher, [update, deco]);
};

const placeholders = ViewPlugin.fromClass(class {
  placeholders: DecorationSet;

  constructor(view: EditorView) {
    this.placeholders = placeholderMatcher.createDeco(view);
  }

  update(update: ViewUpdate) {
    this.placeholders = placeholderMatcher.updateDeco(update, this.placeholders);
  }
}, {
  decorations: (instance) => instance.placeholders,
  // provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.placeholders || Decoration.none),
});

export default function TranslationEditor({
  text, onSave, match, editable = true, translationKeyStore,
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

  useEffect(() => {
    if (editingState) {
      // textAreaRef.current?.focus();
      // textAreaRef.current?.select();
    }
  }, [editingState]);

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

          <p
            className={`translation${editingState ? ' editing ' : ''}${textState === undefined ? ' missing ' : ''}`}
            onClick={() => {
              if (!editingState && editable) {
                setEditingState(!editingState);
              }
            }}
          >
            <MatchView
              match={match}
              text={textToUse}
            />

          </p>
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
              autocompletion({ override: [createCompletion(translationKeyStore)] }), placeholders, EditorView.lineWrapping,
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
