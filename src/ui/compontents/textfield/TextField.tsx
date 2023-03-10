import * as React from "react";
import { useEffect, useRef } from "react";
import useState from 'react-usestateref'
import OutsideClickHandler from "react-outside-click-handler";
import "./TextField.css"

type TextFieldProps = {
    singleClick: boolean
    editingTrigger?: number
    placeholder?: string
    icon?: string 
    onSearchClick?: Function
    text?: string
    onSave: Function
}

export default function TextField(props: TextFieldProps) {
   
    let [text, setText, textRef] = useState(props.text)
    let [isEditing, setEditingState] = useState(false)

    const inputFieldRef = useRef<HTMLInputElement>(null);
    const textDivRef = useRef<HTMLDivElement>(null);
    
    const handleChange = (evt: React.ChangeEvent<HTMLInputElement>) => {
        const val = evt.target?.value;
        setText(val);
    };

    const onSave = () => {
        setEditingState(false);
        props.onSave(textRef.current);
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

        inputFieldRef.current?.addEventListener('keydown',keydownFunction )
        return () => {
            inputFieldRef.current?.removeEventListener('keydown', keydownFunction)
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

    useEffect(() => {
        setText(props.text)
    }, [props.text]);

    
    return (
        <OutsideClickHandler
            onOutsideClick={handleOutsideClick}
            disabled={!isEditing}
            display='contents'
        >
        <div className={'text-field' + (isEditing ? ' editing' :'')}>
            
            <div ref={textDivRef} className={"text-field-text" + (isEditing ? ' editing ' :'') + (props.icon ? ' icon-left ' :'') + (props.onSearchClick ? ' icon-right' :'')}>
                
                <input
                    ref={inputFieldRef}
                    style={{
                        visibility: (isEditing ? 'visible' :'hidden')
                    }}
                    value={text}
                    onChange={handleChange}
                    placeholder={props.placeholder} />

                <p className={'translation' + (isEditing ? ' editing' :'')} 
                    onDoubleClick={e=> {
                        if (!isEditing && !props.singleClick) {
                            setEditingState(!isEditing);
                        }
                    }}
                    onClick={e=> {
                        if (!isEditing && props.singleClick) {
                            setEditingState(!isEditing);
                        }
                    }}>
                    {text === undefined || text === '' ? props.placeholder : text }
                </p>
                { props.icon !== undefined && (
                    <span className={"svg-container " + props.icon} />
                )}
                { props.onSearchClick !== undefined && (
                    <span className={"svg-container right search-svg"} onClick={(e => { if ( props.onSearchClick !== undefined ) props.onSearchClick() })} />
                )}
            </div>
        </div>
    </OutsideClickHandler>
    )
}
