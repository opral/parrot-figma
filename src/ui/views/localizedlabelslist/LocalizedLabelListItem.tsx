/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import OutsideClickHandler from 'react-outside-click-handler';
import { Plural } from '../../../lib/base/Plural';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import FigmaUtil from '../../../shared/FigmaUtil';
import Select, { SelectOption } from '../../compontents/select/select';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import { Language } from '../../../lib/base/Language';
import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import TextField from '../../compontents/textfield/TextField';
import TranslationKeyListView from '../translationkeys/TranslationKeyListView';
import { UILocalizedLabel } from '../../../lib/localizedlabels/UILocalizedLabel';
import PlaceholderEditorListItem from '../../compontents/placeholder/PlaceholderEditor';

type LocalizedLabelListItemProps = {

  localizedLabel: UILocalizedLabel,
  figmaRemote: FigmaUtil,
  localizedLabelManager: LocalizedLabelManagerUI,
  selected: boolean
};

export default function LocalizedLabelListItem({
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
  const [newKey, setNewKey] = useState<string | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
  const translations = translatedKey?.translations[localizedLabel.language];

  const pluralsAvailable = [] as SelectOption[];

  async function createNewVersionFromDesign() {
    await localizedLabelManager.createNewVersionFromLabelState(localizedLabel);
  }

  async function updateToLatestKeyVersion() {
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

  let keyValue;

  if (localizedLabel.keyType === KeyState.Linked && localizedLabel.key) {
    keyValue = { icon: 'key-svg', label: localizedLabel.key, value: localizedLabel.key };
  } else if (localizedLabel.keyType === KeyState.NoKey) {
    keyValue = {
      label: 'no Translation',
      value: 'no-translation',
      type: 'action',
    };
  }

  return (
    <>
      <OutsideClickHandler
        onOutsideClick={() => { setSearchKey(undefined); }}
        disabled={searchKey === undefined}
        display="contents"
      >
        <div className={`top-drawer${searchKey !== undefined ? ' open' : ' '}`}>
          <div className="history_view--topHeader">
            Select Key
          </div>
          { searchKey !== undefined && (
          <TranslationKeyListView
            translationKeyStore={translationKeyStore}
            localizedLabelManager={localizedLabelManager}
            keys={translationKeyStore.translationKeys}
            figmaRemote={figmaRemote}
            refreshKeys={() => {}}
            searchQuery={MemoryTranslationKeyStore.toQueryObject(`exact_text:true key:* ${searchKey.search}`)}
            select={(key: string, language: Language, plural: Plural) => {
              localizedLabelManager.linkKey(localizedLabel, key, language, plural);
              setSearchKey(undefined);
            }}
          />
          )}
        </div>
      </OutsideClickHandler>

      <OutsideClickHandler
        onOutsideClick={() => { setNewKey(undefined); }}
        disabled={newKey === undefined}
        display="contents"
      >
        <div className={`top-drawer${newKey !== undefined ? ' open' : ' '} create-key`}>
          <div className="history_view--topHeader">
            Create a new Key
          </div>
          <div className="text-field-text editing ">
            <input
              style={{
                position: 'inherit'
              }}
              defaultValue={localizedLabel.name}
              onChange={(e) => { setNewKey(e.target.value); }}
              placeholder="Keyname"
            />
          </div>

          <div className="buttonGroup buttonGroup-reversed">
            <button
              className="button button-primary"
              type="button"
              onClick={() => {
                localizedLabelManager.linkKey(localizedLabel, newKey!, localizedLabel.rootFrameLanguage!, Plural.OTHER);
                setNewKey(undefined);
              }}
              disabled={false}
            >
              <span data-tooltip-type="text">
                Create Key
              </span>
            </button>
            <button
              className="button button-secondary"
              type="button"
              onClick={() => {
                // set back to head
                setNewKey(undefined);
              }}
            >
              <span data-tooltip-type="text">
                Cancel
              </span>
            </button>
          </div>
        </div>
      </OutsideClickHandler>

      <div className={`row${selected ? ' selected ' : ''}${localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? ' key-set ' : ' key-unset '}`} onClick={() => { onNodeSelect(localizedLabel.nodeId); }}>
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
                <Select
                  className="key-select"
                  placeholder="Select Key"
                  onChange={(selectedOption) => {
                    if (selectedOption.type === 'action') {
                      if (selectedOption.value === 'no-translation') {
                        localizedLabelManager.setNoKey(localizedLabel);
                      } else if (selectedOption.value === 'select-key') {
                        setSearchKey({
                          search: localizedLabel.text,
                        });
                      } else if (selectedOption.value === 'create-key') {
                        setNewKey(localizedLabel.derivedKey ?? '');
                      }
                    } else if (selectedOption.type === 'key') {
                      localizedLabelManager.linkKey(localizedLabel, selectedOption.value as string, selectedOption.language!, selectedOption.plural!);
                    }
                  }}
                  defaultValue={keyValue}
                  getOptions={() => {
                    const options = [] as SelectOption[];

                    let noMatch = true;
                    let defaulValueFound = false;

                    const query = MemoryTranslationKeyStore.toQueryObject(`exact_text:true key:* ${localizedLabel.text}`);
                    const { matches } = translationKeyStore.findKeys(query);
                    for (const key of Object.keys(matches)) {
                      // try to use the language of the root frame
                      if (matches[key].textMatches[localizedLabel.rootFrameLanguage]) {
                        const language = localizedLabel.rootFrameLanguage as Language;
                        let plural = Object.keys(matches[key].textMatches[language]!)[0]! as Plural;
                        if (matches[key].textMatches[language]![Plural.OTHER]) {
                          plural = Plural.OTHER;
                        }
                        options.push({
                          icon: 'key-svg',
                          label: `${key} (${language} - ${plural})`,
                          value: key,
                          language,
                          plural,
                          type: 'key',
                        });
                        noMatch = false;

                        if (localizedLabel.key === key) {
                          defaulValueFound = true;
                        }
                        // eslint-disable-next-line no-continue
                        continue;
                      }

                      // use first match
                      const langs = Object.keys(matches[key].textMatches);
                      if (langs.length > 0) {
                        const language = langs[0] as Language;
                        const plural = Object.keys(matches[key].textMatches[language]!)[0]! as Plural;
                        options.push({
                          icon: 'key-svg',
                          label: `${key} (${language} - ${plural})`,
                          value: key,
                          language,
                          plural,
                          type: 'key',
                        });
                        noMatch = false;
                      }
                    }

                    if (!defaulValueFound && localizedLabel.key) {
                      options.push({ label: localizedLabel.key, value: localizedLabel.key, type: 'key' });
                    }

                    if (!noMatch || !defaulValueFound) {
                      options.push({
                        divider: true,
                        value: '',
                        label: '',
                      });
                    }

                    options.push({
                      label: 'search key...',
                      value: 'select-key',
                      type: 'action',
                    });

                    options.push({
                      label: 'create key...',
                      value: 'create-key',
                      type: 'action',
                    });

                    options.push({
                      label: 'No Translation',
                      value: 'no-translation',
                      type: 'action',
                    });

                    return options;
                  }}
                />

                <div className="grid">

                  <div className="languageWrapper" key={localizedLabel.language}>
                    <div className="grid-item-language"><span className="rowText">{localizedLabel.keyType === KeyState.Linked && localizedLabel.language}</span></div>
                    <div key={localizedLabel.pluralId} className={`keyPluralWrapper ${translatedKey?.plural ? 'onePlural' : ' multiplePlurals'}`}>
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
                      <div className="grid-item-translation translation-container translation">
                        <TranslationEditor
                          editable
                          match={undefined}
                          onSave={async (text: any) => {
                            // TODO
                          }}
                          text={localizedLabel.translation}
                          keyName={localizedLabel.key}
                          translationKeyStore={translationKeyStore}
                        />
                        { selected && (
                          <div className="placeholder-view-grid" style={{ display: localizedLabel.keyType === KeyState.Linked && translatedKey && translatedKey.placeholders && Object.keys(translatedKey.placeholders).length > 0 ? undefined : 'none' }}>

                            <div />
                            <div />
                            <div>Placeholder</div>
                            <div />
                            <div />
                            {translatedKey && translatedKey.placeholders && Object.entries(translatedKey.placeholders).map((entry, i, array) => (
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

                { (localizedLabel.keyType === KeyState.Linked && (labelState.behind > 0 || localizedLabel.language !== localizedLabel.rootFrameLanguage)) && ( // allow the user to catch up with the keys version
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content={`Update Label with latest version${labelState.behind} ${localizedLabel.language} ${localizedLabel.rootFrameLanguage}`}
                  onClick={updateToLatestKeyVersion}
                >
                  <span className="svg-container reset-instance-svg" />
                </span>
                )}

                { ((localizedLabel.keyType === KeyState.Linked && labelState.modified && labelState.orginalText !== undefined)) && ( // allow the user revert the changes in design to the last versioned text
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
                  data-tooltip-content="Save Design state as new Version"
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
