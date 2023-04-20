/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/interactive-supports-focus */
import * as React from 'react';
import { useEffect, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { Language } from '../../../lib/base/Language';
import { TranslationKeys } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import FigmaUtil from '../../../shared/FigmaUtil';
import TranslationKeyListItem from './TranslationKeyListItem';
import { Plural } from '../../../lib/base/Plural';

import './TranslationKeyView.css';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';

type TranslationKeyListViewProps = {
  keys: TranslationKeys,

  translationKeyStore: MemoryTranslationKeyStore
  localizedLabelManager: LocalizedLabelManagerUI

  figmaRemote: FigmaUtil
  refreshKeys: Function
  select?: Function
};

export default function TranslationKeyListView({
  keys,
  translationKeyStore,
  localizedLabelManager,
  figmaRemote,
  refreshKeys,
  select,
}: TranslationKeyListViewProps) {
  const { t } = useTranslation();
  const [, setTrigger] = useState(0);
  const [renderEntries, setRenderEntries] = useState(200);
  const [searchText, setSearchText] = useState('');
  const [selectedLabels, setSelectedLabels] = useState<LocalizedLabel[]>([]);

  async function refreshSelection() {
    const selectedNodes = await localizedLabelManager.getSelection();

    const labels = [] as LocalizedLabel[];
    for (const selectedElement of selectedNodes) {
      const label = localizedLabelManager.getLabelByNodeId(selectedElement.selectedNodeId);
      if (label && label.keyType === KeyState.Linked) {
        labels.push(label);
      }
    }

    setSelectedLabels(labels);
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

  const longestKey = Object.keys(keys).reduce((acc, key) => (key.length > acc.length ? key : acc), '');

  let rendered = 0;

  const filteredKeys: any = Object.keys(keys).reduce((matchingKeys, key) => {
    if (selectedLabels.length > 0 && selectedLabels.filter((label) => label.key === key).length === 0) {
      return matchingKeys;
    }

    if (searchText === '') {
      return matchingKeys.concat({ key });
    }

    const keyPosition = key.toLowerCase().indexOf(searchText.toLowerCase());
    if (keyPosition !== -1) {
      return matchingKeys.concat({
        key,
        match: { key: { start: keyPosition, length: searchText.length } },
      });
    }

    for (const language of Object.keys(keys[key].translations)) {
      for (const plural of Object.keys(keys[key].translations[language as Language]!)) {
        const { text } = keys[key].translations[language as Language]![plural as Plural]!;
        if (text !== undefined) {
          const matchStart = text.toLowerCase().indexOf(searchText.toLowerCase());
          if (matchStart !== -1) {
            return matchingKeys.concat({
              key,
              match: { [language]: { [plural]: { start: matchStart, length: searchText.length } } },
            });
          }
        }
      }
    }

    return matchingKeys;
  }, [] as any[]);

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
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setRenderEntries(100);
          }}
        />
      </div>
      { searchText && (
        <div className="searchResults">
          { t('keys__search_result_hint', { count: filteredKeys.length })}
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
        {filteredKeys.map((matching: any) => {
          if (rendered > renderEntries) {
            return;
          }

          rendered += 1;
          // eslint-disable-next-line consistent-return
          return (
            <TranslationKeyListItem
              key={matching.key}
              translationKeyStore={translationKeyStore}
              localizedLabelManager={localizedLabelManager}
              searchMatch={matching.match}
              translationKey={keys[matching.key]}
              figmaRemote={figmaRemote}
              select={select}
            />
          );
        })}
      </div>
    </div>
  );
}
