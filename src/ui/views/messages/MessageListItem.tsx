/* eslint-disable jsx-a11y/interactive-supports-focus */
/* eslint-disable prefer-template */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
/* eslint-disable jsx-a11y/label-has-associated-control */
import * as React from 'react';
import { useEffect, useState } from 'react';
import * as Sentry from '@sentry/react';

import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import OutsideClickHandler from 'react-outside-click-handler';
import { Locale } from '../../../lib/message/variants/Locale';
import { Plural, getPluralFormsByLanguage } from '../../../lib/message/variants/Plural';

import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';

import FigmaUtil from '../../../shared/FigmaUtil';

import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';

import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';
import AsyncImage from './AsyncImage';
import FEATURES_FLAGS from '../../featuretoggle';
import Drawer from '../../compontents/drawer/Drawer';
import TextField from '../../compontents/textfield/TextField';
import { Gender, genderList } from '../../../lib/message/variants/Gender';
import { FillinToPlaceholder } from '../../../lib/message/MessageExtnesions';
import { MessageParameterValues } from "../../../lib/message/MessageParameterValues";
// import ReactQuill from 'react-quill';

type TranslationKeyListItemProps = {
  rowClassNames?: string | undefined,
  figmaRemote: FigmaUtil,
  searchMatch: any,
  messageStore: MessageStoreMemory,
  messageId: string,
  localizedLabelManager: LocalizedLabelManagerUI,
  select?: Function,
  keySelected: boolean,
};

export default function TranslationKeyListItem({
  rowClassNames,
  figmaRemote,
  searchMatch,
  messageStore,
  messageId,
  localizedLabelManager,
  select,
  keySelected,
}: TranslationKeyListItemProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState(false);
  const [showUsage, setShowUsage] = useState(false);
  const [showPlaceholderEditor, setShowPlaceholderEditor] = useState(false);

  // const [history, setHistory] = useState<undefined | VersionEntry[]>(undefined);
  const [messageIdToDelete, setMessageIdToDelete] = useState<undefined | string>(undefined);
  const [keyToDeleteReferences, setKeyToDeleteReferences] = useState<undefined | number>(undefined);

  const [message, setMessage] = useState(localizedLabelManager.messageStore.getMessage(messageId)!);

  const [showHistory, setShowHistory] = useState<undefined | { language: Locale, gender: Gender, plural: Plural }>(undefined);

  const rowRef = React.useRef<HTMLDivElement>(null);

  const referencingLabels = [] as any[]; // TODO #22 CACHING source referencing nodes message.referencingTextNodes;

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  useEffect(() => {
    messageStore.inlangProject?.query.messages.get.subscribe({ where: { id: messageId } }, (updatedMessage) => {
      setMessage(updatedMessage);
    });
  }, []);

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

  const baseLang = messageStore.getRefLanugage();

  // create an array of languages with baselanguage at position zero
  const languages = [baseLang, ...messageStore.getLanugages()!.filter((l) => l !== baseLang)] as Locale[];

  const onShowHistoryClick = (language: Locale, gender: Gender, plural: Plural) => {
    // TODO #17 versioning implement when inlang history is in place
    // const specificHistory = [] as VersionEntry[];

    // let lastRelevantVersion = undefined as VersionEntry | undefined;

    // let currentVersion = 0;

    // const taggedVersions = [] as number[];

    // for (const tagIndex of Object.keys(message.historyTags)) {
    //   if (message.historyTags[parseInt(tagIndex, 10)]) {
    //     taggedVersions.push(parseInt(tagIndex, 10));
    //   }
    // }

    // // historyTags maps from the tag index to a key version
    // // a key may no exist in every tag ->
    // let currentTagIndex = 0;
    // let currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
    // let currentTaggedKeyVersion = currentVersionTagIndex && message.historyTags[currentVersionTagIndex] ? message.historyTags[currentVersionTagIndex] : -1;
    // let currentTag = currentVersionTagIndex ? messageStore.historyTags[currentVersionTagIndex] : undefined;

    // console.log('taqgs');
    // console.log(messageStore.historyTags);
    // console.log('key');
    // console.log(message);

    // // filter relevant history changes for the given key
    // for (const messageHistoryEntry of message.history) {
    //   if (messageHistoryEntry.variants?.[language]?.[gender]?.[plural] !== undefined) {
    //     if (currentTaggedKeyVersion < currentVersion) {
    //       currentTagIndex += 1;
    //       currentVersionTagIndex = taggedVersions[currentTagIndex] as number | undefined;
    //       currentTaggedKeyVersion = currentVersionTagIndex && message.historyTags[currentVersionTagIndex] ? message.historyTags[currentVersionTagIndex] : -1;
    //       currentTag = currentVersionTagIndex ? messageStore.historyTags[currentVersionTagIndex] : undefined;
    //     }

    //     const currentRelevantVersion = {
    //       versionTag: currentTag,
    //       text: messageHistoryEntry.variants?.[language]?.[gender]?.[plural]?.text ?? lastRelevantVersion?.text,
    //       previousText: lastRelevantVersion?.text,
    //       userName: messageHistoryEntry.user,
    //       version: currentVersion,
    //       date: messageHistoryEntry.date,
    //       userIconUrl: messageHistoryEntry.user,
    //       skip: messageHistoryEntry.variants?.[language]?.[gender]?.[plural]?.skip ?? false,
    //       verified: messageHistoryEntry.variants?.[language]?.[gender]?.[plural]?.verified ?? false, // TODO #9 check correct state for history view
    //     };

    //     // relevant historyEntry
    //     specificHistory.push(currentRelevantVersion);

    //     if (currentTaggedKeyVersion >= currentVersion && lastRelevantVersion && currentRelevantVersion.versionTag === lastRelevantVersion.versionTag) {
    //       // remove tag from last entry since this one is a better candidate
    //       lastRelevantVersion.versionTag = undefined;
    //     }
    //     lastRelevantVersion = currentRelevantVersion;
    //   }

    //   currentVersion += 1;
    // }

    // setHistory(specificHistory.reverse());
    // setShowHistory({ language, gender, plural });
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
                // TODO #17 versioning - support message renaming. We will allow to rename not before we have the history that can keep track of name changes
                // localizedLabelManager.updateMessage(message.id, {
                //   variants: [],
                //   name: messageName,
                // });
              }}
              text={message.id}
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
                // localizedLabelManager.updateMessage(message.id, { variants: [], plural: !message.plural });
              }}
            >
              <span className={'svg-container ' + (/* message.plural */ false ? 'plural-svg' : 'no-plural-svg')} />
            </span>
            )}

          </>
          )}
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
        const languageSkipped = false;
        // TODO #21 enable when language skip is active
        // if (message.variants[language as Locale] !== undefined) {
        //   for (const gender of Object.keys(message.variants[language as Locale]!)) {
        //     for (const plural of Object.keys(message.variants[language as Locale]![gender as Gender]!)) {
        //       if (message.variants[language as Locale]![gender as Gender]![plural as Plural]!.skip !== true) {
        //         languageSkipped = false;
        //         break;
        //       } else {
        //         languageSkipped = true;
        //       }
        //     }
        //   }
        // }

        const variant = message.variants.find((variant) => variant.languageTag === language);
        let variantHTML = '';
        if (variant !== undefined) {
          variantHTML = MessageStoreMemory.patternToHtml(variant.pattern);
        }

        return (
          <div className={`group language-group ${languageSkipped ? ' skipped ' : ''}${language === baseLang ? ' baselanguage grid-item-border grid-item-border-top' : ''}${i === (allLanguages.length - 1) ? ' grid-item-border grid-item-border-bottom ' : ''}`} key={language}>
            <div className="column column-language grid-item-language"><span className="rowText">{language}</span></div>
            {/* {genderList.filter(((gender) => message.gender || gender === Gender.NEUTRAL)).map((gender, genderIndex, allGenders) => ( */}
            {/* <div key={gender} className={`group gender-group ${genderIndex === (allGenders.length - 1) ? 'lastGender  grid-item-border grid-item-border-bottom' : ''} ${genderIndex === 0 ? 'firstGender  grid-item-border grid-item-border-top' : ''} ${message.gender ? 'oneGender' : ' multipleGenders'}`}> */}
            <div className="group gender-group lastGender  grid-item-border grid-item-border-bottom firstGender  grid-item-border grid-item-border-top oneGender">
              <div className="column column-gender grid-item-gender grid-item-border"><span className="rowText">{ /* message.gender ? gender : '' */ }</span></div>
              {/* {getPluralFormsByLanguage(language).filter((plural) => message.plural || plural === Plural.OTHER).map((plural, pluralsIndex, allPlurals) =>
                // eslint-disable-next-line consistent-return
                  ( */}
              {/* <div key={plural} className={`group plural-group ${pluralsIndex === (allPlurals.length - 1) ? 'lastPlural  grid-item-border grid-item-border-bottom' : ''} ${pluralsIndex === 0 ? 'firstPlural  grid-item-border grid-item-border-top' : ''} ${message.plural ? 'onePlural' : ' multiplePlurals'}${message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.skip === true ? ' skipped' : ''}`}> */}
              <div className="group plural-group lastPlural  grid-item-border grid-item-border-bottom firstPlural  grid-item-border grid-item-border-top onePlural">
                <div className="column column-plural grid-item-plural grid-item-border"><span className="rowText">{ /* message.plural ? plural : '' */ }</span></div>
                <div className="column  column-translation grid-item-translation grid-item-border translation-container translation">
                  <TranslationEditor
                    parameterValues={{} /*  ODO #18 default values  support fillins message.defaultFillins */}
                    editable={select === undefined}
                    isDisabled={false}
                    match={searchMatch?.textMatches[language]?.['*']}
                    onSave={async (text: string | undefined, parameters: MessageParameterValues) => {
                      // let skip = message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.skip ?? false;

                      Object.values(parameters).forEach((parameter) => {
                        // eslint-disable-next-line no-param-reassign
                        parameter.default = true;
                      });

                      // TODO #18 variables how to deal with default values acutally - as soon as we have variants this can become tricky since the matcher does differ from the default value :( )
                      // - one thought on this - variables used in selectors can not have a default value...
                      const updatedMessage = MessageStoreMemory.upsertVariantPatternHtml(message, undefined, language, [], text ?? '');
                      await localizedLabelManager.updateMessage(updatedMessage, parameters);
                    }}
                    variantHTML={variantHTML}
                    messageStore={messageStore}
                  />

                </div>
                <div className="column column-actions grid-item-actions grid-item-border grid-item-border-right">
                  { select === undefined && (
                    <>
                      {/* { FEATURES_FLAGS.disableKeyLanguage
                      && (
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          // disable a translation
                          await localizedLabelManager.updateMessage(message.id!, {
                            variants: [{
                              locale: language,
                              gender,
                              plural,
                              text: message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.text,
                              skip: message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.skip === undefined ? true : !message.variants[language as Locale]![gender as Gender]![plural as Plural]!.skip,
                            }],
                          });
                        }}
                      >
                        <span className={'svg-container' + (message.variants[language as Locale]?.[gender as Gender]?.[plural as Plural]?.skip === true ? ' eye-closed-svg' : ' eye-svg')} />
                      </span>
                      )}
                      { FEATURES_FLAGS.versioning && (
                      <span
                        className="layerIcon iconWrapper button"
                        onClick={async () => {
                          // TODO #17 versioning - history onShowHistoryClick(language, gender, plural);
                        }}
                      >
                        <span className="svg-container history-svg" />
                      </span>
                      )} */}
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
              {/* ))} */}
            </div>
            {/* ))} */}

          </div>
        );
      })}
      {/* TODO #17 versioning - enable when inlang supports history
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

                await localizedLabelManager.updateMessage(message.id!, {
                  variants: [{
                    locale: showHistory.language, gender: showHistory.gender, plural: showHistory.plural as Plural, text, skip: false,
                  }],
                });
                setShowHistory(undefined);
              }}
            />
          ))}
        </div>
      </OutsideClickHandler> */}
      {/* TODO #18 variables add fillins editor
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
              localizedLabelManager.updateMessage(message.id, {
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
      </OutsideClickHandler> */}
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
              localizedLabelManager.deleteMessage(message.id).catch((e: Error) => {
                Sentry.captureException(e);
                figmaRemote.notifyError(e.message);
              });
              setMessageIdToDelete(undefined);
            },
          },

        ]}
        shown={messageIdToDelete !== undefined}
      >
        <div className="history_view--topHeader">
          Delete
          {' '}
          {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
        </div>
        <div>
          {keyToDeleteReferences !== undefined && keyToDeleteReferences > 0 && (
            <>
              Deletion of the Message
              {' '}
              {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
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
            {localizedLabelManager.messageStore.getMessage(messageIdToDelete!)?.id}
            {' '}
            is not refrenced by a label
          </>
          )}
        </div>
      </Drawer>
    </div>
  );
}
