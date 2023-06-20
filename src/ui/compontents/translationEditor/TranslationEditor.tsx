/* eslint-disable jsx-a11y/mouse-events-have-key-events */
/* eslint-disable max-classes-per-file */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';

import './TranslationEditor.css';

import Quill from 'quill';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import TranslationView from './TranslationView';
import QuillEditor from './QuillEditor';
import { Fillins } from '../../../lib/keystore/TranslationKey';

type TranslationEditorProps = {
  keyName?: string,
  fillins: Fillins,
  translationHTML?: string,
  onSave: Function,
  onChange?: Function,
  match: { start: number, length: number } | undefined
  editable: boolean,
  translationKeyStore: MemoryTranslationKeyStore,
};

// We use this view in two ocations:
//  - key editor placeholders no fillins
//  - label editor - text should contain the placeholders but the editor needs to know the fillins?

export default function TranslationEditor({
  translationHTML, keyName, fillins, onSave, match, editable = true, translationKeyStore, onChange,
}: TranslationEditorProps) {
  const quillContainerRef = useRef<HTMLInputElement>(null);
  let quillEditor : any;

  const [textState, setTextState] = useState(translationHTML);
  const [editingState, setEditingState] = useState(false);
  const [isMouseOver, setMouseOver] = useState(false);

  const textDivRef = useRef<HTMLDivElement>(null);

  // useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

  const handleChange = (value: string, updatedFillins: Fillins) => {
    if (onChange !== undefined) {
      onChange(value, updatedFillins);
    }
    setTextState(value);
  };

  useEffect(() => {
    setTextState(translationHTML);
  }, [translationHTML]);

  let textToUse;

  if (textState === undefined || textState === '') {
    textToUse = 'no translation';
  // } else if (textState.charAt(textState.length - 1) === '\n') {
  //   textToUse = `${textState}\n`;
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

          <QuillEditor
            value={textState}
            fillins={fillins}
            onFocus={() => { setEditingState(true); }}
            onChange={handleChange}
          />

          )}

        </div>
        { editingState && (
        <>
          <input
            type="button"
            value="Save"
            disabled={textState === translationHTML}
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
          {/* text !== undefined && text !== textState && (

          <div onClick={() => {
            setTextState(text!);
          }}
          >
            <div>Figma: </div>
            { text! }
          </div>
        ) */}
        </>
        )}
      </div>
    </OutsideClickHandler>
  );
}
