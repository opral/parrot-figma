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
import MemoryTranslationKeyStore from '../../../lib/message/MemoryTranslationKeyStore';
import TranslationView from './TranslationView';
import QuillEditor from './QuillEditor';
import { Fillins } from '../../../lib/message/TranslationKey';

type TranslationEditorProps = {
  translationHTML?: string,
  fillins: Fillins,
  /**
   * Triggered when a save is requested - like enter press or click out of the controll
   */
  onSave?: Function,
  /**
   * Triggered when the user presses esc
   */
  onCancel?: Function,
  /**
   * Triggered when the user changed the fillins or the text
   */
  onChange?: Function,
  onBlur?: Function,
  match: { start: number, length: number } | undefined
  editable: boolean,
  translationKeyStore: MemoryTranslationKeyStore,
};

// We use this view in two ocations:
//  - key editor placeholders no fillins
//  - label editor - text should contain the placeholders but the editor needs to know the fillins?

export default function TranslationEditor({
  translationHTML,
  fillins,
  onSave,
  onCancel,
  onBlur,
  match,
  editable = true,
  translationKeyStore,
  onChange,
}: TranslationEditorProps) {
  const [textState, setTextState] = useState(translationHTML);
  const [fillinsState, setFillinsState] = useState(fillins);

  //console.log('#23 QuillEditor() \n [' + translationHTML + ']');

  const textRef = useRef(translationHTML);
  const fillinsRef = useRef(fillins);

  const [editingState, setEditingState] = useState(false);
  const [isMouseOver, setMouseOver] = useState(false);

  const textDivRef = useRef<HTMLDivElement>(null);

  // useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

  const handleChange = (value: string, updatedFillins: Fillins) => {
    // console.log('propagating change' + value);
    if (onChange !== undefined) {
      onChange(value, updatedFillins);
    }
    //console.log('#23 QuillEditor.handleChange  [' + value + ']');
    setTextState(value);
    setFillinsState(updatedFillins);

    textRef.current = value;
    fillinsRef.current = updatedFillins;

    // console.log('propagating change' + value);
  };

  const handleSave = () => {
    //console.log('#23 QuillEditor.handleSave  ');
    setEditingState(false);
    onSave?.(textRef.current, fillinsRef.current);
  };

  const handleCancel = () => {
    //console.log('#23 QuillEditor.handleCancel');

    setTextState(translationHTML);
    setFillinsState(fillins);

    textRef.current = translationHTML;
    fillinsRef.current = fillins;

    if (onChange !== undefined) {
      onChange(translationHTML, fillins);
    }

    setEditingState(false);
    onCancel?.();
  };

  useEffect(() => {
    //console.log('#23 QuillEditor.useEffect(translationHTML)  [' + translationHTML + ']');
    setTextState(translationHTML);
    textRef.current = translationHTML;
  }, [translationHTML]);

  useEffect(() => {
    setFillinsState(fillins);
    fillinsRef.current = fillins;
  }, [fillins]);

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
      onOutsideClick={handleSave}
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
            onCancel={handleCancel}
            onChange={handleChange}
            onSave={handleSave}
          />
          )}

        </div>
      </div>
    </OutsideClickHandler>
  );
}
