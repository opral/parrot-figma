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

  translationKeyStore: MemoryTranslationKeyStore,
  selected: boolean
};

export default function LocalizedLabelListItem({
  localizedLabel,
  figmaRemote,
  localisedLabelManager,

  translationKeyStore,
  selected,
}: LocalizedLabelListItemProps) {
  const translatedKey = localizedLabel.keyType !== KeyState.Unset ? translationKeyStore.getKey(localizedLabel.key!) : undefined;

  const rowRef = React.useRef<HTMLDivElement>(null);

  const labelState = localisedLabelManager.getLabelState(localizedLabel);

  const [searchKey, setSearchKey] = useState(undefined as any);

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
    // TODO set labels text to the latest key version
    await localisedLabelManager.updateToLatestKeyVersion(localizedLabel);
  }

  async function revertDesignChanges() {
    // TODO set labels text to the latest key version
    await localisedLabelManager.revertDesignChanges(localizedLabel);
  }

  async function onSaveFigmaVersionClick(key: string, language: string, plural: string, figmaText: string) {
    await translationKeyStore.updateKey(key, [{
      language: language as Language, plural: plural as Plural, text: figmaText, skip: false,
    }]);
    // eslint-disable-next-line no-console -- TODO remove when implemented
    console.warn('onSaveFigmaVersionClick back prob not implemented');
  }

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId);
    await figmaRemote.selectNode(nodeId);
  }

  async function linkKey(keyToLinkTo: string) {
    await localisedLabelManager.linkKey(localizedLabel, keyToLinkTo);
  }

  async function unlinkKey(keyName?: string) {
    await localisedLabelManager.unlinkKey(localizedLabel, keyName);
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

  async function linkToggle() {
    const keyToSet = localizedLabel.key !== undefined ? localizedLabel.key : localizedLabel.derivedKey;

    if (keyToSet !== undefined) {
      if (localizedLabel.keyType === KeyState.Unlinked) {
        await linkKey(keyToSet);
      } else {
        await unlinkKey(localizedLabel.key);
      }
    } else {
      // eslint-disable-next-line no-console -- TODO remove when implemented
      // TODO focus key input since we have no key we can use for link
      // eslint-disable-next-line no-console -- TODO remove when implemented
      console.warn(' TOOD focus key input! ');
    }
  }

  React.useEffect(() => {
    if (selected && rowRef.current) {
      // tslint:disable-next-line
      (rowRef.current as any).scrollIntoViewIfNeeded(true);
    }
  }, [selected]);

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
            select={(key: string) => {
              linkKey(key);
              setSearchKey(undefined);
            }}
          />
          )}
        </div>
      </OutsideClickHandler>

      <div ref={rowRef} className={`row${selected ? ' selected ' : ''}${localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? ' key-set ' : ' key-unset '}`} onClick={() => { onNodeSelect(localizedLabel.nodeId); }}>
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

          <div className="translation-container">
            <div className="localized-label-details">
              <div className="key-panel">
                <TextField
                  icon="key-svg"
                  singleClick
                  onSave={async (key: string) => {
                    if (key === '') {
                      unlinkKey(undefined);
                    } else {
                      linkKey(key);
                    }
                  }}
                  text={localizedLabel.key !== undefined ? localizedLabel.key : localizedLabel.derivedKey}
                  placeholder="Keyname..."
                  onSearchClick={(key: any) => {
                    setSearchKey({
                      seach: key,
                    });
                  }}
                />
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content={localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? 'Linked Label (click to remove link)' : 'Unlinked Label (click to link)'}
                  onClick={linkToggle}
                >
                  <span className={`svg-container ${localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? 'linked-svg' : 'unlinked-svg'}`} />
                </span>
                { false && `localizedLabel.keyType: ${localizedLabel.keyType} lang: ${localizedLabel.rootFrameLanguage}/${localizedLabel.language} version: ${localizedLabel.keyVersion} behind: ${labelState.behind} modified: ${labelState.modified}` }
                { (localizedLabel.keyType === KeyState.Linked && (labelState.behind > 0 || localizedLabel.language !== localizedLabel.rootFrameLanguage)) && ( // allow the user to catch up with the keys version
                <span
                  className="layerIcon iconWrapper button"
                  data-tooltip-trigger="span"
                  data-tooltip-content="Update Label with latest version"
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

                {localizedLabel.keyType === KeyState.Linked && pluralsAvailable.length > 1 && (
                <Select
                  onChange={(value) => {
                    onSaveFigmaVersionClick(localizedLabel.key!, localizedLabel.language, value.value as string, localizedLabel.text!);
                  }}
                  defaultValue={localizedLabel.pluralId}
                  options={pluralsAvailable}
                  placeholder=""
                />
                )}

              </div>
            </div>

            <TranslationEditor
            // eslint-disable-next-line @typescript-eslint/no-unused-vars, func-names -- TODO remove after refactor
              onSave={async (text: any) => {
              /* let translationKey;
                            if (keyExists === true) {
                                translationKey = await translationKeyStore.updateKey(localizedLabel.key!, [{
                                    language: localizedLabel.rootFrameLanguage,
                                    plural: localizedLabel.pluralId,
                                    text: text,

                                }]);
                            } else {
                               // TODO  await translationKeyStore.createKey(localizedLabel.key, [{ language: localizedLabel.rootFrameLanguage, plural: localizedLabel.pluralId, text: text}]);
                            }

                            let textToApplyToDesign = localizedLabel.useSampleValues || localizedLabel.rootFrameUseSampleValues ?
                                translationKeyStore.fillPlaceholdersWithSampleData(text, localizedLabel.rootFrameLanguage, localizedLabel.pluralId) :
                                text;

                            await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
                                plural: localizedLabel.pluralId,
                                showSampleValues: localizedLabel.useSampleValues,
                                showSampleValuesInherited: localizedLabel.rootFrameUseSampleValues,
                                text: textToApplyToDesign,
                                keyVersion: translationKey?.latestVersion
                            }); */
                // eslint-disable-next-line no-console -- TODO remove when implemented
                console.warn('TODO onSave back prob not implemented');
              }}
              text={localizedLabel.text}
              match={undefined}
              editable={false}
            />
          </div>
          <div className="row-actions">
            { ((localizedLabel.rootFrameLanguage !== localizedLabel.language)) && (
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
              data-tooltip-content={localizedLabel.useSampleValues === false ? "Use Sample values" : "Show placeholders" }
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
