import { match } from "assert";
import * as React from "react";
import { useEffect, useRef, useState } from "react";
import MatchView from "../matchview/MatchView";
import "./TranslationEditor.css"

type TranslationEditorProps = {
    text?: string,
    onSave: Function
    match: {start: number, length: number } | undefined
}

export default function TranslationEditor(props: TranslationEditorProps) {
   
    let [text, setText] = useState(props.text)
    let [editingState, setEditingState] = useState(false)
    let [textAreaHeight, setTextAreaHeigth] = useState(0);
    let [textAreaWidth, setTextAreaWidth] = useState(0);


    const textAreaRef = useRef<HTMLTextAreaElement>(null);
    const textDivRef = useRef<HTMLDivElement>(null);
    
    // useAutosizeTextArea(textAreaRef.current, translationText ? translationText : '')

    const handleChange = (evt: React.ChangeEvent<HTMLTextAreaElement>) => {
        const val = evt.target?.value;
    
        setText(val);
    };


    useEffect(() => {
        setText(props.text)
      }, [props.text]);


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
    
      let textToUse = text === undefined ? '<no translation>' : (text.charAt(text.length - 1) === '\n' ? text + '\n' : text); 

    return (
        <div className={'translation-editor' + (editingState ? ' editing' :'')}>
            <div ref={textDivRef} className={"translation-editor-text" + (editingState ? ' editing' :'')}>
            
                
                 <textarea
                    ref={textAreaRef}
                    style={{
                        height: textAreaHeight,
                        width: textAreaWidth,
                        visibility: (editingState ? 'visible' :'hidden')
                    }}
                    value={text}
                    onChange={handleChange} />
                
            
            
                <p  className={'translation' + (editingState ? ' editing ' :'') + (text == undefined ? ' missing ' :'')}  onClick={e=> {
                        if (!editingState) {
                            setEditingState(!editingState);
                        }
                        
                    }}>
                    <MatchView 
                    match={props.match}
                    text={textToUse}/>
                    
                </p>
            
            </div>
            { editingState && (
            <>

                <input type="button" value="Save" 
                    disabled={text == props.text}
                    onClick={e => {
                        setEditingState(!editingState)
                        props.onSave(text);
                    }} />
                <input type="button" value="Cancel" 
                    onClick={e => {
                        setEditingState(!editingState)
                    }} />
                { props.text !== undefined && props.text !== text &&  (
                    
                        <div onClick={e => {
                            setText(props.text!)
                        }} 
                        >
                        <div>Figma: </div>
                        { props.text! }
                    </div>
                )}
                </>
            )}
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
  