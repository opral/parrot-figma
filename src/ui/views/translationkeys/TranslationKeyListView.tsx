/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { Language } from '../../../lib/base/Language';
import { TranslationKeys } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore, { SearchQuery } from '../../../lib/keystore/MemoryTranslationKeyStore';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './TranslationKeyListItem';
import { Plural } from '../../../lib/base/Plural';

import './TranslationKeyView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';

type TranslationKeyListViewProps = {
  keys: TranslationKeys,
  searchQuery: SearchQuery,
  translationKeyStore: MemoryTranslationKeyStore
  localizedLabelManager: LocalizedLabelManagerUI

  figmaRemote: FigmaUtil
  refreshKeys: Function
  select?: (key: string, language: Language, plural: Plural) => void
};

export default function TranslationKeyListView({
  keys,
  searchQuery,
  translationKeyStore,
  localizedLabelManager,
  figmaRemote,
  refreshKeys,
  select,
}: TranslationKeyListViewProps) {
  
  const { t } = useTranslation();
  const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);
  const [filteredKeys, setFilteredKeys] = useState(translationKeyStore.findKeys(searchQuery));
  const [query, setQuery] = useState<SearchQuery>(searchQuery);

  async function refreshSelection() {
    const selectedNodes = await localizedLabelManager.getSelection();

    const labels = [] as LocalizedLabel[];
    for (const selectedElement of selectedNodes) {
      const label = localizedLabelManager.getLabelByNodeId(selectedElement.selectedNodeId);
      if (label && label.keyType === KeyState.Linked) {
        labels.push(label);
      }
    }

    // setSelectedLabels(labels);
    refreshKeys();
    setTrigger((v) => v + 1);
  }

  function messageHandler(event: any) {
    if (event.data.pluginMessage.type === 'event') {
      if (event.data.pluginMessage.name === 'selectionchange') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
        refreshSelection();
      }
    }
  }

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await refreshSelection();
    })();

    localizedLabelManager.addEventListener('updated', refreshSelection);
    translationKeyStore.addEventListener('updated', refreshSelection);
    window.addEventListener('message', messageHandler);

    return () => {
      localizedLabelManager.removeEventListener('updated', refreshSelection);
      translationKeyStore.removeEventListener('updated', refreshSelection);
      window.removeEventListener('message', messageHandler);
    };
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
    setQuery(newQuery);
    setFilteredKeys(newFilteredKeys);
  };

  const onSearchChange = (searchString: string) => {
    updateQuery(MemoryTranslationKeyStore.toQueryObject(searchString));
  };

  const longestKey = Object.keys(keys).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

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
          value={MemoryTranslationKeyStore.toSearchString(query)}
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
          {!query.key && filteredKeys.inKeys.size > 0 && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(query)) as SearchQuery;
              newQuery.key = query.text;
              newQuery.keyAtEnd = false;
              newQuery.text = '';

              updateQuery(newQuery);
            }}
          >
            {`key:${query.text} ${filteredKeys.inKeys.size}`}
          </div>
          )}
          {!query.key && filteredKeys.inText.size > 0 && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(query)) as SearchQuery;
              newQuery.key = '*';
              updateQuery(newQuery);
            }}
          >
            {`Results in Text ${filteredKeys.inText.size}`}
          </div>
          )}
          { false && query.unverified !== true && ( // TODO #9 activate again as soon as verification is in place
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(query)) as SearchQuery;
              newQuery.unverified = true;
              updateQuery(newQuery);
            }}
          >
            {`unverified:true ${filteredKeys.withMissingReview.size}`}
          </div>
          )}
          {query.missingTranslation === undefined && (
          <div
            className="searchResults-suggestion"
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(query)) as SearchQuery;
              newQuery.missingTranslation = true;
              updateQuery(newQuery);
            }}
          >
            {`missing_translation:true ${filteredKeys.withMissingTranslations.size}`}
          </div>
          )}
        </div>
      )}
      <div className="grid">
        <div className="grid-hidden-layout-helper">
          <TranslationKeyListItem
            key="max-width-helper-row"
            translationKeyStore={translationKeyStore}
            localizedLabelManager={localizedLabelManager}
            searchMatch={undefined}
            translationKey={keys[longestKey]}
            figmaRemote={figmaRemote}
            select={select}
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
              translationKey={keys[keyName]}
              figmaRemote={figmaRemote}
              select={select}
            />
          );
        })}
      </div>
    </div>
  );
}
