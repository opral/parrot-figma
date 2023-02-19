import * as React from "react";
import { useState } from "react";
import { Language } from "../../../lib/base/Language";
import { Plural } from "../../../lib/base/Plural";
import { TranslationKey } from "../../../lib/base/TranslationKey";

import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import Select, { SelectOption } from '../../compontents/select/icon-select'
import TranslationKeyEditor from "./TranslationKeyEditor";

type TranslationKeyViewProps = {
    translationKey: TranslationKey,
    
    refreshKeys: Function
    figmaHelper: FigmaHelper,
    figmaRemote: FigmaUtil
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
    <>
    <div ref={rowRef} className={"row"}>
            
            <div className="column key column-1">
                
              <div className="key-label">{translationKey.keyName}</div>
            </div>
            <div className="column localized-text column-2">
              <table className="translations">
              <tbody>
              {Object.keys(translationKey.translations).map((language) => { return (
                <tr key={language}>
                  <td className="language">
                    <span>{language}</span>                   
                  </td>
                  <td className="translation">
                    
                     <table className="translations">
                        <tbody>
                        {Object.keys(translationKey.translations[language as Language]!).map(pluralKey => {
                            return (
                                <tr key={pluralKey}>
                                        
                                    <td className="language">
                                    <span>{pluralKey}</span>                   
                                    </td>
                                    <td className="translation">
                                    <div className="translation-container translation">
                                        
                                        <TranslationKeyEditor
                                            keyName={translationKey.keyName}
                                            plural={pluralKey}
                                            language={language}
                                            text={translationKey.translations[language as Language]![pluralKey as Plural]!.text}
                                            figmaHelper={props.figmaHelper}
                                            refreshKeys={props.refreshKeys}
                                        />
                                        
                                    </div>
                                    
                                    
                                    </td>
                                </tr>
                            )
                            
                        })}
                     </tbody>
                        
                    </table>
                    
                  </td>
                </tr>)
                })}
                </tbody> 
              </table>
            </div>
            
          </div>
    </>)              
}