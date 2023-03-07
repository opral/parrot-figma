import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Language } from "../../../lib/base/Language";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";
import { TranslationKeys } from "../../../lib/keystore/TranslationKey";
import { MemoryTranslationKeyStore, TranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import TranslationKeyView from "./TranslationKeyView";
import TranslationStateItem from "./TranslationKeyView";
import { Plural } from "../../../lib/base/Plural";
import HistoryEntry from "../../compontents/history/HistoryEntry";
import "./TranslationKeyView.css"
import OutsideClickHandler from "react-outside-click-handler";


type TranslationKeyListViewProps = {
    keys: TranslationKeys,
    languages: Language[]

    translationKeyStore: MemoryTranslationKeyStore
    
    figmaRemote: FigmaUtil
    refreshKeys: Function
  }
  

export default function TranslationKeyListView(props: TranslationKeyListViewProps) {

    let [history, setHistory] =  useState(undefined as undefined | {text?: string}[])

    if (Object.keys(props.keys).length == 0) {
        return <b>Keine Keys</b>
    }

    let showHistory = (keyName: string, language: Language, plural: Plural) => {
        
        props.translationKeyStore.parentKeyStore.getHistory(keyName, language, plural).then(historyEntries => {
            console.log('setting history to ')
            console.log(historyEntries)
            setHistory(historyEntries)
        })
    }

    return (
        <div >
            <div className="grid">
            {Object.keys(props.keys).map((key) => 
                <TranslationKeyView
                    key={key} 
                    languages={props.languages}
                    translationKeyStore={props.translationKeyStore}
                    showHistory={showHistory}
                    translationKey={props.keys[key]}
                    figmaRemote={props.figmaRemote}
                    />
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

