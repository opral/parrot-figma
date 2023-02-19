import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";
import TranslationStateItem from "./TranslationStateItem";
import Select, { SelectOption } from '../../compontents/select/icon-select'
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";

type LocalizedFrameGroupProps = {
    translationStates: LocalizedLabel[],
    languages: any[],

    refreshKeys: Function
    figmaHelper: FigmaHelper,
    figmaRemote: FigmaUtil
}

export default function LocalizedFrameGroup(props: LocalizedFrameGroupProps) {

    if (props.translationStates.length === 0) return null

    let firstTranslationState = props.translationStates[0];
    let rootFrameName = firstTranslationState.rootFrameName;
    
    
    let sampleValues = firstTranslationState.useSampleValues;
    
    let rootFrameLanguage: SelectOption | undefined;
    let languageOptiones = [] as SelectOption[];

    for (let languageOption of props.languages) {
        const currentLanguageOption = {
            value: languageOption.language, label: languageOption.language, icon: 'flag-'+languageOption.language
        }
        
        if (languageOption.language == firstTranslationState.rootFrameLanguage) {
            rootFrameLanguage = currentLanguageOption
        }
        languageOptiones.push(currentLanguageOption)
    }


    props.languages.map(language => {
        return <span key={language.language} className={"language-select "+ (language.language === firstTranslationState.rootFrameLanguage ? 'selected' : '')} onClick={e=>{
            e.preventDefault();
            onLanguageSelectionClick(firstTranslationState.rootFrameId, language.language)
        }}>{language.flag}</span>
    })

    async function onLanguageSelectionClick(frameNode: string, language: string) {
      await props.figmaHelper.updateLanguage(frameNode, language);
      await props.refreshKeys();
    }

    async function onCreateKeyFrameClick(frameNode: string) {
      await props.figmaHelper.toggleKeyFrame(frameNode);
      await props.refreshKeys();
    }

    async function onSampleValuesClick(frameNode: string) {
      await props.figmaHelper.toggleSampleValues(frameNode);
      await props.refreshKeys();
    }
    
  
    return (
    <section>
        
        <div className="header">
            <div className="frame-title font-body-11-bold">Frame</div>
            <div className="frame-info">
            
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
                        onSampleValuesClick(firstTranslationState.rootFrameId)
                    }}>
                  <div className={"variable-svg "+ sampleValues +' ' + (sampleValues == true ? 'active' : '')} ></div>
                </div>
                <Select
                    placeholder="Select item"
                    onChange={value => { onLanguageSelectionClick(firstTranslationState.rootFrameId, value.value as string) }}
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
           
            {rootFrameLanguage?.value && props.translationStates.map((translationState) => 
                <TranslationStateItem 
                    key={translationState.nodeId} 
                    translationState={translationState} 
                    refreshKeys= {props.refreshKeys}
                    figmaHelper={props.figmaHelper}
                    figmaRemote={props.figmaRemote}
                    />
            )}

            {rootFrameLanguage?.value === undefined && 
              <div>choose curent design language</div>
            }
        
    </section>
    )
}