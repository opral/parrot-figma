import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/base/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/selsect'
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

    console.log('localizedLabel');
    console.log(localizedLabel)
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
    let figmaTemplate = undefined as string | undefined

    let pluralsAvailable = [] as SelectOption[];

    async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.updateKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText}]);
        console.warn('onSaveFigmaVersionClick back prob not implemented')
    }

    async function onNodeSelect(nodeId: string) {
        await props.figmaRemote.scrollIntoViewIfNeeded(nodeId);
        await props.figmaRemote.selectNode(nodeId);
    }

    if (translations) {
    
        for (let plural of Object.keys(translations)) {
            
            const pluralOption = {
                value: plural, label: plural
            }
            
            pluralsAvailable.push(pluralOption)
            
        }
    } else {
        pluralsAvailable.push({
            value: Plural.Other, label: Plural.Other
        })
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
    <div ref={rowRef} className={"row " + (props.selected ? 'selected' :'')} onClick={(e) => {onNodeSelect(localizedLabel.nodeId)}}>
            <div className="column-1">
                <div className="localized-label">
                    <div className="spacer"></div>
                    <div className="spacer"></div>
                    <div className="element-symbol">
                        <div className="svg-container text-sign-svg"></div>
                    </div>
                    <div  className="element-name">{localizedLabel.name}</div>
                </div>
                
            </div>
            <div className="column localized-text column-2">
            
                <div className="translation-container">
                    <div className="localized-label-details">
                        <div className="key-panel">
                            <div className="key-panel-icon">
                                <div className="svg-container key-svg"></div>
                            </div>
                            <div className="translation-key">
                                <div className="key-label">{localizedLabel.key}</div>
                            </div>
                            
                              <Select
                                                    placeholder="Select item"
                                                    onChange={value => { 
                                                        onSaveFigmaVersionClick(localizedLabel.key, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!)
                                                    }}
                                                    defaultValue={localizedLabel.pluralId}
                                                    unSelectedIcon='language'
                                                    options={pluralsAvailable}
                                                />
                            
                        </div>
                    </div>
                    <TranslationEditor
                        onSave={async function(text: any) {
                            if (!keyExists) {
                                await props.translationKeyStore.createKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: localizedLabel.pluralId, text: text}]);
                            } else {
                                await props.translationKeyStore.updateKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: localizedLabel.pluralId, text: text}]);
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
            </div>
            
          </div>
    </>)              
}