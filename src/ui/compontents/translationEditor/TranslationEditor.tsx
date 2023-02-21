import * as React from "react";
import { useEffect, useRef, useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../select/icon-select'
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { Language } from "../../../lib/base/Language";

type TranslationEditorProps = {

    text?: string
    designText?: string,
    onSave: Function
    
}

export default function TranslationEditor(props: TranslationEditorProps) {
   
    let [translationText, setTranslationText] = useState(props.text)
    let [editingState, setEditingState] = useState(false)

    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    
    useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = evt.target?.value;
    
        setTranslationText(val);
    };
    
    return (
        <div>
            { editingState && 
            <div>
                <textarea
                    style={{width: '100%'}}
                    value={translationText}
                    ref={textAreaRef}
                    onChange={handleChange}
                    ></textarea>
                
                <input type="button" value="Save" 
                    disabled={translationText == props.text}
                    onClick={e => {
                        setEditingState(!editingState)
                        props.onSave(translationText);
                    }} />
                <input type="button" value="Cancel" 
                    onClick={e => {
                        setEditingState(!editingState)
                    }} />
                { props.designText !== undefined && props.designText !== translationText && 
                
                    <div onClick={e => {
                        setTranslationText(props.designText!)
                    }} 
                    >
                        <div>Figma: </div>
                        { props.designText! }
                    </div>
                }
            </div>
            }
            { !editingState && 
            <div className="translation" onClick={e=> {
                    console.log('clickE');
                    setEditingState(!editingState)
                }}>
                {props.text != undefined &&
                    <>{props.text}</>
                }
                {props.text == undefined &&
                    <>UNSET</>
                }
                </div>
            }   
        </div>
    )
}


// Updates the height of a <textarea> when the value changes.
const useAutosizeTextArea = (
    textAreaRef: HTMLTextAreaElement | null,
    value: string
  ) => {
    useEffect(() => {
      if (textAreaRef) {
        // We need to reset the height momentarily to get the correct scrollHeight for the textarea
        textAreaRef.style.height = "0px";
        const scrollHeight = textAreaRef.scrollHeight;
  
        // We then set the height directly, outside of the render loop
        // Trying to set this with state or a ref will product an incorrect value.
        textAreaRef.style.height = scrollHeight + "px";
      }
    }, [textAreaRef, value]);
  };
  