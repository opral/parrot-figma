/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import Language from '../../../lib/base/Language';
import { TranslationKeys } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './TranslationKeyListItem';
import Plural from '../../../lib/base/Plural';
import HistoryEntry from '../../compontents/history/HistoryEntry';
import './TranslationKeyView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';

type TranslationKeyListViewProps = {
  keys: TranslationKeys,

  translationKeyStore: MemoryTranslationKeyStore
  localizedLabelManager: LocalizedLabelManagerUI

  figmaRemote: FigmaUtil
  refreshKeys: Function
};

export default function TranslationKeyListView({
  keys,
  translationKeyStore,
  localizedLabelManager,
  figmaRemote,
  refreshKeys,
}: TranslationKeyListViewProps) {
  const [history, setHistory] = useState(undefined as undefined | { version: number, text?: string }[]);
  const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);
  const [searchText, setSearchText] = useState('');

  function refreshSelection() {
    refreshKeys();
    setTrigger((v) => v + 1);
  }

  useEffect(() => {
    localizedLabelManager.addEventListener('updated', refreshSelection);

    return () => localizedLabelManager.removeEventListener('updated', refreshSelection);
  }, []);

  useEffect(() => {
    let renderStepTimeout : number | undefined;
    if (Object.keys(keys).length > renderEntries) {
      renderStepTimeout = setTimeout(() => {
        // console.log(`rending next portion ${renderEntries + 100}`);
        setRenderEntries((value) => value + 250);
      }, 10);
    }
    return () => { if (renderStepTimeout !== undefined) clearTimeout(renderStepTimeout); };
  }, [renderEntries]);

  if (Object.keys(keys).length === 0) {
    return <b>Keine Keys</b>;
  }

  const showHistory = (keyName: string, language: Language, plural: Plural) => {
    translationKeyStore.parentKeyStore.getHistory(keyName).then((historyEntries) => {
      const specificHistory = [] as { text?: string, version: number}[];

      let version = 0;
      // filter relevant history changes for the given key
      for (const keyHistoryEntry of historyEntries) {
        if (keyHistoryEntry[language]?.[plural] !== undefined) {
          specificHistory.push({
            text: keyHistoryEntry[language]![plural]!.text,
            version,
          });
        }
        version += 1;
      }

      setHistory(specificHistory);
    });
  };

  const longestKey = Object.keys(keys).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

  let rendered = 0;

  return (
    <div>
      <div className="style_picker--search search--margin">
        <span className="svg-container search-svg" />
        <input
          type="text"
          placeholder="Search"
          className="search--searchInput"
          spellCheck="false"
          dir="auto"
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setRenderEntries(100);
          }}
        />
      </div>
      <div className="grid">
        <div className="grid-hidden-layout-helper">
          <TranslationKeyListItem
            key="max-width-helper-row"
            translationKeyStore={translationKeyStore}
            localizedLabelManager={localizedLabelManager}
            searchMatch={undefined}
            showHistory={showHistory}
            translationKey={keys[longestKey]}
            figmaRemote={figmaRemote}
          />
        </div>
        {Object.keys(keys).map((key) => {
          if (rendered > renderEntries) {
            return;
          }
          let match;
          if (searchText !== '') {
            const keyPosition = key.toLowerCase().indexOf(searchText.toLowerCase());
            if (keyPosition !== -1) {
              match = { key: { start: keyPosition, length: searchText.length } };
            } else {
              // eslint-disable-next-line no-restricted-syntax, no-labels
              outer:
              for (const language of Object.keys(keys[key].translations)) {
                // eslint-disable-next-line no-restricted-syntax, no-labels
                inner:
                for (const plural of Object.keys(keys[key].translations[language as Language]!)) {
                  const { text } = keys[key].translations[language as Language]![plural as Plural]!;
                  if (text === undefined) {
                    // eslint-disable-next-line no-continue, no-labels, no-extra-label
                    continue inner;
                  }

                  const matchStart = text.toLowerCase().indexOf(searchText.toLowerCase());
                  if (matchStart !== -1) {
                    match = { [language]: { [plural]: { start: matchStart, length: searchText.length } } };

                    // eslint-disable-next-line no-labels
                    break outer;
                  }
                }
              }
            }

            if (match === undefined) {
              return;
            }
          }

          rendered += 1;
          // eslint-disable-next-line consistent-return
          return (
            <TranslationKeyListItem
              key={key}
              translationKeyStore={translationKeyStore}
              localizedLabelManager={localizedLabelManager}
              searchMatch={match}
              showHistory={showHistory}
              translationKey={keys[key]}
              figmaRemote={figmaRemote}
            />
          );
        })}
      </div>
      <OutsideClickHandler
        onOutsideClick={() => { setHistory(undefined); }}
        disabled={history === undefined}
      >
        <div className={`side-drawer${history !== undefined ? ' open' : ' '}`}>
          <div className="history_view--topHeader">
            Version history
            <span
              role="button"
              onClick={() => { setHistory(undefined); }}
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
          {history?.reverse().map((entry, i, array) => <HistoryEntry version={entry.version} text={entry.text} previousText={i < (array.length - 1) ? array[i + 1].text : undefined} />)}
        </div>
      </OutsideClickHandler>
    </div>
  );
}
