import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";
import { TranslationKeys } from "../../../lib/base/TranslationKey";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import TranslationKeyView from "./TranslationKey";
import TranslationStateItem from "./TranslationKey";


type TranslationKeyListViewProps = {
    keys: TranslationKeys,
    languages: any[]

    figmaHelper: FigmaHelper
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
                    translationKey={props.keys[key]}
                    refreshKeys= {props.refreshKeys}
                    figmaHelper={props.figmaHelper}
                    figmaRemote={props.figmaRemote}
                    />
            )}
            </div>
    )
}

