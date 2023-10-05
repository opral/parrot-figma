/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import * as Sentry from '@sentry/react';
import { useEffect, useRef, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import { Plural } from '../../../lib/message/variants/Plural';
import { MessageLinkState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import FigmaUtil from '../../../shared/FigmaUtil';
import InputSelect, { InputSelectOption, InputSelectionOptionType } from '../../compontents/selectInput/inputselect';
import Select, { SelectOption } from '../../compontents/select/select';
import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';
import { Locale } from '../../../lib/message/variants/Locale';
import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import TextField from '../../compontents/textfield/TextField';
import MessageListView from '../messages/MessageListView';
import { UILocalizedLabel } from '../../../lib/localizedlabels/UILocalizedLabel';
import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';
import FEATURES_FLAGS from '../../featuretoggle';
import { track } from '../../utils/analytics';
import Drawer from '../../compontents/drawer/Drawer';
import { Gender } from '../../../lib/message/variants/Gender';
import { FillinToPlaceholder, MessageParameterValues } from '../../../lib/message/MessageExtnesions';

type LocalizedLabelListItemProps = {
  showMessage: Function,
  localizedLabel: UILocalizedLabel,
  figmaRemote: FigmaUtil,
  localizedLabelManager: LocalizedLabelManagerUI,
  selected: 'selected-by-parent' | 'selected' | 'unselected'
};

export default function LocalizedLabelListItem({
  showMessage,
  localizedLabel,
  figmaRemote,
  localizedLabelManager,
  selected,
}: LocalizedLabelListItemProps) {
  const { messageStore } = localizedLabelManager;
  const message = localizedLabel.messageLinkState !== MessageLinkState.Unset ? messageStore.getMessage(localizedLabel.messageId!) : undefined;

  const rowRef = React.useRef<HTMLDivElement>(null);

  const labelState = localizedLabel.state!;

  const [messageSearch, setMessageSearch] = useState(undefined as any);
  const drawerSelectedKey = useRef<string | undefined>(undefined);
  // Dummy state variable to trigger re-render when currentHighlightIndex.current changes
  const [, setDummyState] = useState<any>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution

  const pluralsAvailable = [] as SelectOption[];

  async function createNewVersionFromDesign() {
    await localizedLabelManager.createNewVersionFromLabelState(localizedLabel).catch((e: Error) => {
      Sentry.captureException(e);
      figmaRemote.notifyError(e.message);
    });
  }

  async function fixLints() {
    await localizedLabelManager.fixLabelLints(localizedLabel, localizedLabel.matchingLabelLints).catch((e: Error) => {
      Sentry.captureException(e);
      figmaRemote.notifyError(e.message);
    });
  }

  async function updateToLatestKeyVersion() {
    track('updateToLatestKeyVersion');
    await localizedLabelManager.updateToMessageHead([localizedLabel]).catch((e: Error) => {
      Sentry.captureException(e);
      figmaRemote.notifyError(e.message);
    });
  }

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  // TODO #18 selectors check if inlang supports plurals
  // if (messages) {
  //   for (const plural of Object.keys(messages)) {
  //     const pluralOption = {
  //       value: plural, label: plural,
  //     };
  //     pluralsAvailable.push(pluralOption);
  //   }
  // } else {
  pluralsAvailable.push({
    value: Plural.OTHER, label: Plural.OTHER,
  });
  // }

  let messageName = '';

  if (localizedLabel.messageLinkState === MessageLinkState.Linked) {
    messageName = localizedLabel.getMessageName()!;
  }

  useEffect(() => {
    setDummyState({});
  }, [localizedLabel]);

  return (
    <>
      <Drawer
        position="top"
        buttons={[
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              setMessageSearch(undefined);
            },
          },
          {
            type: 'primary',
            text: 'Use Key',
            key: 'enter',
            callback: () => {
              const messageToLink = localizedLabelManager.messageStore.getMessage(drawerSelectedKey.current!)!;

              localizedLabelManager.linkMessage(localizedLabel, messageToLink.id, localizedLabel.rootFrameLanguage!).catch((e) => {
                figmaRemote.notifyError(`could not set message${e.message}`);
                Sentry.captureException(e);
              });
              setMessageSearch(undefined);
            },
            disabled: drawerSelectedKey.current === undefined,
          },

        ]}
        shown={messageSearch !== undefined}
      >
        <div className="history_view--topHeader" style={{ width: '3000px' }}>
          Select Key
        </div>
        { messageSearch !== undefined && (
        <MessageListView
          showSearchBar
          messageStore={messageStore}
          localizedLabelManager={localizedLabelManager}
          figmaRemote={figmaRemote}
          selectedMessageId={drawerSelectedKey.current}
          initialSearchQuery={MessageStoreMemory.toQueryObject(`name:* ${messageSearch.search}`)}
          select={(key: string, language: Locale, plural: Plural) => {
            drawerSelectedKey.current = key;
            setDummyState({});
          }}
          highlightSelectedNodes={false}
        />
        )}

      </Drawer>

      <div className={`row ${selected}${localizedLabel.messageLinkState === MessageLinkState.Linked && message !== undefined ? ' key-set ' : ' key-unset '}`} onClick={() => { onNodeSelect(localizedLabel.nodeId); }}>
        <div className="column-1">
          <div className="localized-label">
            <div className="spacer" />
            <div className="spacer" />
            <div className="element-symbol">
              <div className="svg-container text-sign-svg" />
            </div>
            <TextField
              singleClick={false}
              onSave={async (labelName: string) => {
                await localizedLabelManager.updateLabelName(localizedLabel, labelName).catch((e) => {
                  figmaRemote.notifyError(`could not set message${e.message}`);
                  Sentry.captureException(e);
                });
              }}
              text={localizedLabel.name}
            />

          </div>

        </div>
        <div className="column localized-text column-2">
          <div className="translation-container" ref={rowRef}>
            <div className="localized-label-details">
              <div className="key-panel">
                <InputSelect
                  className="key-select"
                  placeholder="Link Message..."
                  isDisabled={localizedLabel.matchingLabelLints.length > 0}
                  inputPlaceholder="e.g. home__tagline"
                  tooltip="Link a Message to this Text to reuse messages and for a straight forwaredd Developer handover."
                  onCancel={() => {
                    setDummyState({});
                  }}
                  onChange={async (selectedOption) => {
                    if (selectedOption.type === InputSelectionOptionType.ACTION) {
                      if (selectedOption.value === 'select-message') {
                        setMessageSearch({
                          search: localizedLabel.characters,
                        });
                      } else if (selectedOption.value === 'show-message') {
                        showMessage(localizedLabel.getMessageName());
                      } else if (selectedOption.value === 'reset') { // triggered by empty field - option added by the select field it self
                        await localizedLabelManager.unsetLabel(localizedLabel);
                      }
                    } else if (selectedOption.type === InputSelectionOptionType.ADD) {
                      await localizedLabelManager.linkMessage(localizedLabel, selectedOption.value, localizedLabel.rootFrameLanguage!);
                    } else if (selectedOption.type === InputSelectionOptionType.SUGGESTION) {
                      await localizedLabelManager.linkMessage(localizedLabel, selectedOption.value, localizedLabel.rootFrameLanguage!);
                    }
                    /* if (selectedOption.type === 'action') {
                      if (selectedOption.value === 'no-translation') {
                        localizedLabelManager.setNoKey(localizedLabel);
                      } else if (selectedOption.value === 'select-message') {
                        setSearchKey({
                          search: localizedLabel.characters,
                        });
                      } else if (selectedOption.value === 'create-key') {
                        setNewKey(localizedLabel.derivedKey ?? '');
                      } else if (selectedOption.value === 'show-message') {
                        showKey(localizedLabel.key!);
                      }
                    } else if (selectedOption.type === 'key') {
                      localizedLabelManager.linkKey(localizedLabel, selectedOption.value as string, selectedOption.language!, selectedOption.plural!);
                    } */
                  }}
                  valueReplaceFn={(value) => value.replace(/[ .]/g, (match) => (match === '.' ? '__' : '_'))}
                  defaultValue={messageName}
                  getOptions={(enteredValue: string) => {
                    let options = [] as InputSelectOption[];

                    const keySearch = enteredValue === '' ? '*' : enteredValue;
                    const textMatchQuery = MessageStoreMemory.toQueryObject(`exact_text:true name:${keySearch} ${localizedLabel.characters}`);
                    const { matchingNames: suggestedKeys } = messageStore.findMessages(textMatchQuery);
                    const keyMatchQuery = MessageStoreMemory.toQueryObject(`name:${keySearch}`);
                    const { matchingNames: matchingKeysByName } = messageStore.findMessages(keyMatchQuery);

                    const isValidKey = enteredValue.length >= 0 && /^[a-zA-Z0-9]$/.test(enteredValue[enteredValue.length - 1]);

                    if (isValidKey && !suggestedKeys.has(enteredValue) && !matchingKeysByName.has(enteredValue)) {
                      options.push({
                        type: InputSelectionOptionType.ADD,
                        value: enteredValue,
                        label: '',
                      });
                    }

                    if (suggestedKeys.size > 0) {
                      options.push({
                        type: InputSelectionOptionType.DIVIDER,
                        value: '',
                        label: 'Text matches',
                      });
                    }

                    options = options.concat([...suggestedKeys].map((key) => {
                      matchingKeysByName.delete(key);
                      return {
                        type: InputSelectionOptionType.SUGGESTION,
                        value: messageStore.getMessage(key)!.id,
                        label: messageStore.getMessage(key)!.id,
                      };
                    }));

                    if (keySearch.length > 2 && matchingKeysByName.size > 0) {
                      options.push({
                        type: InputSelectionOptionType.DIVIDER,
                        value: '',
                        label: 'Messages',
                      });

                      options = options.concat([...matchingKeysByName].map((key) => ({
                        type: InputSelectionOptionType.SUGGESTION,
                        value: messageStore.getMessage(key)!.id,
                        label: messageStore.getMessage(key)!.id,
                      })));
                    }

                    if (options.length > 1) {
                      options.push({
                        type: InputSelectionOptionType.DIVIDER,
                        value: '',
                        label: '',
                      });
                    }

                    options.push({
                      label: 'Full Search...',
                      value: 'select-message',
                      type: InputSelectionOptionType.ACTION,
                    });

                    if (messageName && messageName !== '') {
                      options.push({
                        label: 'Show linked Message...',
                        value: 'show-message',
                        type: InputSelectionOptionType.ACTION,
                      });
                    }

                    return options;
                  }}
                />

                <div className="grid">

                  <div className="languageWrapper" key={localizedLabel.language}>
                    <div
                      className="grid-item-language"
                      data-tooltip-content="Current Language of this Label"
                    >
                      <span className="rowText">{localizedLabel.language}</span>

                    </div>
                    {/* <div key={localizedLabel.pluralId} className={`keyPluralWrapper ${translatedKey?.plural ? 'onePlural' : ' multiplePlurals'}`}> */}
                    <div className="keyPluralWrapper onePlural">
                      { FEATURES_FLAGS.plurals
                      && (
                      <div className="grid-item-plural">
                        {localizedLabel.messageLinkState === MessageLinkState.Linked && (
                        <>
                          {/* {translatedKey?.plural && (
                          <Select
                            onChange={(value) => {
                              localizedLabelManager.updateLabelPlural(localizedLabel, value.value! as Plural);
                            }}
                            defaultValue={pluralsAvailable.find((opt) => opt.value === localizedLabel.pluralId)}
                            getOptions={() => pluralsAvailable}
                            placeholder=""
                          />
                          )}
                          {!translatedKey?.plural && ( */}
                          {/* TODO #18  selectors - check pluralid */}
                          <span className="rowText">{/* localizedLabel.pluralId */}</span>
                          {/* )} */}
                        </>
                        )}

                      </div>
                      )}
                      <div className="grid-item-translation translation-container translation">
                        <TranslationEditor
                          editable
                          isDisabled={localizedLabel.matchingLabelLints.length > 0}
                          match={undefined}
                          onCancel={async () => {
                            localizedLabelManager.commitUndo();
                          }}
                          onChange={async (patternHtml: string | undefined, parameters: MessageParameterValues, reset: any) => {
                            if (patternHtml !== undefined && patternHtml !== '') {
                              localizedLabelManager.updateLabelPatternHtml(
                                localizedLabel,
                                patternHtml,
                                parameters,
                              ).catch((e: Error) => {
                                Sentry.captureException(e);
                                figmaRemote.notifyError(e.message);
                                reset();
                              });
                            }
                          }}
                          parameterValues={localizedLabel.parameterValues}
                          variantHTML={localizedLabel.currentPatternHTML}
                          messageStore={messageStore}
                        />
                        {/* TODO #18 make paramter editable again when we have selectors in place - variables only used as selectors can't be accesed otherwise
                        { selected !== 'unselected' && (
                          <div className="placeholder-view-grid" style={{ display: Object.keys(localizedLabel.parameterValues).length > 0 ? undefined : 'none' }}>

                            <div />
                            <div />
                            <div>Placeholder</div>
                            <div />
                            <div />
                            {Object.entries(localizedLabel.parameterValues).map((entry, i, array) => (
                              <PlaceholderEditorListItem
                                key={entry[0]}
                                placeholder={entry[1]}
                                fillin={localizedLabel.parameterValues?.[entry[0]]?.value ? localizedLabel.parameterValues?.[entry[0]]?.value : 'unset'}
                                onValueChange={(placeholderName, fillinValue) => {
                                  // TODO #18 variables - this is not used at the moment but bases on fillins instead of parameters
                                  localizedLabelManager.updateLabelFillin(localizedLabel, placeholderName, fillinValue).catch((e: Error) => {
                                    Sentry.captureException(e);
                                    figmaRemote.notifyError(e.message);
                                  });
                                }}
                              />

                            ))}
                          </div>
                        )} */}
                      </div>
                    </div>
                  </div>
                </div>

                { (localizedLabel.messageLinkState === MessageLinkState.Linked && (labelState.modified || localizedLabel.language !== localizedLabel.rootFrameLanguage)) && ( // allow the user to catch up with the keys version
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-content="Reset all changes"
                  onClick={updateToLatestKeyVersion}
                >
                  <span className="svg-container reset-instance-svg" />
                </span>
                )}

                { ((localizedLabel.messageLinkState === MessageLinkState.Linked && labelState.modified)) && (
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-content="Push changes to Message"
                  onClick={createNewVersionFromDesign}
                >
                  <span className="svg-container use-label-svg" />
                </span>
                )}

              </div>
            </div>

          </div>
          <div className="row-actions">
            { ((localizedLabel.matchingLabelLints.length > 0)) && (
            <span
              className="row-action-icon"
              data-tooltip-content={`Label contains unsupported inline styles: ${localizedLabel.matchingLabelLints.join(', ')}`}
              onClick={fixLints}
            >
              <span className="svg-container warning-svg" />
            </span>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
