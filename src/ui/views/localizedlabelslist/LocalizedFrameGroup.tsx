/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import LocalizedLabelListItem from './LocalizedLabelListItem';
import Select, { SelectOption } from '../../compontents/select/select';
import FigmaUtil from '../../../shared/FigmaUtil';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import Language from '../../../lib/base/Language';

type LocalizedFrameGroupProps = {
  localizedLabels: LocalizedLabel[],
  translationKeyStore: MemoryTranslationKeyStore
  selectionByFrame: {
    [rootFrameId: string]: string[]
  }
  figmaRemote: FigmaUtil
  localisedLabelManager: LocalizedLabelManagerUI
};

export default function LocalizedFrameGroup({
  localizedLabels,
  translationKeyStore,
  selectionByFrame,
  figmaRemote,
  localisedLabelManager,
}: LocalizedFrameGroupProps) {
  if (localizedLabels.length === 0) return null;

  const firstTranslationState = localizedLabels[0];
  const { rootFrameName } = firstTranslationState;

  const sampleValues = firstTranslationState.useSampleValues;

  let rootFrameLanguage: SelectOption | undefined;
  const languageOptiones = [] as SelectOption[];

  const languages = translationKeyStore.getLanugages()!;

  for (const language of languages) {
    const currentLanguageOption = {
      value: language, label: language, icon: `flag-${language}`,
    };

    if (language === firstTranslationState.rootFrameLanguage) {
      rootFrameLanguage = currentLanguageOption;
    }
    languageOptiones.push(currentLanguageOption);
  }

  async function onLanguageSelectionClick(firstLocalizedLabelInFrame: LocalizedLabel, language: Language) {
    const deepLTranslationProvider = async (text: String, targetLanguage: string) => {
      return undefined;
      // console.log(`tranalating: ${text} with deepl`);
      const result = await fetch('http://localhost:3333/api/v1/translate', {
        method: 'POST',
        /* headers: {
            'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
          }, */
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(
          {
            text: [text],
            target_lang: targetLanguage,
          },
        ),
      });
      const translationResults = await result.json();

      return translationResults.translations[0].text;
    };

    localisedLabelManager.setFrameLanguage(firstLocalizedLabelInFrame.rootFrameId, language, deepLTranslationProvider);
  }

  async function onSampleValuesClick(firstLocalizedLabelInFrame: LocalizedLabel) {
    // TODO #4 check how we want to handle the toggle on the frame
    localisedLabelManager.setFrameUseSampleValues(firstLocalizedLabelInFrame.rootFrameId, firstLocalizedLabelInFrame.useSampleValues);
  }

  return (
    <>

      <div className="header">
        <div className="column-1">
          <div className="spacer" />
          <div className="element-symbol">
            <div className="svg-container number-sign-svg" />
          </div>
          <div className="element-name font-body-24-bold">{rootFrameName}</div>
        </div>
        <div className="column-2">
          <div className="row-actions">
            <Select
              placeholder="Select item"
              onChange={(value) => { onLanguageSelectionClick(firstTranslationState, value.value as Language); }}
              defaultValue={rootFrameLanguage?.value}
              options={languageOptiones}
            />
            <div
              className="row-action-icon"
              onClick={(e) => {
                e.preventDefault();
                onSampleValuesClick(firstTranslationState);
              }}
            >
              <div className={`svg-container ${sampleValues === true ? 'placeholder-svg' : 'placeholder-filled-svg'}`} />
            </div>

          </div>
        </div>
      </div>

      {rootFrameLanguage?.value && localizedLabels.map((translationState) => (
        <LocalizedLabelListItem
          key={translationState.nodeId}
          translationKeyStore={translationKeyStore}
          localizedLabel={translationState}
          figmaRemote={figmaRemote}
          localisedLabelManager={localisedLabelManager}
          selected={selectionByFrame[translationState.rootFrameId]?.indexOf(translationState.nodeId) !== -1}
        />
      ))}

      {rootFrameLanguage?.value === undefined
              && <div>choose current design language</div>}

    </>
  );
}
