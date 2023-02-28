import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/selsect'
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { Language } from "../../../lib/base/Language";
import TranslationEditor from "../../compontents/translationEditor/TranslationEditor";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import TextField from "../../compontents/textfield/TextField";

type LocalizedLabelListItemProps = {

    localizedLabel: LocalizedLabel,
    figmaRemote: FigmaUtil,
    localisedLabelManager: LocalizedLabelManagerUI,

    translationKeyStore: MemoryTranslationKeyStore,
    selected: boolean
}

export default function LocalizedLabelListItem(props: LocalizedLabelListItemProps) {

    let localizedLabel = props.localizedLabel;
    let translatedKey = localizedLabel.keyType !== 'unset' ? props.translationKeyStore.getKey(localizedLabel.key!) : undefined;

    let [editingTrigger, setEditingTrigger] = useState(0)
    const rowRef = React.useRef<HTMLDivElement>(null);
    
    let keyExists = translatedKey !== undefined;
    let translations = translatedKey?.translations[localizedLabel.rootFrameLanguage]
    let localizedText = translations?.[localizedLabel.pluralId]?.text
    
    let localizedTextToApply = localizedText

    if (localizedText !== undefined && localizedLabel.useSampleValues) {
        localizedTextToApply = props.translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
    }

    let keyOptions = [
        {
            value: 'select-for-link',
            label: 'Select existing Translation key',
            icon: 'key-svg'
        },
        {
            value: 'set-id-for-derivation',
            label: 'Set label id for derivation',
            icon: 'key-svg'
        },
        {
            value: "",
            label: 'jo',
            divider: 'test'
        },
    ];

    if (localizedLabel.key !== undefined || localizedLabel.derivedKey !== undefined) {
        if (localizedLabel.key !== undefined) {
            keyOptions.push({
                value: 'linked',
                label: localizedLabel.key + ' - linked',
                icon: 'key-svg'
            })
        }

        if (localizedLabel.derivedKey !== undefined) {
            keyOptions.push( {
                value: 'derived',
                label: localizedLabel.derivedKey + ' - derived',
                icon: 'key-svg'
            });
        }

        keyOptions.push(
        {
            value: "",
            label: 'jo',
            divider: 'test'
        });
    }

    keyOptions.push(
        {
            value: 'ephemeral',
            label: 'No key',
            icon: 'key-svg'
        });

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
                    <TextField 
                        editingTrigger={editingTrigger}
                        onSave={(e: any) => console.log}
                        text={localizedLabel.name}
                        />
                    
                </div>
                
            </div>
            <div className="column localized-text column-2">
            
                <div className="translation-container">
                    <div className="localized-label-details">
                        <div className="key-panel">
                            <Select
                                                    placeholder="Select key"
                                                    onChange={selectOption => { 
                                                        console.log('selectOption---------------------------------->')
                                                        console.log(selectOption)
                                                        console.log('selectOption----------------------------------<')
                                                        if (selectOption.value === 'set-id-for-derivation') {
                                                            setEditingTrigger((trigger) => trigger + 1);
                                                        }
                                                        // onSaveFigmaVersionClick(localizedLabel.key!, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!)
                                                        
                                                    }}
                                                    defaultValue={localizedLabel.keyType}
                                                    options={keyOptions}
                                                    unSelectedIcon='language'
                                                    
                                                />
                            {localizedLabel.key && (
                              <Select
                                                    placeholder="Select item"
                                                    onChange={value => { 
                                                        onSaveFigmaVersionClick(localizedLabel.key!, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!)
                                                    }}
                                                    defaultValue={localizedLabel.pluralId}
                                                    unSelectedIcon='language'
                                                    options={pluralsAvailable}
                                                />
                                                )}
                        </div>
                    </div>
                    <TranslationEditor
                        onSave={async function(text: any) {
                            if (keyExists === true) {
                                await props.translationKeyStore.updateKey(localizedLabel.key!, [{ language: localizedLabel.rootFrameLanguage, plural: localizedLabel.pluralId, text: text}]);
                            } else {
                               // TODO  await props.translationKeyStore.createKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: localizedLabel.pluralId, text: text}]);
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