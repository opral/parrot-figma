/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import Plural from '../../../lib/base/Plural';
import { KeyState, LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import FigmaUtil from '../../../shared/FigmaUtil';
import Select, { SelectOption } from '../../compontents/select/select';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import Language from '../../../lib/base/Language';
import TranslationEditor from '../../compontents/translationEditor/TranslationEditor';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import TextField from '../../compontents/textfield/TextField';
import { HistoryEntry } from '../../../lib/keystore/TranslationKey';

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

  let modified = false;
  let behind = 0;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
  const translations = translatedKey?.translations[localizedLabel.rootFrameLanguage];
  let currentVersion: HistoryEntry | undefined;
  let latestVersion: { version: number, historyEntry: HistoryEntry } | undefined;

  if (translatedKey) {
    currentVersion = translatedKey.history[localizedLabel.keyVersion];
    latestVersion = MemoryTranslationKeyStore.getLatestHistoryEntry(translatedKey, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);

    if (currentVersion === undefined) {
      console.warn(`Illegal state on label ${localizedLabel.key} ${localizedLabel.keyVersion}`);
    } else if (latestVersion !== undefined) {
      behind = latestVersion.version - localizedLabel.keyVersion;
      modified = currentVersion[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text !== localizedLabel.text;
    }
  }

  /* let localizedTextToApply = localizedText;

  if (localizedText !== undefined && localizedLabel.useSampleValues) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
    localizedTextToApply = translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
  } */

  const pluralsAvailable = [] as SelectOption[];

  async function createNewVersionFromDesign() {
    // TODO update key (lang, plural, text, skiped) with text frin design
    const localizedKey = await translationKeyStore.updateKey(localizedLabel.key!, [{
      language: localizedLabel.rootFrameLanguage as Language, plural: localizedLabel.pluralId as Plural, text: localizedLabel.text, skip: false,
    }]);

    const latestVersionForLanguageConfig = MemoryTranslationKeyStore.getLatestHistoryEntry(localizedKey!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);

    console.log(`setting key v to ${latestVersionForLanguageConfig!.version}`);
    await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: latestVersionForLanguageConfig!.version,
    });
  }

  async function updateToLatestKeyVersion() {
    const translationKey = translationKeyStore.getKey(localizedLabel.key!);

    const latestVersionForLanguageConfig = MemoryTranslationKeyStore.getLatestHistoryEntry(translationKey!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);

    // TODO set labels text to the latest key version
    await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: latestVersionForLanguageConfig!.version,
      text: latestVersionForLanguageConfig!.historyEntry[localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
    });
  }

  async function revertDesignChanges() {
    const translationKey = translationKeyStore.getKey(localizedLabel.key!);

    const currentLabelVersion = translationKey?.history[localizedLabel.keyVersion];

    // TODO set labels text to the latest key version
    await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
      keyVersion: latestVersion!.version,
      text: currentLabelVersion![localizedLabel.rootFrameLanguage]?.[localizedLabel.pluralId]?.text,
    });
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
    let translationKey = translationKeyStore.getKey(keyToLinkTo);

    if (translationKey !== undefined) {
      latestVersion = MemoryTranslationKeyStore.getLatestHistoryEntry(translationKey!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
      await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: latestVersion?.version!,
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      translationKey = await translationKeyStore.createKey(keyToLinkTo, [{
        language: localizedLabel.rootFrameLanguage,
        plural: localizedLabel.pluralId,
        text: localizedLabel.text,
        skip: false,
      }]);
      await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion, // its save to use latest version here since we created a whole new key here.
      });
    }
  }

  async function unlinkKey(keyName?: string) {
    await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
      key: keyName,
      keyType: KeyState.Unlinked,
    });
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
      value: Plural.Other, label: Plural.Other,
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
              await localisedLabelManager.updateLabelProperties(localizedLabel.nodeId, {
                labelName,
              });
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
                onSearchClick={() => { }}
              />
              <span
                className="layerIcon iconWrapper button"
                onClick={linkToggle}
              >
                <span className={`svg-container ${localizedLabel.keyType === KeyState.Linked && translatedKey !== undefined ? 'linked-svg' : 'unlinked-svg'}`} />
              </span>

              { (localizedLabel.keyType === KeyState.Linked && behind > 0) && ( // allow the user to catch up with the keys version
              <span
                className="layerIcon iconWrapper button"
                onClick={updateToLatestKeyVersion}
              >
                <span className="svg-container refresh-svg" />
              </span>
              )}

              { ((localizedLabel.keyType === KeyState.Linked && modified)) && ( // allow the user revert the changes in design to the last versioned text
              <span
                className="layerIcon iconWrapper button"
                onClick={revertDesignChanges}
              >
                <span className="svg-container undo-svg" />
              </span>
              )}

              { ((localizedLabel.keyType === KeyState.Linked && modified)) && (
              <span
                className="layerIcon iconWrapper button"
                onClick={createNewVersionFromDesign}
              >
                <span className="svg-container download-svg" />
              </span>
              )}

              {localizedLabel.keyType === KeyState.Linked && (
                <Select
                  onChange={(value) => {
                    onSaveFigmaVersionClick(localizedLabel.key!, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!);
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
          />
        </div>
      </div>

    </div>
  );
}
