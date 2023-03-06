import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";
import LocalizedLabelListItem from "./LocalizedLabelListItem";
import Select, { SelectOption } from '../../compontents/select/select'
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
      const deepLTranslationProvider = async function(text: String, language: string) {
        console.log('tranalating: ' +text + ' with deepl');
        let result = await fetch('http://localhost:3333/api/v1/translate', {
          method: 'POST',
          /*headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          },*/ 
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }, 
          body: JSON.stringify(
            {
              text: [text],
              target_lang: language
            }
          ) 
        })
        let translationResults = await result.json();
        
        return translationResults.translations[0].text
      }

      

      props.localisedLabelManager.setLanguageToFrame(firstLocalizedLabelInFrame.rootFrameId, language, deepLTranslationProvider)
      
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
    <>
        
        <div className="header">
            <div className="column-1">
              <div className="spacer"></div>
              <div className="element-symbol">
                <div className="svg-container number-sign-svg"></div>
              </div>
              <div  className="element-name font-body-24-bold">{rootFrameName}</div>
              </div>
              <div className="column-2">
              <div className="frame-actions">
                <Select
                      placeholder="Select item"
                      onChange={value => { onLanguageSelectionClick(firstTranslationState, value.value as Language) }}
                      defaultValue={rootFrameLanguage?.value}
                      unSelectedIcon='language'
                      options={languageOptiones}
                  />
                <div className="frame-icon" onClick={e=>{
                          e.preventDefault();
                          onSampleValuesClick(firstTranslationState)
                      }}>
                  <div className={'svg-container ' + (sampleValues == true ? 'placeholder-svg' : 'placeholder-filled-svg')} ></div>
                </div>
                
              </div>
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
        
    </>
    )
}