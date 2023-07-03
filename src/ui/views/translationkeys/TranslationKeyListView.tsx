/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { color } from '@uiw/react-codemirror';
import { Language } from '../../../lib/base/Language';

import MemoryTranslationKeyStore, { SearchQuery, UITranslationKeys } from '../../../lib/keystore/MemoryTranslationKeyStore';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './TranslationKeyListItem';
import { Plural } from '../../../lib/base/Plural';

import './TranslationKeyView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import { NodeSelection } from '../../../lib/localizedlabels/LocalizedLabelManager';

type TranslationKeyListViewProps = {
  initialSearchQuery: SearchQuery,
  showSearchBar: boolean,
  translationKeyStore: MemoryTranslationKeyStore
  localizedLabelManager: LocalizedLabelManagerUI
  figmaRemote: FigmaUtil
  select?: (key: string, language: Language, plural: Plural) => void
};

export default function TranslationKeyListView({
  initialSearchQuery,
  showSearchBar,
  translationKeyStore,
  localizedLabelManager,
  figmaRemote,
  select,
}: TranslationKeyListViewProps) {
  const { t } = useTranslation();
  const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);

  const [fullyRendered, setFullyRendered] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState({} as NodeSelection);
  const [highlightSelection, setHighlightSelection] = useState(false);

  // const [keys, setKeys] = useState: UITranslationKeys,
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(initialSearchQuery);
  const filteredKeys = translationKeyStore.findKeys(searchQuery, selectedNodes);
  const tableRef = useRef<HTMLDivElement>(null);

  async function refreshSelection(triggerHighlight: boolean) {
    const freshSelectedNodes = await localizedLabelManager.getSelection();

    setSelectedNodes(freshSelectedNodes);
    setHighlightSelection(triggerHighlight);
  }

  useEffect(() => {
    const messageHandler = (event: any) => {
      if (event.data.pluginMessage.type === 'event' && event.data.pluginMessage.name === 'selectionchange') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
        refreshSelection(true);
      }
    };

    // asynchronous fetch the state from figma helper
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await refreshSelection(false);
    })();

    const onUpdated = () => {
      setTrigger((v) => v + 1);
    };

    localizedLabelManager.addEventListener('updated', onUpdated);
    translationKeyStore.addEventListener('updated', onUpdated);
    window.addEventListener('message', messageHandler);

    return () => {
      localizedLabelManager.removeEventListener('updated', onUpdated);
      translationKeyStore.removeEventListener('updated', onUpdated);
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

    setFullyRendered(true);

    return () => { if (renderStepTimeout !== undefined) clearTimeout(renderStepTimeout); };
  }, [renderEntries]);

  useEffect(() => {
    if (tableRef.current && highlightSelection) {
      setHighlightSelection(false);
      const firstSelected = tableRef.current?.querySelector('.selected') as HTMLElement;
      if (firstSelected) {
        (firstSelected.parentNode!.firstChild! as any).scrollIntoViewIfNeeded({ block: 'center' });
      }
    }
  }, [highlightSelection]);

  const fileHasKeys = Object.keys(translationKeyStore.translationKeys).length > 0;
  if (!fileHasKeys) {
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
    setSearchQuery(newQuery);
  };

  const onSearchChange = (searchString: string) => {
    setSearchQuery(MemoryTranslationKeyStore.toQueryObject(searchString));
  };

  const longestKey = Object.keys(translationKeyStore.translationKeys).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

  let rendered = 0;

  return (
    <div>
      { showSearchBar && (
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
      )}

      <div className="searchResults">
        { searchQuery.key !== undefined && (
          <div className="searchResults-suggestion">
            <div className="text">{`Key: ${searchQuery.key}`}</div>
            <div
              className="close svg-container cross-svg"
              onClick={() => {
                const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
                newQuery.key = undefined;
                updateQuery(newQuery);
              }}
            />
          </div>
        )}

        { searchQuery.key === undefined && (
          <div style={{paddingRight: '5px'}}>
            <span>
              {filteredKeys.matchingKeys.size}
              {' '}
              Translation Keys
              {' '}
            </span>
            {searchQuery.missingTranslation === undefined && (
            <>
              {' '}
              <span>
                {' '}
                -
                {' '}
                {filteredKeys.withMissingTranslations.size}
                {' '}
                Missing Translations
              </span>
              <span style={{ color: '#1DA1F2', cursor: 'pointer' }}
              onClick={() => {
                const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
                newQuery.missingTranslation = true;
                updateQuery(newQuery);
              }}> filter</span>
            </>
            )}

          </div>
        )}
        { searchQuery.key === undefined && searchQuery.missingTranslation !== undefined && (
          <div className="searchResults-suggestion">
            <div className="text">Missing Translation</div>
            <div
              className="close svg-container cross-svg"
              onClick={() => {
                const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
                newQuery.missingTranslation = undefined;
                updateQuery(newQuery);
              }}
            />
          </div>
        )}

        { false && (
        <>
          <div
            className={`searchResults-suggestion ${searchQuery.missingTranslation === false ? ' active' : ''}`}
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.missingTranslation = searchQuery.missingTranslation === false ? undefined : false;

              updateQuery(newQuery);
            }}
          >
            {`Full Translation (${filteredKeys.withMissingTranslations.size})`}
          </div>
          <div
            className={`searchResults-suggestion ${searchQuery.selected === 'FRAME' ? ' active' : ''}`}
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.selected = searchQuery.selected === 'FRAME' ? undefined : 'FRAME';

              updateQuery(newQuery);
            }}
          >
            {`In Selected Frame (${filteredKeys.referencedInFrame.size})`}
          </div>
          <div
            className={`searchResults-suggestion ${searchQuery.selected === 'LABEL' ? ' active' : ''}`}
            onClick={() => {
              const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
              newQuery.selected = searchQuery.selected === 'LABEL' ? undefined : 'LABEL';

              updateQuery(newQuery);
            }}
          >
            {`In Selected Label (${filteredKeys.referencedInLabels.size})`}
          </div>
          <div className="searchResults-suggestion">
            results:
            {' '}
            {filteredKeys.matchingKeys.size}
            {' '}
          </div>
        </>
        )}
        {false && !searchQuery.key && filteredKeys.inKeys.size > 0 && (
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
        {false && !searchQuery.key && filteredKeys.inText.size > 0 && (
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
        { false && searchQuery.missingTranslation === undefined && (
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

      <div className="grid" ref={tableRef}>
        {/* helper row for css to set the width when partially rendered */}
        
          <TranslationKeyListItem
            key="max-width-helper-row"
            rowClassNames='hidden-helper-row'
            translationKeyStore={translationKeyStore}
            localizedLabelManager={localizedLabelManager}
            searchMatch={undefined}
            translationKey={translationKeyStore.translationKeys[longestKey]}
            figmaRemote={figmaRemote}
            select={select}
            labelSelected={false}
          />
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
              labelSelected={Object.values(selectedNodes).map((selectedNode) => selectedNode.key).includes(keyName)}
            />
          );
        })}
      </div>
    </div>
  );
}
