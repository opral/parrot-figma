/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable prefer-template */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-associated-control */
import * as React from 'react';
import { useEffect, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import OutsideClickHandler from 'react-outside-click-handler';
import { Locale } from '../../../lib/message/variants/Locale';
import { Plural, getPluralFormsByLanguage } from '../../../lib/message/variants/Plural';
import { Fillins, HistoryTag, Placeholder } from '../../../lib/message/Message';
import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';

import HistoryEntryView from '../../compontents/history/HistoryEntryView';
import { MessageUI } from '../../../lib/message/MessageUI';
import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';
import AsyncImage from './AsyncImage';
import FEATURES_FLAGS from '../../featuretoggle';
import Drawer from '../../compontents/drawer/Drawer';
import TextField from '../../compontents/textfield/TextField';
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
  message: MessageUI,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  messageStore: MessageStoreMemory,
  localizedLabelManager: LocalizedLabelManagerUI,
  select?: Function,
  keySelected: boolean,
};

export default function TranslationKeyListItem({
  rowClassNames,
  message,
  figmaRemote,
  searchMatch,
  messageStore,
  localizedLabelManager,
  select,
  keySelected,
}: TranslationKeyListItemProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showPlaceholderEditor, setShowPlaceholderEditor] = useState(false);
  const [defaultFillins, setDefaultFillins] = useState(message.defaultFillins);
  const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);
  const [messageIdToDelete, setMessageIdToDelete] = useState<undefined | string>(undefined);
  const [keyToDeleteReferences, setKeyToDeleteReferences] = useState<undefined | number>(undefined);

  const [showHistory, setShowHistory] = useState<undefined | { language: Locale, plural: Plural }>(undefined);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = message.referencingTextNodes;

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  useEffect(() => {
    const updateReferenceCount = async () => {
      const referenceCount = (await localizedLabelManager.getWithMessage(messageIdToDelete!)).length;
      setKeyToDeleteReferences(referenceCount);
    };

    if (messageIdToDelete) {
      updateReferenceCount();
    }
  }, [messageIdToDelete]);

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

  const baseLang = messageStore.getBaseLanugage();

  // create an array of languages with baselanguage at position zero
  const languages = [baseLang, ...messageStore.getLanugages()!.filter((l) => l !== baseLang)] as Locale[];

  const onShowHistoryClick = (language: Locale, plural: Plural) => {
    const specificHistory = [] as VersionEntry[];

    let lastRelevantVersion = undefined as VersionEntry | undefined;

    let currentVersion = 0;

    const taggedVersions = [] as number[];

    for (const tagIndex of Object.keys(message.historyTags)) {
      if (message.historyTags[parseInt(tagIndex, 10)]) {
        taggedVersions.push(parseInt(tagIndex, 10));
      }
    }

    // historyTags maps from the tag index to a key version
    // a key may no exist in every tag ->
    let currentTagIndex = 0;
    let currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
    let currentTaggedKeyVersion = currentVersionTagIndex && message.historyTags[currentVersionTagIndex] ? message.historyTags[currentVersionTagIndex] : -1;
    let currentTag = currentVersionTagIndex ? messageStore.historyTags[currentVersionTagIndex] : undefined;

    console.log('taqgs');
    console.log(messageStore.historyTags);
    console.log('key');
    console.log(message);

    // filter relevant history changes for the given key
    for (const messageHistoryEntry of message.history) {
      if (messageHistoryEntry.variants?.[language]?.[plural] !== undefined) {
        if (currentTaggedKeyVersion < currentVersion) {
          currentTagIndex += 1;
          currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
          currentTaggedKeyVersion = currentVersionTagIndex && message.historyTags[currentVersionTagIndex] ? message.historyTags[currentVersionTagIndex] : -1;
          currentTag = currentVersionTagIndex ? messageStore.historyTags[currentVersionTagIndex] : undefined;
        }

        const currentRelevantVersion = {
          versionTag: currentTag,
          text: messageHistoryEntry.variants?.[language]?.[plural]?.text ?? lastRelevantVersion?.text,
          previousText: lastRelevantVersion?.text,
          userName: messageHistoryEntry.user,
          version: currentVersion,
          date: messageHistoryEntry.date,
          userIconUrl: messageHistoryEntry.user,
          skip: messageHistoryEntry.variants?.[language]?.[plural]?.skip ?? false,
          verified: messageHistoryEntry.variants?.[language]?.[plural]?.verified ?? false, // TODO #9 check correct state for history view
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
      className={`row row-key ${selected || keySelected ? 'selected' : ''} ${rowClassNames !== undefined ? rowClassNames : ''}`}
      onClick={() => {
        if (select) {
          select(message.id);
        }
      }}
    >
      <div className="grid-full-height-helper" />
      <div className={'column column-key grid-item-key ' + (keySelected ? ' selected' : '')}>
        <div className="grid-item-key-header">
          <div className="spacer" />
          <span className="rowText">
            <TextField
              singleClick={false}
              onSave={async (messageName: string) => {
                localizedLabelManager.updateKey(message.id, {
                  variants: [],
                  name: messageName,
                });
              }}
              text={message.name}
            />
          </span>
        </div>
        <div className="grid-item-actions">
          { select === undefined && (
          <>
            <span
              className="layerIcon iconWrapper button"
              data-tooltip-content="Delete this translation key"
              onClick={() => {
                setMessageIdToDelete(message.id);
              }}
            >
              <span className="svg-container trash-svg" />
            </span>
            { FEATURES_FLAGS.plurals && (
            <span
              className="layerIcon iconWrapper button"
              onClick={() => {
                localizedLabelManager.updateKey(message.id, { variants: [], plural: !message.plural });
              }}
            >
              <span className={'svg-container ' + (message.plural ? 'plural-svg' : 'no-plural-svg')} />
            </span>
            )}

          </>
          )}
        </div>
        <div>
          { false && Object.values(message.placeholders).map((placeholder: Placeholder) => (
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
        if (message.variants[language as Locale] !== undefined) {
          for (const plural of Object.keys(message.variants[language as Locale]!)) {
            if (message.variants[language as Locale]![plural as Plural]!.skip !== true) {
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
            {getPluralFormsByLanguage(language).filter((plural) => message.plural || plural === Plural.OTHER).map((plural, pluralsIndex, allPlurals) =>
              // eslint-disable-next-line consistent-return
              (
                <div key={plural} className={`group plural-group ${pluralsIndex === (allPlurals.length - 1) ? 'lastPlural  grid-item-border grid-item-border-bottom' : ''} ${pluralsIndex === 0 ? 'firstPlural  grid-item-border grid-item-border-top' : ''} ${message.plural ? 'onePlural' : ' multiplePlurals'}${message.variants[language as Locale]?.[plural as Plural]?.skip === true ? ' skipped' : ''}`}>
                  <div className="column column-plural grid-item-plural grid-item-border"><span className="rowText">{message.plural ? plural : ''}</span></div>
                  <div className="column  column-translation grid-item-translation grid-item-border translation-container translation">
                    <TranslationEditor
                      fillins={message.defaultFillins}
                      editable={select === undefined}
                      match={searchMatch?.textMatches[language]?.[plural as Plural]}
                      onSave={async (text: any, fillins: Fillins) => {
                        let skip = message.variants[language as Locale]?.[plural as Plural]?.skip ?? false;

                        if (text !== undefined && text !== '') {
                          skip = false;
                        }
                        await localizedLabelManager.updateKey(message.id!, {
                          variants: [{
                            language, plural: plural as Plural, text, skip,
                          }],
                          fillins,
                        });
                      }}
                      variantHTML={message.variants[language as Locale]?.[plural as Plural]?.text}
                      messageStore={messageStore}
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
                          await localizedLabelManager.updateKey(message.id!, {
                            variants: [{
                              language,
                              plural,
                              text: message.variants[language as Locale]?.[plural as Plural]?.text,
                              skip: message.variants[language as Locale]?.[plural as Plural]?.skip === undefined ? true : !message.variants[language as Locale]![plural as Plural]!.skip,
                            }],
                          });
                        }}
                      >
                        <span className={'svg-container' + (message.variants[language as Locale]?.[plural as Plural]?.skip === true ? ' eye-closed-svg' : ' eye-svg')} />
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

                await localizedLabelManager.updateKey(message.id!, {
                  variants: [{
                    language: showHistory.language, plural: showHistory.plural as Plural, text, skip: false,
                  }],
                });
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

            {message.placeholders && Object.entries(message.placeholders).map((entry, i, array) => (
              <PlaceholderEditorListItem
                placeholder={entry[1]}
                fillin={message.defaultFillins![entry[0]]?.value ?? ''}
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
              localizedLabelManager.updateKey(message.id, {
                fillins: defaultFillins,
                variants: [],
              });
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
      <Drawer
        position="top"
        buttons={[
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              // set back to head
              setMessageIdToDelete(undefined);
            },
          },
          {
            type: 'primary-destructive',
            text: 'Delete Key',
            key: 'enter',
            disabled: messageIdToDelete === undefined,
            callback: () => {
              localizedLabelManager.deleteKey(message.id);
              setMessageIdToDelete(undefined);
            },
          },

        ]}
        shown={messageIdToDelete !== undefined}
      >
        <div className="history_view--topHeader">
          Delete
          {' '}
          {messageIdToDelete}
        </div>
        <div>
          {keyToDeleteReferences !== undefined && keyToDeleteReferences > 0 && (
            <>
              Deletion of the key
              {messageIdToDelete}
              {' '}
              will unlink
              {' '}
              {keyToDeleteReferences}
              {' '}
              referencing labels.

            </>
          )}
          {keyToDeleteReferences === 0 && (
          <>
            Key
            {' '}
            {messageIdToDelete}
            {' '}
            is not refrenced by a label
          </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
