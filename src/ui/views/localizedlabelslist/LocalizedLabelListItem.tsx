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

type LocalizedLabelListItemProps = {

  localizedLabel: LocalizedLabel,
  figmaRemote: FigmaUtil,
  localisedLabelManager: LocalizedLabelManagerUI,
  scrollIntoView: boolean,
  translationKeyStore: MemoryTranslationKeyStore,
  selected: boolean
};

export default function LocalizedLabelListItem({
  localizedLabel,
  figmaRemote,
  localisedLabelManager,
  scrollIntoView,
  translationKeyStore,
  selected,
}: LocalizedLabelListItemProps) {
  const translatedKey = localizedLabel.keyType !== KeyState.Unset ? translationKeyStore.getKey(localizedLabel.key!) : undefined;

  const rowRef = React.useRef<HTMLDivElement>(null);

  const labelState = localizedLabel.state!;

  const [searchKey, setSearchKey] = useState(undefined as any);
  const [newKey, setNewKey] = useState<string | undefined>(undefined);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
  const translations = translatedKey?.translations[localizedLabel.language];

  /* let localizedTextToApply = localizedText;

  if (localizedText !== undefined && localizedLabel.useSampleValues) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
    localizedTextToApply = translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
  } */

  const pluralsAvailable = [] as SelectOption[];

  async function createNewVersionFromDesign() {
    await localisedLabelManager.createNewVersionFromLabelState(localizedLabel);
  }

  async function updateToLatestKeyVersion() {
    await localisedLabelManager.updateToLatestKeyVersion([localizedLabel]);
  }

  async function revertDesignChanges() {
    await localisedLabelManager.revertDesignChanges(localizedLabel);
  }

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId);
    await figmaRemote.selectNodes([nodeId]);
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

  React.useEffect(() => {
    if (scrollIntoView && rowRef.current) {
      // tslint:disable-next-line
      (rowRef.current as any).scrollIntoViewIfNeeded(true);
    }
  }, [scrollIntoView]);

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
            localizedLabelManager={localisedLabelManager}
            keys={translationKeyStore.translationKeys}
            figmaRemote={figmaRemote}
            refreshKeys={() => {}}
            searchQuery={translationKeyStore.toQueryObject(`exact_text:true key:* ${searchKey.search}`)}
            select={(key: string, language: Language, plural: Plural) => {
              localisedLabelManager.linkKey(localizedLabel, key, language, plural);
              setSearchKey(undefined);
            }}
          />
          )}
        </div>
      </OutsideClickHandler>

      <OutsideClickHandler
        onOutsideClick={() => { setSearchKey(undefined); }}
        disabled={searchKey === undefined}
        display="contents"
      >
        <div className={`top-drawer${newKey !== undefined ? ' open' : ' '}`}>
          <div className="history_view--topHeader">
            Choose Key Name
          </div>
          <TextField
            singleClick={false}
            onSave={async (labelName: string) => {
              localisedLabelManager.linkKey(localizedLabel, labelName, localizedLabel.rootFrameLanguage!, Plural.OTHER);
              setNewKey(undefined);
            }}
            text={localizedLabel.name}
          />
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
                await localisedLabelManager.updateLabelName(localizedLabel, labelName);
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
                        localisedLabelManager.setNoKey(localizedLabel);
                      } else if (selectedOption.value === 'select-key') {
                        setSearchKey({
                          search: localizedLabel.text,
                        });
                      } else if (selectedOption.value === 'create-key') {
                        setNewKey(localizedLabel.derivedKey ?? '');
                      }
                    } else if (selectedOption.type === 'key') {
                      localisedLabelManager.linkKey(localizedLabel, selectedOption.value as string, selectedOption.language!, selectedOption.plural!);
                    }
                  }}
                  defaultValue={keyValue}
                  getOptions={() => {
                    const options = [{
                      label: 'no Translation',
                      value: 'no-translation',
                      type: 'action',
                    }, {
                      divider: true,
                    }] as SelectOption[];

                    let noMatch = true;
                    const defaulValueFound = false;

                    const query = translationKeyStore.toQueryObject(`exact_text:true key:* ${localizedLabel.text}`);
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
                      label: 'select key...',
                      value: 'select-key',
                      type: 'action',
                    });

                    options.push({
                      label: 'create key...',
                      value: 'create-key',
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
                            {pluralsAvailable.length > 1 && (
                            <Select
                              onChange={(value) => {
                                localisedLabelManager.updateLabelPlural(localizedLabel, value.value! as Plural);
                              }}
                              defaultValue={pluralsAvailable.find((opt) => opt.value === localizedLabel.pluralId)}
                              getOptions={() => pluralsAvailable}
                              placeholder=""
                            />
                            )}
                            {pluralsAvailable.length <= 1 && (
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
                          text={localizedLabel.text}
                          translationKeyStore={translationKeyStore}
                        />
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
            { ((localizedLabel.rootFrameLanguage === localizedLabel.language)) && (
            <span
              className="row-action-icon"
            >
              <span className="svg-container dot-svg" />
            </span>
            )}

            <span
              className="row-action-icon"
              data-tooltip-trigger="span"
              data-tooltip-content={localizedLabel.useSampleValues === false ? 'Use Sample values' : 'Show placeholders'}
            >
              <span
                className={`svg-container ${localizedLabel.useSampleValues === false ? 'placeholder-svg' : 'placeholder-filled-svg'}`}
                onClick={() => { localisedLabelManager.setLabelUseSampleValues(localizedLabel.nodeId, !localizedLabel.useSampleValues); }}
              />
            </span>

          </div>
        </div>

      </div>
    </>
  );
}
