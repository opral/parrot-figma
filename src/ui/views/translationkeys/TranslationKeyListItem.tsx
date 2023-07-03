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
import { fileLoader } from 'ejs';
import { Language } from '../../../lib/base/Language';
import { Plural, getPluralFormsByLanguage } from '../../../lib/base/Plural';
import { Fillins, HistoryTag, Placeholder } from '../../../lib/keystore/TranslationKey';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import MatchView from '../../compontents/matchview/MatchView';
import HistoryEntryView from '../../compontents/history/HistoryEntryView';
import { UITranslationKey } from '../../../lib/keystore/UITranslationKey';
import { PlaceholderView } from '../../compontents/translationEditor/PlaceholderView';
import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';
import AsyncImage from './AsyncImage';
import FEATURES_FLAGS from '../../featuretoggle';
// import ReactQuill from 'react-quill';

interface VersionEntry {
  version: number,
  versionTag: HistoryTag | undefined
  text: string | undefined
  previousText: string | undefined
  date: number,
  userName: string
  userIconUrl: string
  skip: boolean
  verified: boolean
}

type TranslationKeyListItemProps = {
  rowClassNames?: string | undefined,
  translationKey: UITranslationKey,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  translationKeyStore: MemoryTranslationKeyStore,
  localizedLabelManager: LocalizedLabelManagerUI,
  select?: Function,
  labelSelected: boolean,
};

export default function TranslationKeyListItem({
  rowClassNames,
  translationKey,
  figmaRemote,
  searchMatch,
  translationKeyStore,
  localizedLabelManager,
  select,
  labelSelected,
}: TranslationKeyListItemProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showPlaceholderEditor, setShowPlaceholderEditor] = useState(false);
  const [defaultFillins, setDefaultFillins] = useState(translationKey.defaultFillins);
  const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);

  const [showHistory, setShowHistory] = useState<undefined | { language: Language, plural: Plural }>(undefined);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = translationKey.referencingTextNodes;

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  async function showAll() {
    // TODO check in which page the label is in

    await figmaRemote.selectNodes(referencingLabels);
    await figmaRemote.scrollAndZoomNodesIntoView(referencingLabels);
  }

  async function showNext(backward: boolean) {
    // TODO check in which page the label is in
    if (referencingLabels.length === 0) {
      return;
    }

    const selectedNodeIds = await figmaRemote.getSelectedNodeIds();

    let indexToSelect = -1;
    if (selectedNodeIds.length === 1) {
      indexToSelect = referencingLabels.findIndex((textNodeId) => textNodeId === selectedNodeIds[0]);

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

    await figmaRemote.selectNodes([referencingLabels[indexToSelect]]);

    await figmaRemote.scrollAndZoomNodesIntoView([referencingLabels[indexToSelect]]);
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
          version: currentVersion,
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
      className={`row row-key ${selected || labelSelected ? 'selected' : ''} ${rowClassNames !== undefined ? rowClassNames : ''}`}
      onClick={() => {
        if (select) {
          select(translationKey.keyName);
        }
      }}
    >
      <div className="grid-full-height-helper" />
      <div className={'column column-key grid-item-key ' + (labelSelected ? ' selected' : '')}>
        <div className="grid-item-key-header">
          <div className="spacer" />
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
            { FEATURES_FLAGS.plurals && (
            <span
              className="layerIcon iconWrapper button"
              onClick={() => {
                localizedLabelManager.updateKey(translationKey.keyName, [], !translationKey.plural);
              }}
            >
              <span className={'svg-container ' + (translationKey.plural ? 'plural-svg' : 'no-plural-svg')} />
            </span>
            )}

          </>
          )}
        </div>
        <div>
          { false && Object.values(translationKey.placeholders).map((placeholder: Placeholder) => (
            <div>
              {placeholder.name + ' ' + (placeholder.derivedArgumentPosition) + ' ' + (placeholder.specifiedArgumentPosition ? placeholder.specifiedArgumentPosition : '-') + ' ' + placeholder.named }
            </div>
          )) }
        </div>
        { false && select === undefined && (
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

                <div key={label} className="localized-label" onClick={() => onNodeSelect(label)}>
                  <AsyncImage figmaRemote={figmaRemote} localizedLabelManager={localizedLabelManager} labelId={label} />
                </div>

              ))}
            </>
          )}
        </div>
        )}
      </div>
      {languages.map((language, i, allLanguages) => {
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
          <div className={`group language-group ${languageSkipped ? ' skipped ' : ''}${language === baseLang ? ' baselanguage grid-item-border grid-item-border-top' : ''}${i === (allLanguages.length - 1) ? ' grid-item-border grid-item-border-bottom ' : ''}`} key={language}>
            <div className="column column-language grid-item-language"><span className="rowText">{language}</span></div>
            {getPluralFormsByLanguage(language).filter((plural) => translationKey.plural || plural === Plural.OTHER).map((plural, pluralsIndex, allPlurals) =>
              // eslint-disable-next-line consistent-return
              (
                <div key={plural} className={`group plural-group ${pluralsIndex === (allPlurals.length - 1) ? 'lastPlural  grid-item-border grid-item-border-bottom' : ''} ${pluralsIndex === 0 ? 'firstPlural  grid-item-border grid-item-border-top' : ''} ${translationKey.plural ? 'onePlural' : ' multiplePlurals'}${translationKey.translations[language as Language]?.[plural as Plural]?.skip === true ? ' skipped' : ''}`}>
                  <div className="column column-plural grid-item-plural grid-item-border"><span className="rowText">{translationKey.plural ? plural : ''}</span></div>
                  <div className="column  column-translation grid-item-translation grid-item-border translation-container translation">
                    <TranslationEditor
                      keyName={translationKey.keyName}
                      fillins={translationKey.defaultFillins}
                      editable={select === undefined}
                      match={searchMatch?.textMatches[language]?.[plural as Plural]}
                      onSave={async (text: any, fillins: Fillins) => {
                        let skip = translationKey.translations[language as Language]?.[plural as Plural]?.skip ?? false;

                        if (text !== undefined && text !== '') {
                          skip = false;
                        }
                        await localizedLabelManager.updateKey(translationKey.keyName!, [{
                          language, plural: plural as Plural, text, skip,
                        }], undefined, fillins);
                      }}
                      translationHTML={translationKey.translations[language as Language]?.[plural as Plural]?.text}
                      translationKeyStore={translationKeyStore}
                    />

                  </div>
                  <div className="column column-actions grid-item-actions grid-item-border grid-item-border-right">
                    { select === undefined && (
                    <>
                      { FEATURES_FLAGS.disableKeyLanguage
                      && (
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          // disable a translation
                          await localizedLabelManager.updateKey(translationKey.keyName!, [{
                            language,
                            plural,
                            text: translationKey.translations[language as Language]?.[plural as Plural]?.text,
                            skip: translationKey.translations[language as Language]?.[plural as Plural]?.skip === undefined ? true : !translationKey.translations[language as Language]![plural as Plural]!.skip,
                          }]);
                        }}
                      >
                        <span className={'svg-container' + (translationKey.translations[language as Language]?.[plural as Plural]?.skip === true ? ' eye-closed-svg' : ' eye-svg')} />
                      </span>
                      )}
                      { FEATURES_FLAGS.versioning && (
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          onShowHistoryClick(language, plural);
                        }}
                      >
                        <span className="svg-container history-svg" />
                      </span>
                      )}
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          setShowPlaceholderEditor(true);
                        }}
                      >
                        <span className="svg-container placeholder-svg" />
                      </span>
                    </>
                    )}
                  </div>
                </div>
              ))}
          </div>
        );
      })}
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
              version={entry.version}
              userName={entry.userName}
              userIconUrl={entry.userIconUrl}
              previousText={entry.previousText}
              onReuse={i === 0 ? undefined : async (text: string) => {
                if (showHistory === undefined) return;

                await localizedLabelManager.updateKey(translationKey.keyName!, [{
                  language: showHistory.language, plural: showHistory.plural as Plural, text, skip: false,
                }]);
                setShowHistory(undefined);
              }}
            />
          ))}
        </div>
      </OutsideClickHandler>
      <OutsideClickHandler
        onOutsideClick={() => { setShowPlaceholderEditor(false); }}
        disabled={showPlaceholderEditor === false}
        display="contents"
      >
        <div className={`side-drawer${showPlaceholderEditor !== false ? ' open' : ' '}`}>
          <div className="history_view--topHeader">
            Placeholders
            <span
              role="button"
              onClick={() => { setShowPlaceholderEditor(false); }}
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
          <div className="placeholder-view-grid">

            <div />
            <div />
            <div>Name</div>
            <div>Value</div>
            <div />

            {translationKey.placeholders && Object.entries(translationKey.placeholders).map((entry, i, array) => (
              <PlaceholderEditorListItem
                placeholder={entry[1]}
                fillin={translationKey.defaultFillins![entry[0]]?.value ?? ''}
                onValueChange={(placeholderName, fillinValue) => {
                  const newFillins = {
                    ...defaultFillins, // Copy the old fields
                  };
                  newFillins[placeholderName] = { value: fillinValue, default: fillinValue === '' };
                  setDefaultFillins(newFillins);
                }}
              />

            ))}
          </div>
          <input
            type="button"
            value="Save"
            disabled={false}
            onClick={() => {
              localizedLabelManager.updateKey(translationKey.keyName, [], undefined, defaultFillins, undefined);
            }}
          />
          <input
            type="button"
            value="Cancel"
            disabled={false}
            onClick={() => {

            }}
          />
        </div>
      </OutsideClickHandler>
    </div>
  );
}
