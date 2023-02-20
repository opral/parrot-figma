import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/icon-select'

type LocalizedLabelListItemProps = {
    translationState: LocalizedLabel,
    
    refreshKeys: Function
    figmaHelper: FigmaHelper,
    figmaRemote: FigmaUtil
}

export default function LocalizedLabelListItem(props: LocalizedLabelListItemProps) {
    let translationState = props.translationState;

    // enrich the translation state object
    let selectedState = translationState.selected ? 'selected' : '';

    let [showLocalizedText, setShowLocalizedText] = useState(false)
    const rowRef = React.useRef<HTMLDivElement>(null);
    
    let translations = translationState.translataions

    let keyExists = translationState.keyExists
    let localizedValueExists = translations && translations[translationState.pluralId] && translations[translationState.pluralId].translation !== undefined && translations[translationState.pluralId].translation !== ''

    let valuesDiffer = translationState.useSampleValues ? 
        translationState.text !== translationState?.translataions?.[translationState.pluralId]?.translationFilled : 
        translationState.text !== translationState?.translataions?.[translationState.pluralId]?.translation;

    let showPull = valuesDiffer && keyExists && localizedValueExists
    let showCreateKey = !keyExists
    let showPush = valuesDiffer && !showCreateKey && !translationState.useSampleValues

    let figmaTemplate = undefined as string | undefined

    let newPluralOptions = [] as SelectOption[];

    async function onPluralSelect(frameNode: string, nodeId: string, pluralId: string, translation: string) {
        await props.figmaHelper.updateTextNode(nodeId, translation, pluralId);
        await props.refreshKeys()
    }

    async function onUseLocalizedVersionClick(frameNode: string, nodeId: string, lokalizedText: string) {
        await props.figmaHelper.updateTextNode(nodeId, lokalizedText);
        await props.refreshKeys()
    }

    async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.figmaHelper.updateKey(key, language, plural, figmaText);
        await props.refreshKeys()
    }

    async function onCreateFromFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.figmaHelper.createKey(key, language, plural, figmaText);
        await props.refreshKeys()
    }

    async function onNodeSelect(nodeId: string) {
        await props.figmaRemote.scrollIntoViewIfNeeded(nodeId);
        await props.figmaRemote.selectNode(nodeId);
    }


    for (let plural of Object.values(Plural)) {
        const pluralOption = {
            value: plural, label: plural
        }
        
        if (translationState.plurals.indexOf(plural) === -1) {
            newPluralOptions.push(pluralOption)
        }
        
    }
    
    // TODO comment or refactor
    if (translationState.useSampleValues) {
        if (translationState?.translataions?.[translationState.pluralId].translation != translationState?.translataions?.[translationState.pluralId].translationFilled) {
            figmaTemplate = translationState?.translataions?.[translationState.pluralId].translation;
        }
    } else {
        if (translationState.text != translationState.figmaTextFilled) {
            figmaTemplate = translationState.text;
        }  
    }

    React.useEffect(() => {
        if (selectedState && rowRef.current) {
          // tslint:disable-next-line
          (rowRef.current as any).scrollIntoViewIfNeeded(true);
        }
      }, [selectedState]);

    return (
    <>
    <div ref={rowRef} className={"row " + (selectedState ? 'selected' :'')} onClick={(e) => {onNodeSelect(translationState.nodeId)}}>
            
            <div className="column key column-1">
                
              <div className="key-label">{translationState.key}</div>
            </div>
            <div className="column localized-text column-2">
              <table className="translations">
              <tbody>
                <tr>
                  <td className="language">
                    <span>{translationState.rootFrameLanguage}</span>                   
                  </td>
                  <td className="translation">
                    
                     <table className="translations">
                        <tbody>
                        {translationState.plurals!.map(pluralKey => {
                            return (
                                <tr key={pluralKey}>
                                        
                                    <td className="language">
                                    <span>{pluralKey}</span>                   
                                    </td>
                                    <td className="translation">
                                    <div className="translation-container translation">
                                        { pluralKey !== translationState.pluralId && 
                                        <div>
                                            <div>{translationState?.translataions?.[pluralKey]?.translationFilled}</div>
                                            <div style={{visibility: 
                                                translationState.translataions?.[pluralKey].translation == translationState.translataions?.[pluralKey].translationFilled ? 'hidden': 'visible'}}>{translationState.translataions?.[pluralKey].translation}</div>
                                        </div>
                                        }
                                        { pluralKey === translationState.pluralId && 
                                        <>
                                        <div>
                                            <div className="translation" style={{visibility: showLocalizedText ? 'hidden': 'visible'}}>{translationState.figmaTextFilled}</div>
                                            <div className="translation" style={{visibility: showLocalizedText ? 'hidden': 'visible'}}>{figmaTemplate}</div>
                                            
                                        </div>
                                        <div>
                                            <div className="translation" style={{visibility: !showLocalizedText ? 'hidden': 'visible'}}>{translationState.translataions?.[pluralKey].translationFilled}</div>
                                            <div className="translation" style={{visibility: !showLocalizedText || translationState.translataions?.[pluralKey].translationFilled == translationState.translataions?.[pluralKey].translation ? 'hidden': 'visible'}}>{translationState.translataions?.[pluralKey].translation}</div>
                                        </div>
                                        </>
                                        }
                                    </div>
                                    <div className="actions">
                                        {pluralKey !== translationState.pluralId && 
                                            <div className="circular-button"><div className="eye-svg"></div></div>
                                        }
                                        {pluralKey != translationState.pluralId && translationState.translataions?.[pluralKey].translationFilled && translationState.translataions?.[pluralKey].translation && 
                                            <div className="circular-button" onClick={(e) => onPluralSelect(translationState.rootFrameId, translationState.nodeId, pluralKey, translationState.useSampleValues ? translationState.translataions![pluralKey].translationFilled! : translationState.translataions![pluralKey].translation!)}>
                                            <div className="eye-closed-svg"></div>
                                            </div>
                                        }
                                        {showPull && (
                                            <div className="circular-button" onClick={e => {
                                                    e.preventDefault(); 
                                                    onUseLocalizedVersionClick(translationState.rootFrameId, translationState.nodeId, translationState.translataions![pluralKey].translation!)
                                                }}
                                                onMouseOut={e=>{
                                                    setShowLocalizedText(false)
                                                }}
                                                onMouseOver={e=>{
                                                    setShowLocalizedText(true)
                                                }}>
                                                <div className="download-svg"></div>
                                            </div>
                                        )}
                                        {showPush && (
                                            <div className="circular-button" onClick={e => {
                                                e.preventDefault(); 
                                                onSaveFigmaVersionClick(translationState.key, translationState.rootFrameLanguage, translationState.pluralId, translationState.text!)
                                            
                                             }}>
                                                <div className="upload-svg"></div>
                                            </div>
                                            
                                        )}
                                        {showCreateKey && (
                                            <div className="circular-button" onClick={e => {
                                                e.preventDefault(); 
                                                onCreateFromFigmaVersionClick(translationState.key, translationState.rootFrameLanguage, translationState.pluralId, translationState.text!)
                                            
                                            }}>
                                            <div className="create-svg"></div></div>
                                        )}
                                        {!showCreateKey && (
                                        <Select
                                            placeholder="Select item"
                                            onChange={value => { 
                                                onSaveFigmaVersionClick(translationState.key, translationState.rootFrameLanguage, value.value as string, translationState.text!)
                                             }}
                                            // defaultValue={rootFrameLanguage?.value}
                                            unSelectedIcon='language'
                                            options={newPluralOptions}
                                        />
                                        )}
                                    </div>
                                    
                                    </td>
                                </tr>
                            )
                            
                        })}
                     </tbody>
                        
                    </table>
                    
                  </td>
                </tr>
                </tbody> 
              </table>
            </div>
            
          </div>
    </>)              
}