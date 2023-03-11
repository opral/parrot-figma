import * as React from "react";
import { useState } from "react";
import * as ReactDOM from "react-dom";
import { Plural } from "../../../lib/base/Plural";
import { KeyState, LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/select'
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
    /* 

    initial state of a frame - never got translated initial action 
     - all keys are unset 



    option1: Labels key is unset
        -- provide option to choose 
            - from existing keys -> search -> use/create -> fixed
            - derived (derived or rename label name)

        - derivedKey === undefined   

        - derived key exists in keystore
            - language does not extist in key store
            - selected plural (other than 'other' - because other is always created with the language) does not exist
            - design text differs from the translation
            - design and translation are equal

        - derived does not exist in keystore

    option 3: Labels key is ephemeral

    option 4: Labels key is derived
        - derived key differs from key (component was moved in hirachy or renamed)
            Resolution
            - change key to linked and use existing or chosse different
            - use derived key

    option 5: Labels key is linked 
        - key exists in keystore
            - language does not extist in key store
            - selected plural (other than 'other' - because other is always created with the language) does not exist
            - design text differs from the translation
            - design and translation are equal
        
        - key does not exist in keystore


    option4: 
            

    Open questions how does copy behave?
        - when the labels key is fixed 
            - keep config
        - when the labeles key is derived 
            - keep config but use derived key until first save?
    */

    let localizedLabel = props.localizedLabel;
    let translatedKey = localizedLabel.keyType !== KeyState.Unset ? props.translationKeyStore.getKey(localizedLabel.key!) : undefined;

    let [editingLabelNameTrigger, setEditingNameTrigger] = useState(0)
    let [editingLabelKeyTrigger, setEditingKeyTrigger] = useState(0)
    const rowRef = React.useRef<HTMLDivElement>(null);
    
    let keyExists = translatedKey !== undefined;
    let translations = translatedKey?.translations[localizedLabel.rootFrameLanguage]
    let localizedText = translations?.[localizedLabel.pluralId]?.text
    
    let localizedTextToApply = localizedText

    if (localizedText !== undefined && localizedLabel.useSampleValues) {
        localizedTextToApply = props.translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
    }

    let pluralsAvailable = [] as SelectOption[];

    async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.updateKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText, skip: false}]);
        console.warn('onSaveFigmaVersionClick back prob not implemented')
    }

    async function onNodeSelect(nodeId: string) {
        await props.figmaRemote.scrollIntoViewIfNeeded(nodeId);
        await props.figmaRemote.selectNode(nodeId);
    }

    async function linkKey(keyToLinkTo: string) {
        let translationKey = props.translationKeyStore.getKey(keyToLinkTo)
                                    
        if (translationKey != undefined) {
            await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
                key: keyToLinkTo,
                keyType: KeyState.Linked,
                keyVersion: translationKey.latestVersion
            });

            // TODO check if design is sync with translation - if not offer update with prompt
        } else {
            translationKey = await props.translationKeyStore.createKey(keyToLinkTo, [{ 
                language: localizedLabel.rootFrameLanguage, 
                plural: localizedLabel.pluralId, 
                text: localizedLabel.text,
                skip: false
            }])
            await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
                key: keyToLinkTo,
                keyType: KeyState.Linked,
                keyVersion: translationKey.latestVersion
            });
        }
        await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
            keyType: KeyState.Linked,
            keyVersion: translationKey.latestVersion
        });
    }

    async function unlinkKey(keyName?: string) {
        await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
            key: keyName,
            keyType: KeyState.Unlinked
        });
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
    <div ref={rowRef} className={"row" + (props.selected ? ' selected ' :'') + (localizedLabel.keyType === KeyState.Unlinked ? ' key-unset ' : ' key-set ')} onClick={(e) => {onNodeSelect(localizedLabel.nodeId)}}>
            <div className="column-1">
                <div className="localized-label">
                    <div className="spacer"></div>
                    <div className="spacer"></div>
                    <div className="element-symbol">
                        <div className="svg-container text-sign-svg"></div>
                    </div>
                    <TextField 
                        singleClick={false}
                        onSave={async function(labelName: string) {
                            await props.localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
                                labelName: labelName
                            });
                        }}
                        text={localizedLabel.name}
                        />
                    
                </div>
                
            </div>
            <div className="column localized-text column-2">
            
                <div className="translation-container">
                    <div className="localized-label-details">
                        <div className="key-panel">
                            <TextField 
                                icon="key-svg"
                                singleClick={true}
                                onSave={async function(key: string) {
                                

                                    if (key === '') {
                                        unlinkKey(undefined);
                                    } else {
                                        linkKey(key);
                                    }
                                    
                                }}
                                text={localizedLabel.key !== undefined ? localizedLabel.key : localizedLabel.derivedKey }
                                placeholder="Keyname..."
                                onSearchClick={()=>{ }}
                                />
                            <span className="layerIcon iconWrapper button" onClick={async () => {  

                                let keyToSet = localizedLabel.key !== undefined ? localizedLabel.key : localizedLabel.derivedKey;

                                if (keyToSet !== undefined) {
                                    if (localizedLabel.keyType === KeyState.Unlinked) {
                                        await linkKey(keyToSet);
                                    } else {
                                        await unlinkKey(localizedLabel.key);
                                    }
                                } else {
                                    // TODO focus key input since we have no key we can use for link 
                                    console.warn(' TOOD focus key input! ');
                                }
                                   
                            }}>
                                <span className={"svg-container " + (localizedLabel.keyType === KeyState.Unlinked ? 'unlinked-svg' : 'linked-svg')}/>
                            </span>
                            
                            {localizedLabel.keyType !== KeyState.Unlinked && (
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
                            /*let translationKey;
                            if (keyExists === true) {
                                translationKey = await props.translationKeyStore.updateKey(localizedLabel.key!, [{ 
                                    language: localizedLabel.rootFrameLanguage, 
                                    plural: localizedLabel.pluralId, 
                                    text: text,

                                }]);
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
                                text: textToApplyToDesign,
                                keyVersion: translationKey?.latestVersion
                            });*/
                            console.warn('TODO onSave back prob not implemented')
                        }}
                        text={localizedLabel.text}
                        match={undefined}
                    />
                </div>   
            </div>
            
          </div>
    </>)              
}
