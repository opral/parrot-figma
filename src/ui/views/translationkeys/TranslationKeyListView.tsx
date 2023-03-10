import * as React from "react";
import { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { Language } from "../../../lib/base/Language";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";
import { TranslationKeys } from "../../../lib/keystore/TranslationKey";
import { MemoryTranslationKeyStore, TranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import TranslationKeyListItem from "./TranslationKeyListItem";
import TranslationStateItem from "./TranslationKeyListItem";
import { Plural } from "../../../lib/base/Plural";
import HistoryEntry from "../../compontents/history/HistoryEntry";
import "./TranslationKeyView.css"
import OutsideClickHandler from "react-outside-click-handler";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";


type TranslationKeyListViewProps = {
    keys: TranslationKeys,
    languages: Language[]

    translationKeyStore: MemoryTranslationKeyStore
    localisedLabelManager: LocalizedLabelManagerUI
    
    figmaRemote: FigmaUtil
    refreshKeys: Function
  }
  

export default function TranslationKeyListView(props: TranslationKeyListViewProps) {

    let [history, setHistory] =  useState(undefined as undefined | {text?: string}[])
    let [trigger, setTrigger] = useState(0);
    let [renderEntries, setRenderEntries] = useState(200);
    let [searchText, setSearchText] = useState("");

    useEffect(() => {
        
        props.localisedLabelManager.addEventListener('updated', refreshSelection)

        return () => props.localisedLabelManager.removeEventListener('updated', refreshSelection)
    }, [])

    useEffect(() => {
        
        if (Object.keys(props.keys).length > renderEntries) {
            console.log('scheduling next portion');
            setTimeout(() => { 
                console.log('rending next portion ' + (renderEntries + 100))
                setRenderEntries(value => value + 250)
            }, 5000);
        } else {
            console.log('rendering completed')
        }

    }, [renderEntries])
    
    function refreshSelection() {
        props.refreshKeys();
        setTrigger(v => v+1);
    }


    if (Object.keys(props.keys).length == 0) {
        return <b>Keine Keys</b>
    }


    let showHistory = (keyName: string, language: Language, plural: Plural) => {
        props.translationKeyStore.parentKeyStore.getHistory(keyName, language, plural).then(historyEntries => {
            setHistory(historyEntries)
        })
    }

    let rendered = 0;

    return (
        <div >
            <div className="style_picker--search search--margin">
                <span className="svg-container search-svg">
                </span>
                <input type="text" placeholder="Search" className="search--searchInput" spellCheck="false" dir="auto" value={searchText} onChange={ (e) => { 
                    setSearchText(e.target.value);
                    setRenderEntries(100);
                } } />
            </div>
            <div className="grid">
            {Object.keys(props.keys).map((key, i) => {
                if (rendered > renderEntries) {
                    return
                };
                let match = undefined;
                if (searchText != "") {
                    let keyPosition = key.indexOf(searchText);
                    if(keyPosition !== -1) {
                        match = { key: { start: keyPosition, length: searchText.length}}
                    } else {
                        outer:
                        for (let language of Object.keys(props.keys[key].translations)) {
                            inner:
                            for (let plural of Object.keys(props.keys[key].translations[language as Language]!)) {
                                let text = props.keys[key].translations[language as Language]![plural as Plural]!.text;
                                if (text === undefined) {
                                    continue inner;
                                }

                                let matchStart = text.indexOf(searchText);
                                if (matchStart !== -1) {
                                    match = { [language]: { [plural]: {start: matchStart, length: searchText.length}}}

                                    break outer;
                                }

                            }
                        }
                    }

                    if (match === undefined) {
                        return
                    }
                }
                
                rendered++;
                return <TranslationKeyListItem
                    key={key} 
                    languages={props.languages}
                    translationKeyStore={props.translationKeyStore}
                    localisedLabelManager={props.localisedLabelManager}
                    searchMatch={match}
                    
                    showHistory={showHistory}
                    translationKey={props.keys[key]}
                    figmaRemote={props.figmaRemote}
                    />
            }
                
            )}
            </div>
            <OutsideClickHandler
                onOutsideClick={() => { setHistory(undefined) }}
                disabled={history === undefined}
                >
                <div className={"side-drawer" + (history !== undefined ? ' open' : ' ')}> 
                    <div className="history_view--topHeader">
                        Version history
                        <span role="button" onClick={() => { setHistory(undefined) }}
                            className="svg-container raw_components--iconButtonEnabled raw_components--_iconButton history_view--headerButton"
                            data-tooltip-type="text" data-tooltip="Close" aria-label="Close">
                            <svg className="svg" width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                                <path d="M5 5.71l3.646 3.647.707-.707-3.646-3.647 3.646-3.646L8.646.65 5 4.296 1.353.65l-.707.707 3.646 3.646L.646 8.65l.707.707L5 5.71z" fillRule="nonzero" fillOpacity="1" fill="#000" stroke="none"></path>
                            </svg>
                        </span>
                    </div>
                    {history?.reverse().map((entry, i, array) => <HistoryEntry text={entry.text} previousText={ i < (array.length - 1) ? array[i+1].text : undefined}/>)}
                </div>
                </OutsideClickHandler>
            </div>
    )
}

