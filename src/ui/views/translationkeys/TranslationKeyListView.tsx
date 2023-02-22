import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Language } from "../../../lib/base/Language";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";
import { TranslationKeys } from "../../../lib/base/TranslationKey";
import { MemoryTranslationKeyStore, TranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import TranslationKeyView from "./TranslationKeyView";
import TranslationStateItem from "./TranslationKeyView";


type TranslationKeyListViewProps = {
    keys: TranslationKeys,
    languages: Language[]

    translationKeyStore: MemoryTranslationKeyStore
    
    figmaRemote: FigmaUtil
    refreshKeys: Function
  }
  

export default function TranslationKeyListView(props: TranslationKeyListViewProps) {

    if (Object.keys(props.keys).length == 0) {
        return <b>Keine Keys</b>
    }

    return (
        <div className="table">
                
            {Object.keys(props.keys).map((key) => 
                <TranslationKeyView
                    key={key} 
                    languages={props.languages}
                    translationKeyStore={props.translationKeyStore}
                    translationKey={props.keys[key]}
                    
                    figmaRemote={props.figmaRemote}
                    />
            )}
            </div>
    )
}

