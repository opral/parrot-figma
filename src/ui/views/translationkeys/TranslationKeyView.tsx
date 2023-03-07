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

type TranslationKeyViewProps = {
    languages: Language[],
    translationKey: TranslationKey,
    showHistory: Function
    figmaRemote: FigmaUtil,
    translationKeyStore: MemoryTranslationKeyStore
}

export default function TranslationKeyView(props: TranslationKeyViewProps) {
    let translationKey = props.translationKey;

    let [showLocalizedText, setShowLocalizedText] = useState(false)
    let [editingState, setEditingState] = useState(false)

    const rowRef = React.useRef<HTMLDivElement>(null);
    
    let translations = translationKey.translations

    console.log('TranslationStateItem');
    console.log(translationKey)

    let figmaTemplate = undefined as string | undefined

    let newPluralOptions = [] as SelectOption[];

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
        <div ref={rowRef} className="keyWrapper">
            <div className="grid-item-key">                
                <label className="checkboxHitbox">
                    <input id="fix-position-when-scrolling" type="checkbox" className="checkboxInput" />
                    <span className="svg-container checkbox--checkmark checkbox--checked checkbox--checkmark mixed_checkbox--checkmark"><svg className="svg" width="8" height="8" viewBox="0 0 8 8" xmlns="http://www.w3.org/2000/svg"><path d="M1.176 2.824L3.06 4.706 6.824.941 8 2.118 3.059 7.059 0 4l1.176-1.176z" fill-rule="evenodd" fill-opacity="1" fill="#fff" stroke="none"></path></svg></span>
                </label>    
                <span className="layerIcon iconWrapper">
                    <span className="svg-container checkbox">
                        <svg className="svg" width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M4 .5V3h4V.5h1V3h2.5v1H9v4h2.5v1H9v2.5H8V9H4v2.5H3V9H.5V8H3V4H.5V3H3V.5h1zM8 8V4H4v4h4z" fill-rule="evenodd" fill-opacity="1" fill="#000" stroke="none"></path></svg>
                    </span>
                </span>
                <span className="rowText">{translationKey.keyName}</span>
            </div>
            {props.languages.map((language) => { return (
            <div className="languageWrapper" key={language}>
                <div className="grid-item-language"><span className="rowText">{language}</span></div>
                {translationKey.translations[language as Language] && Object.keys(translationKey.translations[language as Language]!).map((pluralKey, i, plurals) => {
                return (
                    <div className={"keyPluralWrapper " + (plurals.length == 1 ? 'onePlural' :' multiplePlurals')}>
                        <div className="grid-item-plural"><span className="rowText">{pluralKey}</span></div>
                        <div className="grid-item-translation translation-container translation">
                            <TranslationKeyEditor
                                        keyName={translationKey.keyName}
                                        translationKeyStore={props.translationKeyStore}
                                        plural={pluralKey}
                                        language={language}
                                        text={translationKey.translations[language as Language]![pluralKey as Plural]!.text}
                                        
                                    />
                        </div>
                        <div className="grid-item-actions">
                            <span className="layerIcon iconWrapper" onClick={() => { props.showHistory(translationKey.keyName, language, pluralKey) }}>
                                <span className="svg-container checkbox">
                                    <svg className="svg" width="12" height="12" viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg"><path d="M4 .5V3h4V.5h1V3h2.5v1H9v4h2.5v1H9v2.5H8V9H4v2.5H3V9H.5V8H3V4H.5V3H3V.5h1zM8 8V4H4v4h4z" fill-rule="evenodd" fill-opacity="1" fill="#000" stroke="none"></path></svg>
                                </span>
                            </span>
                        </div>
                    </div>
                )})}
            </div>
            )})}
      </div>
    )              
}