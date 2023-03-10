import * as React from "react";
import { useState } from "react";
import { Language } from "../../../lib/base/Language";
import { Plural } from "../../../lib/base/Plural";
import { TranslationKey } from "../../../lib/keystore/TranslationKey";
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/select'
import TranslationKeyEditor from "./TranslationKeyEditor";
import TranslationEditor from "../../compontents/translationEditor/TranslationEditor";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import MatchView from "../../compontents/matchview/MatchView";
import { match } from "assert";

type TranslationKeyListItemProps = {
    languages: Language[],
    translationKey: TranslationKey,
    showHistory: Function
    figmaRemote: FigmaUtil,
    searchMatch: any,
    translationKeyStore: MemoryTranslationKeyStore
    localisedLabelManager: LocalizedLabelManagerUI
}

export default function TranslationKeyListItem(props: TranslationKeyListItemProps) {
    let translationKey = props.translationKey;

    let [showLocalizedText, setShowLocalizedText] = useState(false)
    let [editingState, setEditingState] = useState(false)
    let [selected, setSelected] = useState(false)
    let [showUsage, setShowUsage] = useState(false)

    const rowRef = React.useRef<HTMLDivElement>(null);
    
    let translations = translationKey.translations
    let figmaTemplate = undefined as string | undefined

    let newPluralOptions = [] as SelectOption[];

    let referencingLabels = props.localisedLabelManager.getLabelsWithKey(props.translationKey.keyName);

    async function onNodeSelect(nodeId: string) {
        await props.figmaRemote.scrollIntoViewIfNeeded(nodeId);
        await props.figmaRemote.selectNode(nodeId);
    }

    let editing: any | undefined
/*
    for (let plural of Object.values(Plural)) {
        const pluralOption = {
            value: plural, label: plural
        }
        
        if (translationState.plurals.indexOf(plural) === -1) {
            newPluralOptions.push(pluralOption)
        }
        
    }
*/


    return (
        <div ref={rowRef} className={"keyWrapper" + (selected ? ' selected' : '') } >
            <div className="grid-item-selector">    
                <label className="checkboxHitbox">
                    <input id="fix-position-when-scrolling" type="checkbox" className="checkboxInput" onChange={e=> {setSelected(e.target.checked)}} />
                    <span className={"svg-container checkbox-svg checkbox--checkmark checkbox--checkmark mixed_checkbox--checkmark" + (selected ? ' checkbox--checked' : '') }  />
                </label>    
            </div>
            <div className="grid-item-key">     
                <div className="grid-item-key-header">
                    <span className="layerIcon iconWrapper">
                        <span className="svg-container key-svg" />
                    </span>
                    <span className="rowText"><MatchView text={translationKey.keyName} match={props.searchMatch?.key}></MatchView></span>
                </div>
                <div className="grid-item-actions">
                        <span className="layerIcon iconWrapper button" onClick={() => { props.translationKeyStore.deleteKey(translationKey.keyName); }}>
                            <span className="svg-container trash-svg">
                                
                            </span>
                        </span>
                    </div>

                <div className="key-usage">
                    {referencingLabels.length == 0 && <div>no usage</div>}
                    {referencingLabels.length > 0 && (
                        <>
                    <div className="collapsible-header" onClick={() => setShowUsage(value => !value)}>
                        <div className={"svg-container"+ (showUsage ? "expand-svg" : "collapse-svg")}></div>
                        <div className="title">Usage</div>
                    </div>
                    {showUsage && referencingLabels.map(label => (
                    
                    <div className="localized-label" onClick={() => onNodeSelect(label.nodeId)}>
                        <div className="spacer"></div>
                        <div className="element-symbol">
                            <div className="svg-container number-sign-svg"></div>
                        </div>
                        <div className="name">{label.rootFrameName}</div>
                    </div>
                    
                    ))}
                    </>
                    )}
                </div>
                
            </div>
            {props.languages.map((language) => { return (
            <div className="languageWrapper" key={language}>
                <div className="grid-item-language"><span className="rowText">{language}</span></div>
                {translationKey.translations[language as Language] && Object.keys(translationKey.translations[language as Language]!).map((pluralKey, i, plurals) => {
                return (
                <div className={"keyPluralWrapper " + (plurals.length == 1 ? 'onePlural' :' multiplePlurals')}>
                    <div className="grid-item-plural"><span className="rowText">{pluralKey}</span></div>
                    <div className="grid-item-translation translation-container translation">
                    <TranslationEditor
                        match={props.searchMatch?.[language]?.[pluralKey as Plural]}
                        onSave={async function(text: any) {
                            let updatedTranslationKey = await props.translationKeyStore.updateKey(translationKey.keyName!, [{ language: language, plural: pluralKey as Plural, text: text}]);
                        }}
                        text={translationKey.translations[language as Language]![pluralKey as Plural]!.text}
                    />
                        
                    </div>
                    <div className="grid-item-actions">
                        <span className="layerIcon iconWrapper button" onClick={() => { props.showHistory(translationKey.keyName, language, pluralKey) }}>
                            <span className="svg-container history-svg">
                                
                            </span>
                        </span>
                    </div>
                </div>
                )})}
            </div>
            )})}
            <div className="grid-item-language" style={{height: "10px"}}></div>
      </div>
    )              
}