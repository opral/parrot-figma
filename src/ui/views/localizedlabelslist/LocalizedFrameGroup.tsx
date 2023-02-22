import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";
import LocalizedLabelListItem from "./LocalizedLabelListItem";
import Select, { SelectOption } from '../../compontents/select/icon-select'
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import { Language } from "../../../lib/base/Language";

type LocalizedFrameGroupProps = {
    localizedLabels: LocalizedLabel[],
    languages: Language[],
    translationKeyStore: MemoryTranslationKeyStore
    selectionByFrame: {
      [rootFrameId: string]: string[]
    }
    figmaRemote: FigmaUtil
    localisedLabelManager: LocalizedLabelManagerUI 
}

export default function LocalizedFrameGroup(props: LocalizedFrameGroupProps) {
    
    if (props.localizedLabels.length === 0) return null

    let firstTranslationState = props.localizedLabels[0];
    let rootFrameName = firstTranslationState.rootFrameName;
    
    
    let sampleValues = firstTranslationState.useSampleValues;
    
    let rootFrameLanguage: SelectOption | undefined;
    let languageOptiones = [] as SelectOption[];

    for (let language of props.languages) {
        const currentLanguageOption = {
            value: language, label: language, icon: 'flag-'+language
        }
        
        if (language == firstTranslationState.rootFrameLanguage) {
            rootFrameLanguage = currentLanguageOption
        }
        languageOptiones.push(currentLanguageOption)
    }

    async function onLanguageSelectionClick(firstLocalizedLabelInFrame: LocalizedLabel, language: Language) {
      props.localisedLabelManager.localisedLabelMangerSandbox.updateFrameProperties(firstLocalizedLabelInFrame.rootFrameId, {
        language: language,
        sampleValues: firstLocalizedLabelInFrame.rootFrameUseSampleValues
      })
      console.warn('onLanguageSelectionClick back prop not implemented') 
      /*
      await props.localisedLabelManager.localisedLabelMangerSandbox.updateFrameProperties
      await props.refreshKeys();
      */
    }

    async function onCreateKeyFrameClick(frameNode: string) {
      console.warn('onCreateKeyFrameClick not implemented')
      // await props.figmaHelper.toggleKeyFrame(frameNode);
      
    }

    async function onSampleValuesClick(firstLocalizedLabelInFrame: LocalizedLabel) {
      props.localisedLabelManager.localisedLabelMangerSandbox.updateFrameProperties(firstLocalizedLabelInFrame.rootFrameId, {
        language: firstLocalizedLabelInFrame.rootFrameLanguage,
        sampleValues: firstLocalizedLabelInFrame.rootFrameUseSampleValues!
      })
      console.warn('onSampleValuesClick back prop not implemented') 
      /*
      await props.figmaHelper.toggleSampleValues(frameNode);
      await props.refreshKeys();*/
    }
    
  
    return (
    <section>
        
        <div className="header">
            <div className="frame-info">
              <div className="element-symbol">
                <div className="svg-container number-sign-svg"></div>
              </div>
              <div  className="font-body-24-bold">{rootFrameName}</div>
              
              <div className="frame-actions">
                <div className="circular-button" onClick={e=>{
                        e.preventDefault();
                        onCreateKeyFrameClick(firstTranslationState.rootFrameId)
                    }}>
                  <div className="key-svg"></div>
                </div>
                <div className="circular-button" onClick={e=>{
                        e.preventDefault();
                        onSampleValuesClick(firstTranslationState)
                    }}>
                  <div className={"variable-svg "+ sampleValues +' ' + (sampleValues == true ? 'active' : '')} ></div>
                </div>
                <Select
                    placeholder="Select item"
                    onChange={value => { onLanguageSelectionClick(firstTranslationState, value.value as Language) }}
                    defaultValue={rootFrameLanguage?.value}
                    unSelectedIcon='language'
                    options={languageOptiones}
                />
              </div>
              
            </div>
            <div className="header-column font-body-11-bold">
              <div className="column column-1">Key</div>
              <div className="column column-2">Text</div>
              <div className="column column-3"> </div>
            </div>
          </div>
           
            {rootFrameLanguage?.value && props.localizedLabels.map((translationState) => 
                <LocalizedLabelListItem 
                    key={translationState.nodeId} 
                    translationKeyStore={props.translationKeyStore}
                    localizedLabel={translationState} 
                    figmaRemote={props.figmaRemote}
                    localisedLabelManager={props.localisedLabelManager}
                    selected={props.selectionByFrame[translationState.rootFrameId]?.indexOf(translationState.nodeId) !== -1}
                    />
            )}

            {rootFrameLanguage?.value === undefined && 
              <div>choose curent design language</div>
            }
        
    </section>
    )
}