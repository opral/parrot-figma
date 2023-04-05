/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable prefer-template */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-associated-control */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import OutsideClickHandler from 'react-outside-click-handler';
import { Language } from '../../../lib/base/Language';
import { Plural, pluralArrayByLanguage } from '../../../lib/base/Plural';
import { HistoryEntry, TranslationKey } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import MatchView from '../../compontents/matchview/MatchView';
import HistoryEntryView from '../../compontents/history/HistoryEntryView';

type TranslationKeyListItemProps = {
  translationKey: TranslationKey,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  translationKeyStore: MemoryTranslationKeyStore,
  localizedLabelManager: LocalizedLabelManagerUI,
  select?: Function
};

export default function TranslationKeyListItem({
  translationKey,
  figmaRemote,
  searchMatch,
  translationKeyStore,
  localizedLabelManager,
  select,
}: TranslationKeyListItemProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [history, setHistory] = useState<undefined | HistoryEntry[]>(undefined);

  const [showHistory, setShowHistory] = useState<undefined | { language: Language, plural: Plural }>(undefined);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = localizedLabelManager.getLabelsWithKey(translationKey.keyName);

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId);
    await figmaRemote.selectNode(nodeId);
  }

  const baseLang = translationKeyStore.getBaseLanugage();

  // create an array of languages with baselanguage at position zero
  const languages = [baseLang, ...translationKeyStore.getLanugages()!.filter((l) => l !== baseLang)] as Language[];

  const onShowHistoryClick = (language: Language, plural: Plural) => {
    translationKeyStore.parentKeyStore.getHistory(translationKey.keyName).then((historyEntries) => {
      const specificHistory = [] as HistoryEntry[];

      // filter relevant history changes for the given key
      for (const keyHistoryEntry of historyEntries) {
        if (keyHistoryEntry.translations?.[language]?.[plural] !== undefined) {
          specificHistory.push(keyHistoryEntry);
        }
      }

      setHistory(specificHistory.reverse());
      setShowHistory({ language, plural });
    });
  };

  return (
    <div
      ref={rowRef}
      className={`keyWrapper${selected ? ' selected' : ''}`}
      onClick={() => {
        if (select) {
          select(translationKey.keyName);
        }
      }}
    >
      { select === undefined && false && (
      <div className="grid-item-selector">
        <label className="checkboxHitbox">
          <input id="fix-position-when-scrolling" type="checkbox" className="checkboxInput" onChange={(e) => { setSelected(e.target.checked); }} />
          <span className={`svg-container checkbox-svg checkbox--checkmark checkbox--checkmark mixed_checkbox--checkmark${selected ? ' checkbox--checked' : ''}`} />
        </label>
      </div>
      )}
      <div className="grid-item-key">
        <div className="grid-item-key-header">
          <span className="layerIcon iconWrapper">
            <span className="svg-container key-svg" />
          </span>
          <span className="rowText"><MatchView text={translationKey.keyName} match={searchMatch?.key} /></span>
        </div>
        <div className="grid-item-actions">
          { select === undefined && (
          <>
            <span
              className="layerIcon iconWrapper button"
              onClick={() => {
                translationKeyStore.deleteKey(translationKey.keyName);
              }}
            >
              <span className="svg-container trash-svg" />
            </span>
            <span
              className="layerIcon iconWrapper button"
              onClick={() => {
                translationKeyStore.updateKey(translationKey.keyName, [], !translationKey.plural);
              }}
            >
              <span className={'svg-container ' + (translationKey.plural ? 'plural-svg' : 'no-plural-svg')} />
            </span>

          </>
          )}
        </div>
        { select === undefined && (
        <div className="key-usage">
          { /* TODO add references to keys */ }
          {false && referencingLabels.length === 0 && <div>no usage</div>}
          {false && referencingLabels.length > 0 && (
            <>
              <div className="collapsible-header" onClick={() => setShowUsage((value) => !value)}>
                <div className={`svg-container${showUsage ? 'expand-svg' : 'collapse-svg'}`} />
                <div className="title">Usage</div>
              </div>
              {showUsage && referencingLabels.map((label) => (

                <div key={label.nodeId} className="localized-label" onClick={() => onNodeSelect(label.nodeId)}>
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
        )}
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
            {pluralArrayByLanguage[language].map((plural) => {
              if (!translationKey.plural && plural !== Plural.OTHER) {
                return null;
              }
              // eslint-disable-next-line consistent-return
              return (
                <div key={plural} className={`keyPluralWrapper ${translationKey.plural ? 'onePlural' : ' multiplePlurals'}${translationKey.translations[language as Language]?.[plural as Plural]?.skip === true ? ' skipped' : ''}`}>
                  { translationKey.plural && <div className="grid-item-plural"><span className="rowText">{plural}</span></div>}
                  <div className="grid-item-translation translation-container translation">
                    <TranslationEditor
                      editable={select === undefined}
                      match={searchMatch?.[language]?.[plural as Plural]}
                      onSave={async (text: any) => {
                        let skip = translationKey.translations[language as Language]?.[plural as Plural]?.skip ?? false;

                        if (text !== undefined && text !== '') {
                          skip = false;
                        }
                        await translationKeyStore.updateKey(translationKey.keyName!, [{
                          language, plural: plural as Plural, text, skip,
                        }]);
                        await translationKeyStore.parentKeyStore.commitUndo();
                      }}
                      text={translationKey.translations[language as Language]?.[plural as Plural]?.text}
                    />

                  </div>
                  <div className="grid-item-actions">
                    { select === undefined && (
                    <>
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
                          await translationKeyStore.parentKeyStore.commitUndo();
                        }}
                      >
                        <span className={'svg-container' + (translationKey.translations[language as Language]?.[plural as Plural]?.skip === true ? ' eye-closed-svg' : ' eye-svg')} />
                      </span>
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          onShowHistoryClick(language, plural);
                        }}
                      >
                        <span className="svg-container history-svg" />
                      </span>

                    </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      <div className="grid-item-language" style={{ height: '10px' }} />
      <OutsideClickHandler
        onOutsideClick={() => { setShowHistory(undefined); }}
        disabled={showHistory === undefined}
        display="contents"
      >
        <div className={`side-drawer${showHistory !== undefined ? ' open' : ' '}`}>
          <div className="history_view--topHeader">
            { t('keys__version__title') }
            <span
              role="button"
              onClick={() => { setShowHistory(undefined); }}
              className="svg-container raw_components--iconButtonEnabled raw_components--_iconButton history_view--headerButton"
              data-tooltip-type="text"
              data-tooltip="Close"
              aria-label="Close"
            >
              <svg className="svg" width="10" height="10" viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg">
                <path d="M5 5.71l3.646 3.647.707-.707-3.646-3.647 3.646-3.646L8.646.65 5 4.296 1.353.65l-.707.707 3.646 3.646L.646 8.65l.707.707L5 5.71z" fillRule="nonzero" fillOpacity="1" fill="#000" stroke="none" />
              </svg>
            </span>
          </div>
          {history?.map((entry, i, array) => (
            <HistoryEntryView
              key={i}
              text="entry.text"
              time={entry.date ?? 0}
              userName={entry.user}
              userIconUrl={entry.user}
              previousText="entry.text" /* {i < (array.length - 1) ? array[i + 1].text : undefined} */
              onReuse={i === 0 ? undefined : async (text: string) => {
                if (showHistory === undefined) return;

                await translationKeyStore.updateKey(translationKey.keyName!, [{
                  language: showHistory.language, plural: showHistory.plural as Plural, text, skip: false,
                }]);
                await translationKeyStore.parentKeyStore.commitUndo();
                setShowHistory(undefined);
              }}
            />
          ))}
        </div>
      </OutsideClickHandler>
    </div>
  );
}
