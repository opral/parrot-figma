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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
  const keyExists = translatedKey !== undefined;
  const translations = translatedKey?.translations[localizedLabel.rootFrameLanguage];
  const localizedText = translations?.[localizedLabel.pluralId]?.text;

  let localizedTextToApply = localizedText;

  if (localizedText !== undefined && localizedLabel.useSampleValues) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO remove when we implemented the design != keystore resolution
    localizedTextToApply = translationKeyStore.fillPlaceholdersWithSampleData(localizedTextToApply!, localizedLabel.rootFrameLanguage, localizedLabel.pluralId);
  }

  const pluralsAvailable = [] as SelectOption[];

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
      await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion,
      });

      // TODO check if design is sync with translation - if not offer update with prompt
    } else {
      translationKey = await translationKeyStore.createKey(keyToLinkTo, [{
        language: localizedLabel.rootFrameLanguage,
        plural: localizedLabel.pluralId,
        text: localizedLabel.text,
        skip: false,
      }]);
      await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
        key: keyToLinkTo,
        keyType: KeyState.Linked,
        keyVersion: translationKey.latestVersion,
      });
    }
    await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
      keyType: KeyState.Linked,
      keyVersion: translationKey.latestVersion,
    });
  }

  async function unlinkKey(keyName?: string) {
    await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
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

  React.useEffect(() => {
    if (selected && rowRef.current) {
      // tslint:disable-next-line
      (rowRef.current as any).scrollIntoViewIfNeeded(true);
    }
  }, [selected]);

  return (

    <div ref={rowRef} className={`row${selected ? ' selected ' : ''}${localizedLabel.keyType === KeyState.Unlinked ? ' key-unset ' : ' key-set '}`} onClick={() => { onNodeSelect(localizedLabel.nodeId); }}>
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
              await localisedLabelManager.updateLocalisedLabelProperties(localizedLabel.nodeId, {
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
                onClick={async () => {
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
                }}
              >
                <span className={`svg-container ${localizedLabel.keyType === KeyState.Unlinked ? 'unlinked-svg' : 'linked-svg'}`} />
              </span>

              {localizedLabel.keyType !== KeyState.Unlinked && (
                <Select
                  placeholder="Select item"
                  onChange={(value) => {
                    onSaveFigmaVersionClick(localizedLabel.key!, localizedLabel.rootFrameLanguage, value.value as string, localizedLabel.text!);
                  }}
                  defaultValue={localizedLabel.pluralId}
                  options={pluralsAvailable}
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
