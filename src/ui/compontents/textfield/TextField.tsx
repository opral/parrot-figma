/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable react/require-default-props */
import * as React from 'react';
import { useEffect, useRef } from 'react';
import useState from 'react-usestateref';
import OutsideClickHandler from 'react-outside-click-handler';
import './TextField.css';

type TextFieldProps = {
  singleClick: boolean
  editingTrigger?: number
  placeholder?: string
  icon?: string
  onSearchClick?: Function
  text?: string
  onSave: Function
};

export default function TextField({
  singleClick,
  editingTrigger,
  placeholder,
  icon,
  onSearchClick,
  text,
  onSave,
}: TextFieldProps) {
  const [textState, setTextState, textStateRef] = useState(text);
  const [isEditing, setEditingState] = useState(false);

  const inputFieldRef = useRef<HTMLInputElement>(null);
  const textDivRef = useRef<HTMLDivElement>(null);

  const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
    const val = evt.target?.value;
    setTextState(val);
  };

  const doSave = () => {
    setEditingState(false);
    onSave(textStateRef.current);
  };

  const onCancel = () => {
    setEditingState(false);
    setTextState(text);
  };

  const handleOutsideClick = () => {
    doSave();
  };

  useEffect(() => {
    const keydownFunction = (e: any) => {
      if (e.key === 'Escape') {
        onCancel();
      } if (e.key === 'Enter') {
        doSave();
      }
    };

    inputFieldRef.current?.addEventListener('keydown', keydownFunction);
    return () => {
      inputFieldRef.current?.removeEventListener('keydown', keydownFunction);
    };
  }, [isEditing]);

  useEffect(() => {
    if (isEditing) {
      inputFieldRef.current?.focus();
      inputFieldRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    if (editingTrigger) {
      setEditingState(true);
    }
  }, [editingTrigger]);

  useEffect(() => {
    setTextState(text);
  }, [text]);

  return (
    <OutsideClickHandler
      onOutsideClick={handleOutsideClick}
      disabled={!isEditing}
      display="contents"
    >
      <div className={`text-field${isEditing ? ' editing' : ''}`}>

        <div ref={textDivRef} className={`text-field-text${isEditing ? ' editing ' : ''}${icon ? ' icon-left ' : ''}${onSearchClick ? ' icon-right' : ''}`}>

          <input
            ref={inputFieldRef}
            style={{
              visibility: (isEditing ? 'visible' : 'hidden'),
            }}
            value={textState}
            onChange={handleChange}
            placeholder={placeholder}
          />

          <p
            className={`translation${isEditing ? ' editing' : ''}`}
            onDoubleClick={() => {
              if (!isEditing && !singleClick) {
                setEditingState(!isEditing);
              }
            }}
            onClick={() => {
              if (!isEditing && singleClick) {
                setEditingState(!isEditing);
              }
            }}
          >
            {text === undefined || text === '' ? placeholder : text }
          </p>
          { icon !== undefined && (
          <span className={`svg-container ${icon}`} />
          )}
          { onSearchClick !== undefined && (
          <span className="svg-container right search-svg" onClick={(() => { if (onSearchClick !== undefined) onSearchClick(text); })} />
          )}
        </div>
      </div>
    </OutsideClickHandler>
  );
}
