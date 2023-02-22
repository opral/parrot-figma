import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/icon-select'
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { Language } from "../../../lib/base/Language";
import TranslationEditor from "../../compontents/translationEditor/TranslationEditor";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";

type LocalizedLabelListItemProps = {

    localizedLabel: LocalizedLabel,
    figmaRemote: FigmaUtil,
    localisedLabelManager: LocalizedLabelManagerUI,

    translationKeyStore: MemoryTranslationKeyStore,
    selected: boolean
}

export default function LocalizedLabelListItem(props: LocalizedLabelListItemProps) {
    let localizedLabel = props.localizedLabel;
    let translatedKey = props.translationKeyStore.getKey(localizedLabel.key);

    let [showLocalizedText, setShowLocalizedText] = useState(false)
    const rowRef = React.useRef<HTMLDivElement>(null);
    
    
    let keyExists = translatedKey !== undefined;
    let translations = translatedKey?.translations[localizedLabel.rootFrameLanguage]
    let localizedText = translations?.[localizedLabel.pluralId]?.text
    
    let localizedTextToApply = localizedText

    if (localizedText !== undefined && localizedLabel.useSampleValues) {
        localizedTextToApply = props.translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
    }

    let showPull = keyExists && localizedTextToApply && localizedLabel.text != localizedTextToApply
    let showCreateKey = !keyExists
    let showPush = keyExists && (!localizedLabel.useSampleValues || localizedLabel.rootFrameUseSampleValues) && localizedLabel.text != localizedText

    let figmaTemplate = undefined as string | undefined

    let newPluralOptions = [] as SelectOption[];

    async function onUseLocalizedVersionClick(frameNode: string, nodeId: string, lokalizedText: string) {
        await props.localisedLabelManager.updateLocalisedLabelProperties(nodeId, {
            plural: localizedLabel.pluralId,
            showSampleValues: localizedLabel.useSampleValues,
            showSampleValuesInherited: localizedLabel.rootFrameUseSampleValues,
            text: lokalizedText
        });
        console.warn('onUseLocalizedVersionClick back prob not implemented')
        
    }

    async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.updateKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText}]);
        console.warn('onSaveFigmaVersionClick back prob not implemented')
    }

    async function onCreateFromFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.createKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText}]);
        console.warn('onCreateFromFigmaVersionClick back prob not implemented')
    }

    async function onNodeSelect(nodeId: string) {
        await props.figmaRemote.scrollIntoViewIfNeeded(nodeId);
        await props.figmaRemote.selectNode(nodeId);
    }


    for (let plural of Object.values(Plural)) {
        const pluralOption = {
            value: plural, label: plural
        }
        
        if (localizedLabel.plurals.indexOf(plural) === -1) {
            newPluralOptions.push(pluralOption)
        }
        
    }
    
    // TODO comment or refactor
    if (localizedLabel.useSampleValues) {
        if (localizedLabel?.translataions?.[localizedLabel.pluralId].translation != localizedLabel?.translataions?.[localizedLabel.pluralId].translationFilled) {
            figmaTemplate = localizedLabel?.translataions?.[localizedLabel.pluralId].translation;
        }
    } else {
        if (localizedLabel.text != localizedLabel.figmaTextFilled) {
            figmaTemplate = localizedLabel.text;
        }  
    }

    React.useEffect(() => {
        if (props.selected && rowRef.current) {
          // tslint:disable-next-line
          (rowRef.current as any).scrollIntoViewIfNeeded(true);
        }
      }, [props.selected]);

    return (
    <>
    <div ref={rowRef} className={"row " + (localizedLabel.selected ? 'selected' :'')} onClick={(e) => {onNodeSelect(localizedLabel.nodeId)}}>
            
            <div className="column key column-1">
              <div className="label-name">{localizedLabel.name}</div>
              <div className="key-label">{localizedLabel.key}</div>
            </div>
            <div className="column localized-text column-2">
              <table className="translations">
              <tbody>
                <tr>
                  <td className="language">
                    <span>{localizedLabel.rootFrameLanguage}</span>                   
                  </td>
                  <td className="translation">
                    
                     <table className="translations">
                        <tbody>
                        {localizedLabel.plurals!.map(plural => {
                            return (
                                <tr key={plural}>
                                    <td className="language">
                                        <span>{plural}</span>                   
                                    </td>
                                    <td className="translation">
                                    { plural === localizedLabel.pluralId && (
                                    <>
                                    <div className="translation-container translation">
                                        <TranslationEditor
                                            onSave={async function(text: any) {
                                                if (!keyExists) {
                                                    await props.translationKeyStore.createKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: plural, text: text}]);
                                                } else {
                                                    await props.translationKeyStore.updateKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: plural, text: text}]);
                                                }

                                                let textToApplyToDesign = localizedLabel.useSampleValues || localizedLabel.rootFrameUseSampleValues ?
                                                    props.translationKeyStore.fillPlaceholdersWithSampleData(text, localizedLabel.rootFrameLanguage, localizedLabel.pluralId) :
                                                    text;
                                                
                                                await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
                                                    plural: localizedLabel.pluralId,
                                                    showSampleValues: localizedLabel.useSampleValues,
                                                    showSampleValuesInherited: localizedLabel.rootFrameUseSampleValues,
                                                    text: textToApplyToDesign
                                                });
                                                console.warn('onSave back prob not implemented')
                                            }}
                                            text={localizedText}
                                            designText={localizedLabel.text}

                                        />
                                    </div>
                                    <div className="actions">
                                        
                                        <div className="circular-button">
                                            <div className="eye-svg"></div>
                                        </div>
                                        
                                        {showPull && (
                                            <div className="circular-button" onClick={e => {
                                                    e.preventDefault(); 
                                                    onUseLocalizedVersionClick(localizedLabel.rootFrameId, localizedLabel.nodeId, localizedTextToApply!)
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
                                                onSaveFigmaVersionClick(localizedLabel.key, localizedLabel.rootFrameLanguage, localizedLabel.pluralId, localizedLabel.text!)
                                             }}>
                                                <div className="upload-svg"></div>
                                            </div>
                                            
                                        )}
                                        {showCreateKey && (
                                            <div className="circular-button" onClick={e => {
                                                e.preventDefault(); 
                                                onCreateFromFigmaVersionClick(localizedLabel.key, localizedLabel.rootFrameLanguage, localizedLabel.pluralId, localizedLabel.text!)                                            
                                             }}>
                                                <div className="create-svg"></div>
                                            </div>
                                        )}
                                        {!false && (
                                        <Select
                                            placeholder="Select item"
                                            onChange={value => { 
                                                onSaveFigmaVersionClick(localizedLabel.key, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!)
                                             }}
                                            // defaultValue={rootFrameLanguage?.value}
                                            unSelectedIcon='language'
                                            options={newPluralOptions}
                                         />
                                        )}
                                    </div>
                                    
                                    </>
                                    )}

                                    { plural !== localizedLabel.pluralId && (
                                    <>
                                    <div className="translation-container translation">
                                        <div>
                                            <div>{translations?.[plural]?.text ? translations![plural]!.text! : 'Unset'}</div>
                                        </div>
                                        <div>
                                            <div className="translation" style={{visibility: showLocalizedText ? 'hidden': 'visible'}}>{localizedLabel.text}</div>
                                        </div>
                                    </div>
                                    <div className="actions">
                                        
                                        <div className="circular-button">
                                            <div className="eye-svg"></div>
                                        </div>
                                        
                                        
                                        {!false && (
                                        <Select
                                            placeholder="Select item"
                                            onChange={value => { 
                                                onSaveFigmaVersionClick(localizedLabel.key, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!)
                                             }}
                                            // defaultValue={rootFrameLanguage?.value}
                                            unSelectedIcon='language'
                                            options={newPluralOptions}
                                         />
                                        )}
                                    </div>
                                    
                                    </>
                                    )}
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