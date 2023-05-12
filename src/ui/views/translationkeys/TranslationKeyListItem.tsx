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
import { Plural, getPluralFormsByLanguage } from '../../../lib/base/Plural';
import { HistoryEntry, HistoryTag, TranslationKey } from '../../../lib/keystore/TranslationKey';
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

interface VersionEntry {
  versionTag: HistoryTag | undefined
  text: string | undefined
  previousText: string | undefined
  date: number,
  userName: string
  userIconUrl: string
  skip: boolean
  verified: boolean
}

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
  const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);

  const [showHistory, setShowHistory] = useState<undefined | { language: Language, plural: Plural }>(undefined);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = localizedLabelManager.getLabelsWithKey(translationKey.keyName);

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId);
    await figmaRemote.selectNodes([nodeId]);
  }

  async function showAll() {
    // TODO check in which page the label is in
    const nodeIds = referencingLabels.map((l) => l.nodeId);

    await figmaRemote.selectNodes(nodeIds);
    await figmaRemote.scrollAndZoomNodesIntoView(nodeIds);
  }

  async function showNext(backward: boolean) {
    // TODO check in which page the label is in
    if (referencingLabels.length === 0) {
      return;
    }

    const selectedNodeIds = await figmaRemote.getSelectedNodeIds();
    let nodeIdToSelect: string;

    let indexToSelect = -1;
    if (selectedNodeIds.length === 1) {
      indexToSelect = referencingLabels.findIndex((localizedLabel) => localizedLabel.nodeId === selectedNodeIds[0]);

      if (indexToSelect !== -1) {
        if (backward) {
          indexToSelect = (indexToSelect - 1) % referencingLabels.length;
        } else {
          indexToSelect = (indexToSelect + 1) % referencingLabels.length;
        }
      }
    }

    if (indexToSelect === -1) {
      if (backward) {
        indexToSelect = referencingLabels.length - 1;
      } else {
        indexToSelect = 0;
      }
    }

    await figmaRemote.selectNodes([referencingLabels[indexToSelect].nodeId]);

    await figmaRemote.scrollAndZoomNodesIntoView([referencingLabels[indexToSelect].nodeId]);
  }

  const baseLang = translationKeyStore.getBaseLanugage();

  // create an array of languages with baselanguage at position zero
  const languages = [baseLang, ...translationKeyStore.getLanugages()!.filter((l) => l !== baseLang)] as Language[];

  const onShowHistoryClick = (language: Language, plural: Plural) => {
    const specificHistory = [] as VersionEntry[];

    let lastRelevantVersion = undefined as VersionEntry | undefined;

    let currentVersion = 0;

    const taggedVersions = [] as number[];

    for (const tagIndex of Object.keys(translationKey.historyTags)) {
      if (translationKey.historyTags[parseInt(tagIndex, 10)]) {
        taggedVersions.push(parseInt(tagIndex, 10));
      }
    }

    // historyTags maps from the tag index to a key version
    // a key may no exist in every tag ->
    let currentTagIndex = 0;
    let currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
    let currentTaggedKeyVersion = currentVersionTagIndex && translationKey.historyTags[currentVersionTagIndex] ? translationKey.historyTags[currentVersionTagIndex] : -1;
    let currentTag = currentVersionTagIndex ? translationKeyStore.historyTags[currentVersionTagIndex] : undefined;

    console.log('taqgs');
    console.log(translationKeyStore.historyTags);
    console.log('key');
    console.log(translationKey);

    // filter relevant history changes for the given key
    for (const keyHistoryEntry of translationKey.history) {
      if (keyHistoryEntry.translations?.[language]?.[plural] !== undefined) {
        if (currentTaggedKeyVersion < currentVersion) {
          currentTagIndex += 1;
          currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
          currentTaggedKeyVersion = currentVersionTagIndex && translationKey.historyTags[currentVersionTagIndex] ? translationKey.historyTags[currentVersionTagIndex] : -1;
          currentTag = currentVersionTagIndex ? translationKeyStore.historyTags[currentVersionTagIndex] : undefined;
        }

        const currentRelevantVersion = {
          versionTag: currentTag,
          text: keyHistoryEntry.translations?.[language]?.[plural]?.text ?? lastRelevantVersion?.text,
          previousText: lastRelevantVersion?.text,
          userName: keyHistoryEntry.user,
          date: keyHistoryEntry.date,
          userIconUrl: keyHistoryEntry.user,
          skip: keyHistoryEntry.translations?.[language]?.[plural]?.skip ?? false,
          verified: keyHistoryEntry.translations?.[language]?.[plural]?.verified ?? false, // TODO #9 check correct state for history view
        };

        // relevant historyEntry
        specificHistory.push(currentRelevantVersion);

        if (currentTaggedKeyVersion >= currentVersion && lastRelevantVersion && currentRelevantVersion.versionTag === lastRelevantVersion.versionTag) {
          // remove tag from last entry since this one is a better candidate
          lastRelevantVersion.versionTag = undefined;
        }
        lastRelevantVersion = currentRelevantVersion;

      }

      currentVersion += 1;
    }

    setHistory(specificHistory.reverse());
    setShowHistory({ language, plural });
  };

  return (
    <div
      ref={rowRef}
      className={`keyWrapper ${selected ? 'selected' : ''}`}
      onClick={() => {
        if (select) {
          select(translationKey.keyName);
        }
      }}
    >
      <div className="grid-item-key">
        <div className="grid-item-key-header">
          <span className="layerIcon iconWrapper">
            <span className="svg-container key-svg" />
          </span>
          <span className="rowText"><MatchView text={translationKey.keyName} match={searchMatch?.keyMatch} /></span>
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
          { referencingLabels.length === 0 && <div>no usage</div>}
          { referencingLabels.length > 0 && (
            <>
              <div onClick={showAll}>showAll</div>
              <div onClick={() => showNext(true)}>previous</div>
              <div onClick={() => showNext(true)}>next</div>
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
            {getPluralFormsByLanguage(language).map((plural) => {
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
                      match={searchMatch?.textMatches[language]?.[plural as Plural]}
                      onSave={async (text: any) => {
                        let skip = translationKey.translations[language as Language]?.[plural as Plural]?.skip ?? false;

                        if (text !== undefined && text !== '') {
                          skip = false;
                        }
                        await translationKeyStore.updateKey(translationKey.keyName!, [{
                          language, plural: plural as Plural, text, skip,
                        }]);

                        await localizedLabelManager.updateUnmodifiedLabelsWithKey(translationKey.keyName!);
                        await translationKeyStore.parentKeyStore.commitUndo();
                      }}
                      text={translationKey.translations[language as Language]?.[plural as Plural]?.text}
                      translationKeyStore={translationKeyStore}
                    />

                  </div>
                  <div className="grid-item-actions">
                    { select === undefined && (
                    <>
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          // disable a translation
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
          {showHistory?.language && history?.map((entry, i, array) => (
            <HistoryEntryView
              // eslint-disable-next-line react/no-array-index-key
              key={i}
              first={i === 0}
              last={i === array.length - 1}
              tag={entry.versionTag}
              currentVersion={i === 0}
              text={entry.text}
              time={entry.date ?? 0}
              userName={entry.userName}
              userIconUrl={entry.userIconUrl}
              previousText={entry.previousText}
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
