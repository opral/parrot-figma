/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { Locale } from '../../../lib/message/variants/Locale';

import MessageStoreMemory, { SearchQuery } from '../../../lib/message/store/MessageStoreMemory';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './MessageListItem';
import { Plural } from '../../../lib/message/variants/Plural';

import './MessageView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { NodeSelection } from '../../../lib/localizedlabels/LocalizedLabelManager';

type MessageListViewProps = {
  initialSearchQuery: SearchQuery,
  showSearchBar: boolean,
  messageStore: MessageStoreMemory
  localizedLabelManager: LocalizedLabelManagerUI
  figmaRemote: FigmaUtil
  select?: (key: string, language: Locale, plural: Plural) => void
  selectedMessageId?: string,
  highlightSelectedNodes: boolean
};

export default function MessageListView({
  initialSearchQuery,
  showSearchBar,
  messageStore,
  localizedLabelManager,
  figmaRemote,
  select,
  selectedMessageId,
  highlightSelectedNodes,
}: MessageListViewProps) {
  const { t } = useTranslation();
  const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);

  const [fullyRendered, setFullyRendered] = useState(false);
  const [selectedNodes, setSelectedNodes] = useState({} as NodeSelection);
  const [highlightSelection, setHighlightSelection] = useState(false);

  // const [keys, setKeys] = useState: UITranslationKeys,
  const [searchQuery, setSearchQuery] = useState<SearchQuery>(initialSearchQuery);
  const filteredKeys = messageStore.findMessages(searchQuery, selectedNodes);
  const tableRef = useRef<HTMLDivElement>(null);

  async function refreshSelection(triggerHighlight: boolean) {
    if (highlightSelectedNodes) {
      const freshSelectedNodes = await localizedLabelManager.getSelection();

      setSelectedNodes(freshSelectedNodes);
      setHighlightSelection(triggerHighlight);
    }
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
    messageStore.addEventListener('updated', onUpdated);
    window.addEventListener('message', messageHandler);

    return () => {
      localizedLabelManager.removeEventListener('updated', onUpdated);
      messageStore.removeEventListener('updated', onUpdated);
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

  const allMessages = messageStore.inlangProject?.query.messages.getAll() ?? [];

  const fileHasMessages = allMessages.length > 0;
  if (!fileHasMessages) {
    return (
      <div className="emptyState">
        <div className="emptyStateTitle">No Messages yet</div>
        <div className="emptyStateSubtitle">
          <div>
            Messages
            <br />
            will show up here. - Create one by Linking a Translation Key on a Text in the Design Tab or Import your existing Keys in the Setup Tab.
          </div>
        </div>
      </div>
    );
  }

  const updateQuery = (newQuery: SearchQuery) => {
    setSearchQuery(newQuery);
  };

  const onSearchChange = (searchString: string) => {
    setSearchQuery(MessageStoreMemory.toQueryObject(searchString));
  };

  const longestKey = allMessages[0].id!; // TODO #14 find longest message Object.keys(messageStore.messages).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

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
          value={MessageStoreMemory.toSearchString(searchQuery)}
          onChange={(e) => {
            onSearchChange(e.target.value);
            setRenderEntries(100);
          }}
        />
      </div>
      )}

      <div className="searchResults">
        { searchQuery.name !== undefined && (
          <div className="searchResults-suggestion">
            <div className="text">{`Name: ${searchQuery.name}`}</div>
            <div
              className="close svg-container cross-svg"
              onClick={() => {
                const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
                newQuery.name = undefined;
                updateQuery(newQuery);
              }}
            />
          </div>
        )}

        { searchQuery.name === undefined && (
          <div style={{ paddingRight: '5px' }}>
            <span>
              {filteredKeys.matchingNames.size}
              {' '}
              Messages
              {' '}
            </span>
            {searchQuery.missingTranslation === undefined && (
            <>
              {' '}
              <span>
                {' '}
                -
                {' '}
                {filteredKeys.withMissingVariants.size}
                {' '}
                Missing Variants
              </span>
              <span
                style={{ color: '#1DA1F2', cursor: 'pointer' }}
                onClick={() => {
                  const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
                  newQuery.missingTranslation = true;
                  updateQuery(newQuery);
                }}
              >
                {' '}
                filter

              </span>
            </>
            )}

          </div>
        )}
        { searchQuery.name === undefined && searchQuery.missingTranslation !== undefined && (
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
            {`Full Translation (${filteredKeys.withMissingVariants.size})`}
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
            {filteredKeys.matchingNames.size}
            {' '}
          </div>
        </>
        )}
        {false && !searchQuery.name && filteredKeys.inNames.size > 0 && (
        <div
          className="searchResults-suggestion"
          onClick={() => {
            const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
            newQuery.name = searchQuery.text;
            newQuery.nameAtEnd = false;
            newQuery.text = '';

            updateQuery(newQuery);
          }}
        >
          {`key:${searchQuery.text} ${filteredKeys.inNames.size}`}
        </div>
        )}
        {false && !searchQuery.name && filteredKeys.inText.size > 0 && (
        <div
          className="searchResults-suggestion"
          onClick={() => {
            const newQuery = JSON.parse(JSON.stringify(searchQuery)) as SearchQuery;
            newQuery.name = '*';
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
          {`missing_translation:true ${filteredKeys.withMissingVariants.size}`}
        </div>
        )}
      </div>

      <div className="grid" ref={tableRef}>
        {/* helper row for css to set the width when partially rendered */}

        <TranslationKeyListItem
          key="max-width-helper-row"
          rowClassNames="hidden-helper-row"
          messageStore={messageStore}
          localizedLabelManager={localizedLabelManager}
          searchMatch={undefined}
          messageId={longestKey}
          figmaRemote={figmaRemote}
          select={select}
          keySelected={false}
        />
        {[...filteredKeys.matchingNames].map((messageId) => {
          if (rendered > renderEntries) {
            return;
          }

          rendered += 1;
          // eslint-disable-next-line consistent-return
          return (
            <TranslationKeyListItem
              key={messageId}
              messageStore={messageStore}
              localizedLabelManager={localizedLabelManager}
              searchMatch={filteredKeys.matches[messageId]}
              messageId={messageId}
              figmaRemote={figmaRemote}
              select={select}
              keySelected={Object.values(selectedNodes).map((selectedNode) => selectedNode.messageId).includes(messageId) || selectedMessageId === messageId}
            />
          );
        })}
      </div>
    </div>
  );
}
