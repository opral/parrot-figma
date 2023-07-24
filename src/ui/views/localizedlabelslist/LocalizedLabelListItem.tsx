/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import { Plural } from '../../../lib/base/Plural';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import FigmaUtil from '../../../shared/FigmaUtil';
import InputSelect, { InputSelectOption, InputSelectionOptionType } from '../../compontents/selectInput/inputselect';
import Select, { SelectOption } from '../../compontents/select/select';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import { Language } from '../../../lib/base/Language';
import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import TextField from '../../compontents/textfield/TextField';
import TranslationKeyListView from '../translationkeys/TranslationKeyListView';
import { UILocalizedLabel } from '../../../lib/localizedlabels/UILocalizedLabel';
import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';
import { Fillins } from '../../../lib/keystore/TranslationKey';
import FEATURES_FLAGS from '../../featuretoggle';
import { track } from '../../utils/analytics';
import Drawer from '../../compontents/drawer/Drawer';

type LocalizedLabelListItemProps = {
  showKey: Function,
  localizedLabel: UILocalizedLabel,
  figmaRemote: FigmaUtil,
  localizedLabelManager: LocalizedLabelManagerUI,
  selected: 'selected-by-parent' | 'selected' | 'unselected'
};

export default function LocalizedLabelListItem({
  showKey,
  localizedLabel,
  figmaRemote,
  localizedLabelManager,
  selected,
}: LocalizedLabelListItemProps) {
  const translationKeyStore = localizedLabelManager.keyStore;
  const translatedKey = localizedLabel.keyType !== KeyState.Unset ? translationKeyStore.getKey(localizedLabel.key!) : undefined;

  const rowRef = React.useRef<HTMLDivElement>(null);

  const labelState = localizedLabel.state!;

  const [searchKey, setSearchKey] = useState(undefined as any);
  const drawerSelectedKey = useRef<string | undefined>(undefined);
  // Dummy state variable to trigger re-render when currentHighlightIndex.current changes
  const [, setDummyState] = useState<any>();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
  const translations = translatedKey?.translations[localizedLabel.language];

  const pluralsAvailable = [] as SelectOption[];

  async function createNewVersionFromDesign() {
    await localizedLabelManager.createNewVersionFromLabelState(localizedLabel);
  }

  async function updateToLatestKeyVersion() {
    track('updateToLatestKeyVersion');
    await localizedLabelManager.updateToLatestKeyVersion([localizedLabel]);
  }

  async function revertDesignChanges() {
    await localizedLabelManager.revertDesignChanges(localizedLabel);
  }

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  if (translations) {
    for (const plural of Object.keys(translations)) {
      const pluralOption = {
        value: plural, label: plural,
      };
      pluralsAvailable.push(pluralOption);
    }
  } else {
    pluralsAvailable.push({
      value: Plural.OTHER, label: Plural.OTHER,
    });
  }

  
  let keyValue = '';

  if (localizedLabel.keyType === KeyState.Linked && localizedLabel.key) {
    keyValue = localizedLabel.key;
  }

  console.log('collecting information' + keyValue);

  useEffect(() => {
    setDummyState({});
    console.log('dummy state set');
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
              setSearchKey(undefined);
            },
          },
          {
            type: 'primary',
            text: 'Use Key',
            key: 'enter',
            callback: () => {
              localizedLabelManager.linkKey(localizedLabel, drawerSelectedKey.current!, localizedLabel.rootFrameLanguage!, Plural.OTHER);
              setSearchKey(undefined);
            },
            disabled: drawerSelectedKey.current === undefined,
          },

        ]}
        shown={searchKey !== undefined}
      >
        <div className="history_view--topHeader" style={{ width: '3000px' }}>
          Select Key
        </div>
        { searchKey !== undefined && (
        <TranslationKeyListView
          showSearchBar
          translationKeyStore={translationKeyStore}
          localizedLabelManager={localizedLabelManager}
          figmaRemote={figmaRemote}
          selectedKey={drawerSelectedKey.current}
          initialSearchQuery={MemoryTranslationKeyStore.toQueryObject(`key:* ${searchKey.search}`)}
          select={(key: string, language: Language, plural: Plural) => {
            drawerSelectedKey.current = key;
            setDummyState({});
          }}
          highlightSelectedNodes={false}
        />
        )}

      </Drawer>

      <div className={`row ${selected}${localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? ' key-set ' : ' key-unset '}`} onClick={() => { onNodeSelect(localizedLabel.nodeId); }}>
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
                await localizedLabelManager.updateLabelName(localizedLabel, labelName);
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
                  placeholder="Link Translation Key"
                  inputPlaceholder="e.g. home__tagline"
                  tooltip="Link a Translation Key to this Text to reuse translations and straight forwaredd Developer handover."
                  onCancel={() => {
                    setDummyState({});
                  }}
                  onChange={async (selectedOption) => {
                    if (selectedOption.type === InputSelectionOptionType.ACTION) {
                      if (selectedOption.value === 'select-key') {
                        setSearchKey({
                          search: localizedLabel.characters,
                        });
                      } else if (selectedOption.value === 'show-key') {
                        showKey(localizedLabel.key!);
                      } else if (selectedOption.value === 'reset') {
                        await localizedLabelManager.unsetLabel(localizedLabel);
                      }
                    } else if (selectedOption.type === InputSelectionOptionType.ADD) {
                      await localizedLabelManager.linkKey(localizedLabel, selectedOption.value, localizedLabel.rootFrameLanguage!, Plural.OTHER);
                    } else if (selectedOption.type === InputSelectionOptionType.SUGGESTION) {
                      await localizedLabelManager.linkKey(localizedLabel, selectedOption.value, localizedLabel.rootFrameLanguage!, Plural.OTHER);
                    }
                    /* if (selectedOption.type === 'action') {
                      if (selectedOption.value === 'no-translation') {
                        localizedLabelManager.setNoKey(localizedLabel);
                      } else if (selectedOption.value === 'select-key') {
                        setSearchKey({
                          search: localizedLabel.characters,
                        });
                      } else if (selectedOption.value === 'create-key') {
                        setNewKey(localizedLabel.derivedKey ?? '');
                      } else if (selectedOption.value === 'show-key') {
                        showKey(localizedLabel.key!);
                      }
                    } else if (selectedOption.type === 'key') {
                      localizedLabelManager.linkKey(localizedLabel, selectedOption.value as string, selectedOption.language!, selectedOption.plural!);
                    } */
                  }}
                  valueReplaceFn={(value) => value.replace(/[ .]/g, (match) => (match === '.' ? '__' : '_'))}
                  defaultValue={keyValue}
                  getOptions={(enteredValue: string) => {
                    let options = [] as InputSelectOption[];

                    const keySearch = enteredValue === '' ? '*' : enteredValue;
                    const textMatchQuery = MemoryTranslationKeyStore.toQueryObject(`exact_text:true key:${keySearch} ${localizedLabel.characters}`);
                    const { matchingKeys: suggestedKeys } = translationKeyStore.findKeys(textMatchQuery);
                    const keyMatchQuery = MemoryTranslationKeyStore.toQueryObject(`key:${keySearch}`);
                    const { matchingKeys: matchingKeysByName } = translationKeyStore.findKeys(keyMatchQuery);

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
                        value: key,
                        label: key,
                      };
                    }));

                    if (keySearch.length > 2 && matchingKeysByName.size > 0) {
                      options.push({
                        type: InputSelectionOptionType.DIVIDER,
                        value: '',
                        label: 'Keys',
                      });

                      options = options.concat([...matchingKeysByName].map((key) => ({
                        type: InputSelectionOptionType.SUGGESTION,
                        value: key,
                        label: key,
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
                      value: 'select-key',
                      type: InputSelectionOptionType.ACTION,
                    });

                    if (keyValue && keyValue !== '') {
                      options.push({
                        label: 'Go to Translation key...',
                        value: 'show-key',
                        type: InputSelectionOptionType.ACTION,
                      });
                    }

                    return options;
                  }}
                />

                <div className="grid">

                  <div className="languageWrapper" key={localizedLabel.language}>
                    <div className="grid-item-language" 
                          data-tooltip-trigger="div"
                          data-tooltip-content="Current Language of this Label"><span className="rowText">{localizedLabel.keyType === KeyState.Linked ? localizedLabel.language : localizedLabel.rootFrameLanguage}</span></div>
                    <div key={localizedLabel.pluralId} className={`keyPluralWrapper ${translatedKey?.plural ? 'onePlural' : ' multiplePlurals'}`}>
                      { FEATURES_FLAGS.plurals
                      && (
                      <div className="grid-item-plural">
                        {localizedLabel.keyType === KeyState.Linked && (
                        <>
                          {translatedKey?.plural && (
                          <Select
                            onChange={(value) => {
                              localizedLabelManager.updateLabelPlural(localizedLabel, value.value! as Plural);
                            }}
                            defaultValue={pluralsAvailable.find((opt) => opt.value === localizedLabel.pluralId)}
                            getOptions={() => pluralsAvailable}
                            placeholder=""
                          />
                          )}
                          {!translatedKey?.plural && (
                          <span className="rowText">{localizedLabel.pluralId}</span>
                          )}
                        </>
                        )}

                      </div>
                      )}
                      <div className="grid-item-translation translation-container translation">
                        <TranslationEditor
                          editable
                          match={undefined}
                          onCancel={async () => {
                            localizedLabelManager.commitUndo();
                          }}
                          onChange={async (value: string, fillins: Fillins) => {
                            localizedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
                              translationHTML: value,
                              fillins,
                            });
                          }}
                          fillins={localizedLabel.getFillins()}
                          translationHTML={localizedLabel.translationHTML}
                          keyName={localizedLabel.key}
                          translationKeyStore={translationKeyStore}
                        />
                        { selected !== 'unselected' && (
                          <div className="placeholder-view-grid" style={{ display: Object.keys(localizedLabel.getPlaceholders()).length > 0 ? undefined : 'none' }}>

                            <div />
                            <div />
                            <div>Placeholder</div>
                            <div />
                            <div />
                            {Object.entries(localizedLabel.getPlaceholders()).map((entry, i, array) => (
                              <PlaceholderEditorListItem
                                key={entry[0]}
                                placeholder={entry[1]}
                                fillin={localizedLabel.fillins?.[entry[0]]?.value ? localizedLabel.fillins?.[entry[0]]?.value : 'unset'}
                                onValueChange={(placeholderName, fillinValue) => {
                                  localizedLabelManager.updateLabelFillin(localizedLabel, placeholderName, fillinValue);
                                }}
                              />

                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                { (localizedLabel.keyType === KeyState.Linked && (labelState.modified || labelState.behind > 0 || localizedLabel.language !== localizedLabel.rootFrameLanguage)) && ( // allow the user to catch up with the keys version
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content="Reset all changes"
                  onClick={updateToLatestKeyVersion}
                >
                  <span className="svg-container reset-instance-svg" />
                </span>
                )}

                { ((false && localizedLabel.keyType === KeyState.Linked && labelState.modified && labelState.orginalTranslationHTML !== undefined)) && ( // allow the user revert the changes in design to the last versioned text
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content="Revert changes in Design"
                  onClick={revertDesignChanges}
                >
                  <span className="svg-container restore-svg" />
                </span>
                )}

                { ((localizedLabel.keyType === KeyState.Linked && labelState.modified)) && (
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content={`Push changes to (${localizedLabel.language}) Translation`}
                  onClick={createNewVersionFromDesign}
                >
                  <span className="svg-container use-label-svg" />
                </span>
                )}

              </div>
            </div>

          </div>
          <div className="row-actions">
            { ((localizedLabel.keyType === KeyState.Linked && localizedLabel.rootFrameLanguage !== localizedLabel.language)) && (
            <span
              className="row-action-icon"
              data-tooltip-trigger="span"
              data-tooltip-content="Frame Language differs from Label"
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
