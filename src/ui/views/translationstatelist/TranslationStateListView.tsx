import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import LocalizedFrameGroup from "./LocalizedFrameGroup";
import "./TranslationStateListView.css"

type TranslationStatesListViewProps = {
    keys: LocalizedLabel[],
    languages: any[]

    figmaHelper: FigmaHelper
    figmaRemote: FigmaUtil
    refreshKeys: Function
  }
  

export default function TranslationStateListView(props: TranslationStatesListViewProps) {

    let mainFrameToTranslationStates = {} as any;
    for (let translationKey of props.keys) {
        if (!mainFrameToTranslationStates[translationKey.rootFrameId]) {
            mainFrameToTranslationStates[translationKey.rootFrameId] = [];
        }
        mainFrameToTranslationStates[translationKey.rootFrameId].push(translationKey);
    }

    if (props.keys.length == 0) {
        return <b>Keinen Frame mit keys ausgewählt</b>
    }

    return (
        <div className="table">
                {Object.keys(mainFrameToTranslationStates).map((mainFrameId) => 
                    <LocalizedFrameGroup 
                        translationStates={mainFrameToTranslationStates[mainFrameId]} 
                        languages={props.languages} 
                        refreshKeys={props.refreshKeys}
                        figmaHelper={props.figmaHelper}
                        figmaRemote={props.figmaRemote}
                        key={mainFrameId} 
                        
                        />)
                }
            </div>
    )
}

