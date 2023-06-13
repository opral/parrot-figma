/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { Language } from '../../../lib/base/Language';

import MemoryTranslationKeyStore, { SearchQuery, UITranslationKeys } from '../../../lib/keystore/MemoryTranslationKeyStore';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './TranslationKeyListItem';
import { Plural } from '../../../lib/base/Plural';

import './TranslationKeyView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';

type TranslationKeyListViewProps = {
  initialSearchQuery: SearchQuery,
  translationKeyStore: MemoryTranslationKeyStore
  localizedLabelManager: LocalizedLabelManagerUI
  figmaRemote: FigmaUtil
  select?: (key: string, language: Language, plural: Plural) => void
};

export default function TranslationKeyListView({
  initialSearchQuery,
  translationKeyStore,
  localizedLabelManager,
  figmaRemote,
  select,
}: TranslationKeyListViewProps) {
  const { t } = useTranslation();
  // const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);

  const [selectedKeys, setSelectedKeys] = useState([] as string[]);
  const [highlightingAfterSelectionDone, setHighlightingAfterSelectionDone] = useState(false);
  // const [keys, setKeys] = useState: UITranslationKeys,
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(initialSearchQuery);
  const [filteredKeys, setFilteredKeys] = useState(translationKeyStore.findKeys(initialSearchQuery));
  const tableRef = useRef<HTMLDivElement>(null);

  async function refreshData() {
    setFilteredKeys(translationKeyStore.findKeys(searchQuery));
    // setTrigger((v) => v + 1);
  }

  async function refreshSelection() {
    const selectedNodes = await localizedLabelManager.getSelection();
    const freshSelectedKeys = Object.values(selectedNodes).filter((selectedNode) => selectedNode.isLabel && selectedNode.key).map((selectedNode) => selectedNode.selectedNodeId);

    setSelectedKeys(freshSelectedKeys);
  }

  function messageHandler(event: any) {
    if (event.data.pluginMessage.type === 'event') {
      if (event.data.pluginMessage.name === 'selectionchange') {
        setHighlightingAfterSelectionDone(false);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
        refreshSelection();
      }
    }
  }

  function tryToHighlightSelectedKey() {
    const firstSelected = tableRef.current?.querySelector('.selected') as HTMLElement;
    if (firstSelected && !highlightingAfterSelectionDone) {
      setHighlightingAfterSelectionDone(true);
      (firstSelected.firstChild as any).scrollIntoViewIfNeeded({ block: 'center' });
    }
  }

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await refreshSelection();
    })();

    localizedLabelManager.addEventListener('updated', refreshData);
    translationKeyStore.addEventListener('updated', refreshData);
    window.addEventListener('message', messageHandler);

    return () => {
      localizedLabelManager.removeEventListener('updated', refreshData);
      translationKeyStore.removeEventListener('updated', refreshData);
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  // rendering is done in chunks the first time to give the dom time to settle
  const renderChunkSize = 250;
  useEffect(() => {
    // we use any here since NodeJS.Timout - the suggested type by the ide is not correct
    let renderStepTimeout : any | undefined;
    if (Object.keys(filteredKeys).length > renderEntries) {
      renderStepTimeout = setTimeout(() => {
        // console.log(`rending next portion ${renderEntries + 100}`);
        setRenderEntries((value) => value + renderChunkSize);
      }, 10);
    }

    if (tableRef.current) {
      const firstSelected = tableRef.current.querySelector('.selected') as HTMLElement;
      if (firstSelected && !highlightingAfterSelectionDone) {
        setHighlightingAfterSelectionDone(true);
        (firstSelected.firstChild as any).scrollIntoViewIfNeeded({ block: 'center' });
      }
    }
    return () => { if (renderStepTimeout !== undefined) clearTimeout(renderStepTimeout); };
  }, [renderEntries]);

  useEffect(() => {
    if (tableRef.current) {
      tryToHighlightSelectedKey();
    }
  }, [selectedKeys]);

  useEffect(() => {
    setFilteredKeys(translationKeyStore.findKeys(searchQuery));
  }, [searchQuery]);

  if (Object.keys(translationKeyStore.translationKeys).length === 0) {
    return (
      <div className="emptyState">
        <div className="emptyStateTitle">No Translation keys yet</div>
        <div className="emptyStateSubtitle">
          <div>
            Localized Keys
            <br />
            will show up here.
          </div>
        </div>
      </div>
    );
  }

  const updateQuery = (newQuery: SearchQuery) => {
    const newFilteredKeys = translationKeyStore.findKeys(newQuery);
    setSearchQuery(newQuery);
    setFilteredKeys(newFilteredKeys);
  };

  const onSearchChange = (searchString: string) => {
    setSearchQuery(MemoryTranslationKeyStore.toQueryObject(searchString));
  };

  const longestKey = Object.keys(translationKeyStore.translationKeys).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

  let rendered = 0;

  return (
    <div>
      <div className="style_picker--search search--margin">
        <span className="svg-container search-svg" />
        <input
          type="text"
          placeholder={t('keys__search_placeholder')!}
          className="search--searchInput"
          spellCheck="false"
          dir="auto"
          value={MemoryTranslationKeyStore.toSearchString(searchQuery)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setRenderEntries(100);
          }}
        />
      </div>
      { true && (
        <div className="searchResults">
          <div className="searchResults-suggestion">
            results:
            {' '}
            {filteredKeys.matchingKeys.size}
            {' '}
          </div>
          {!searchQuery.key && filteredKeys.inKeys.size > 0 && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.key = searchQuery.text;
              newQuery.keyAtEnd = false;
              newQuery.text = '';

              updateQuery(newQuery);
            }}
          >
            {`key:${searchQuery.text} ${filteredKeys.inKeys.size}`}
          </div>
          )}
          {!searchQuery.key && filteredKeys.inText.size > 0 && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.key = '*';
              updateQuery(newQuery);
            }}
          >
            {`Results in Text ${filteredKeys.inText.size}`}
          </div>
          )}
          { false && searchQuery.unverified !== true && ( // TODO #9 activate again as soon as verification is in place
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.unverified = true;
              updateQuery(newQuery);
            }}
          >
            {`unverified:true ${filteredKeys.withMissingReview.size}`}
          </div>
          )}
          {searchQuery.missingTranslation === undefined && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.missingTranslation = true;
              updateQuery(newQuery);
            }}
          >
            {`missing_translation:true ${filteredKeys.withMissingTranslations.size}`}
          </div>
          )}
        </div>
      )}
      <div className="grid" ref={tableRef}>
        {/* helper row for css to set the width when partially rendered */}
        <div className="grid-hidden-layout-helper">
          <TranslationKeyListItem
            key="max-width-helper-row"
            translationKeyStore={translationKeyStore}
            localizedLabelManager={localizedLabelManager}
            searchMatch={undefined}
            translationKey={translationKeyStore.translationKeys[longestKey]}
            figmaRemote={figmaRemote}
            select={select}
            labelSelected={false}
          />
        </div>
        {[...filteredKeys.matchingKeys].map((keyName) => {
          if (rendered > renderEntries) {
            return;
          }

          rendered += 1;
          // eslint-disable-next-line consistent-return
          return (
            <TranslationKeyListItem
              key={keyName}
              translationKeyStore={translationKeyStore}
              localizedLabelManager={localizedLabelManager}
              searchMatch={filteredKeys.matches[keyName]}
              translationKey={translationKeyStore.translationKeys[keyName]}
              figmaRemote={figmaRemote}
              select={select}
              labelSelected={selectedKeys.includes(keyName)}
            />
          );
        })}
      </div>
    </div>
  );
}
