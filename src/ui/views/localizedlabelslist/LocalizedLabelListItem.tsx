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

type LocalizedLabelListItemProps = {

    localizedLabel: LocalizedLabel,
    
    refreshKeys: Function
    figmaHelper: FigmaHelper,
    figmaRemote: FigmaUtil

    translationKeyStore: MemoryTranslationKeyStore,
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

    async function onPluralSelect(frameNode: string, nodeId: string, pluralId: string, translation: string) {
        await props.figmaHelper.updateTextNode(nodeId, translation, pluralId);
        await props.refreshKeys()
    }

    async function onUseLocalizedVersionClick(frameNode: string, nodeId: string, lokalizedText: string) {
        await props.figmaHelper.updateTextNode(nodeId, lokalizedText);
        await props.refreshKeys()
    }

    async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.updateKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText}]);
        await props.refreshKeys()
    }

    async function onCreateFromFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
        await props.translationKeyStore.createKey(key, [{ language: language as Language, plural: plural as Plural, text: figmaText}]);
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
        if (localizedLabel.selected && rowRef.current) {
          // tslint:disable-next-line
          (rowRef.current as any).scrollIntoViewIfNeeded(true);
        }
      }, [localizedLabel.selected]);

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
                                                
                                                await props.figmaHelper.updateTextNode(localizedLabel.nodeId, text);
                                                await props.refreshKeys()
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
                                                    onUseLocalizedVersionClick(localizedLabel.rootFrameId, localizedLabel.nodeId, localizedLabel.translataions![plural].translation!)
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
                                        
                                        {showPull && (
                                            <div className="circular-button" onClick={e => {
                                                    e.preventDefault(); 
                                                    onUseLocalizedVersionClick(localizedLabel.rootFrameId, localizedLabel.nodeId, localizedLabel.translataions![plural].translation!)
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