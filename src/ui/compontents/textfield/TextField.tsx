import * as React from "react";
import { useEffect, useRef, useState } from "react";
import OutsideClickHandler from "react-outside-click-handler";
import "./TextField.css"

type TextFieldProps = {
    editingTrigger: number
    text?: string
    onSave: Function
}

export default function TextField(props: TextFieldProps) {
   
    let [text, setText] = useState(props.text)
    let [isEditing, setEditingState] = useState(false)

    const inputFieldRef = useRef<HTMLInputElement>(null);
    const textDivRef = useRef<HTMLDivElement>(null);
    
    const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const val = evt.target?.value;
        setText(val);
    };

    const onSave = () => {
        setEditingState(false);
        props.onSave();
    }

    const onCancel = () => {
        setEditingState(false);
        console.log('setting text to val:' + props.text);
        setText(props.text);
    } 

    const handleOutsideClick = () => {
        onSave()
    }

    useEffect(()=>{
        const keydownFunction = (e: any) => {
            if (e.key === 'Escape') {
                onCancel();
            } if (e.key === 'Enter') {
                onSave();
            }
        }

        document.addEventListener('keydown',keydownFunction )
        return () => {
          document.removeEventListener('keydown', keydownFunction)
        }
    }, [isEditing])

    useEffect(() => {
        if (isEditing) {
            inputFieldRef.current?.focus();
            inputFieldRef.current?.select();
        }
    }, [isEditing]);

    useEffect(() => {
        if(props.editingTrigger) {
            setEditingState(true);
        }
    }, [props.editingTrigger]);

    
    return (
        <OutsideClickHandler
            onOutsideClick={handleOutsideClick}
            disabled={!isEditing}
            display='contents'
        >
        <div className={'text-field' + (isEditing ? ' editing' :'')}>
            <div ref={textDivRef} className={"text-field-text" + (isEditing ? ' editing' :'')}>
                <input
                    ref={inputFieldRef}
                    style={{
                        visibility: (isEditing ? 'visible' :'hidden')
                    }}
                    value={text}
                    onChange={handleChange} />
                <p  className={'translation' + (isEditing ? ' editing' :'')}  onDoubleClick={e=> {
                        if (!isEditing) {
                            setEditingState(!isEditing);
                        }
                    }}>
                    {text}
                </p>
            </div>
        </div>
    </OutsideClickHandler>
    )
}
