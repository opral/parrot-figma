/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import MatchView from '../matchview/MatchView';
import './TranslationEditor.css';

type TranslationEditorProps = {
  text?: string,
  onSave: Function
  match: { start: number, length: number } | undefined
};

export default function TranslationEditor({ text, onSave, match }: TranslationEditorProps) {
  const [textState, setTextState] = useState(text);
  const [editingState, setEditingState] = useState(false);
  const [textAreaHeight, setTextAreaHeigth] = useState(0);
  const [textAreaWidth, setTextAreaWidth] = useState(0);

  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);

  // useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

  const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = evt.target?.value;

    setTextState(val);
  };

  useEffect(() => {
    setTextState(text);
  }, [text]);

  useEffect(() => {
    if (editingState) {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }
  }, [editingState]);

  useEffect(() => {
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0].contentRect;
      setTextAreaWidth(rect.width);
      setTextAreaHeigth(rect.height);
    });

    if (textDivRef.current) {
      observer.observe(textDivRef.current);
    }
    return () => {
      observer.disconnect();
    };
  }, [textDivRef]);

  let textToUse;

  if (textState === undefined) {
    textToUse = '<no translation>';
  } else if (textState.charAt(textState.length - 1) === '\n') {
    textToUse = `${textState}\n`;
  } else {
    textToUse = textState;
  }
  return (
    <div className={`translation-editor${editingState ? ' editing' : ''}`}>
      <div ref={textDivRef} className={`translation-editor-text${editingState ? ' editing' : ''}`}>

        <textarea
          ref={textAreaRef}
          style={{
            height: textAreaHeight,
            width: textAreaWidth,
            visibility: (editingState ? 'visible' : 'hidden'),
          }}
          value={textState}
          onChange={handleChange}
        />

        <p
          className={`translation${editingState ? ' editing ' : ''}${textState === undefined ? ' missing ' : ''}`}
          onClick={() => {
            if (!editingState) {
              setEditingState(!editingState);
            }
          }}
        >
          <MatchView
            match={match}
            text={textToUse}
          />

        </p>

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
  );
}
