
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import { Language } from "../../../lib/base/Language";
import { Plural } from "../../../lib/base/Plural";
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import FigmaHelper from "../../../shared/FigmaHelper";

type TranslationKeyEditorProps = {
    keyName: string,
    plural: string,
    language: string,
    text?: string,
    translationKeyStore: MemoryTranslationKeyStore
}

export default function TranslationKeyEditor(props: TranslationKeyEditorProps) {

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
                        props.translationKeyStore.updateKey(props.keyName, [{language: props.language as Language, plural: props.plural as Plural, text: translationText!}])
                    }} />
                <input type="button" value="Cancel" 
                    onClick={e => {
                        setEditingState(!editingState)
                    }} />
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
  
  