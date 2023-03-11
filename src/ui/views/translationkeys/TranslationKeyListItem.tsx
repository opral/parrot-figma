/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-associated-control */
import * as React from 'react';
import { useState } from 'react';
import Language from '../../../lib/base/Language';
import Plural from '../../../lib/base/Plural';
import { TranslationKey } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import MatchView from '../../compontents/matchview/MatchView';

type TranslationKeyListItemProps = {
  languages: Language[],
  translationKey: TranslationKey,
  showHistory: Function,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  translationKeyStore: MemoryTranslationKeyStore,
  localizedLabelManager: LocalizedLabelManagerUI,
};

export default function TranslationKeyListItem({
  languages,
  translationKey,
  showHistory,
  figmaRemote,
  searchMatch,
  translationKeyStore,
  localizedLabelManager,
}: TranslationKeyListItemProps) {
  const [selected, setSelected] = useState(false);
  const [showUsage, setShowUsage] = useState(false);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = localizedLabelManager.getLabelsWithKey(translationKey.keyName);

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId);
    await figmaRemote.selectNode(nodeId);
  }

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
    <div ref={rowRef} className={`keyWrapper${selected ? ' selected' : ''}`}>
      <div className="grid-item-selector">
        <label className="checkboxHitbox">
          <input id="fix-position-when-scrolling" type="checkbox" className="checkboxInput" onChange={(e) => { setSelected(e.target.checked); }} />
          <span className={`svg-container checkbox-svg checkbox--checkmark checkbox--checkmark mixed_checkbox--checkmark${selected ? ' checkbox--checked' : ''}`} />
        </label>
      </div>
      <div className="grid-item-key">
        <div className="grid-item-key-header">
          <span className="layerIcon iconWrapper">
            <span className="svg-container key-svg" />
          </span>
          <span className="rowText"><MatchView text={translationKey.keyName} match={searchMatch?.key} /></span>
        </div>
        <div className="grid-item-actions">
          <span
            className="layerIcon iconWrapper button"
            onClick={() => {
              translationKeyStore.deleteKey(translationKey.keyName);
            }}
          >
            <span className="svg-container trash-svg" />
          </span>
        </div>

        <div className="key-usage">
          {referencingLabels.length === 0 && <div>no usage</div>}
          {referencingLabels.length > 0 && (
            <>
              <div className="collapsible-header" onClick={() => setShowUsage((value) => !value)}>
                <div className={`svg-container${showUsage ? 'expand-svg' : 'collapse-svg'}`} />
                <div className="title">Usage</div>
              </div>
              {showUsage && referencingLabels.map((label) => (

                <div className="localized-label" onClick={() => onNodeSelect(label.nodeId)}>
                  <div className="spacer" />
                  <div className="element-symbol">
                    <div className="svg-container number-sign-svg" />
                  </div>
                  <div className="name">{label.rootFrameName}</div>
                </div>

              ))}
            </>
          )}
        </div>

      </div>
      {languages.map((language) => {
        let languageSkipped = false;
        if (translationKey.translations[language as Language] !== undefined) {
          for (const plural of Object.keys(translationKey.translations[language as Language]!)) {
            if (translationKey.translations[language as Language]![plural as Plural]!.skip !== true) {
              languageSkipped = false;
              break;
            } else {
              languageSkipped = true;
            }
          }
        }

        return (
          <div className={`languageWrapper${languageSkipped ? ' skipped ' : ''}`} key={language}>
            <div className="grid-item-language"><span className="rowText">{language}</span></div>
            {translationKey.plurals.map((plural) => (
              <div className={`keyPluralWrapper ${translationKey.plurals.length === 1 ? 'onePlural' : ' multiplePlurals'}${translationKey.translations[language as Language]?.[plural as Plural]?.skip === true ? ' skipped' : ''}`}>
                <div className="grid-item-plural"><span className="rowText">{plural}</span></div>
                <div className="grid-item-translation translation-container translation">
                  <TranslationEditor
                    match={searchMatch?.[language]?.[plural as Plural]}
                    onSave={async (text: any) => {
                      let skip = translationKey.translations[language as Language]?.[plural as Plural]?.skip ?? false;

                      if (text !== undefined && text !== '') {
                        skip = false;
                      }
                      await translationKeyStore.updateKey(translationKey.keyName!, [{
                        language, plural: plural as Plural, text, skip,
                      }]);
                    }}
                    text={translationKey.translations[language as Language]?.[plural as Plural]?.text}
                  />

                </div>
                <div className="grid-item-actions">
                  <span
                    className="layerIcon iconWrapper button"
                    onClick={async () => {
                      // debugger;
                      await translationKeyStore.updateKey(translationKey.keyName!, [{
                        language,
                        plural,
                        text: translationKey.translations[language as Language]?.[plural as Plural]?.text,
                        skip: translationKey.translations[language as Language]?.[plural as Plural]?.skip === undefined ? true : !translationKey.translations[language as Language]![plural as Plural]!.skip,
                      }]);
                    }}
                  >
                    <span className="svg-container eye-svg" />
                  </span>
                  <span
                    className="layerIcon iconWrapper button"
                    onClick={async () => {
                      showHistory(translationKey.keyName, language, plural);
                    }}
                  >
                    <span className="svg-container history-svg" />
                  </span>
                </div>
              </div>
            ))}
          </div>
        );
      })}
      <div className="grid-item-language" style={{ height: '10px' }} />
    </div>
  );
}
