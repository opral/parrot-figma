/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import LocalizedLabelListItem from './LocalizedLabelListItem';
import Select, { SelectOption } from '../../compontents/select/select';
import FigmaUtil from '../../../shared/FigmaUtil';
import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { Locale } from '../../../lib/message/variants/Locale';
import { UILocalizedLabel } from '../../../lib/localizedlabels/UILocalizedLabel';
import { NodeSelection } from '../../../lib/localizedlabels/LocalizedLabelManager';
import GoogleTranslator from '../../../lib/translationprovider/google';

type LocalizedFrameGroupProps = {
  showMessage: Function,
  localizedLabels: UILocalizedLabel[],
  selectedNodes: NodeSelection,
  figmaRemote: FigmaUtil
  localizedLabelManager: LocalizedLabelManagerUI
};

function toLanguageOption(language: string, baseLanguage?: string) {
  let languageNameInCurrentLanguage = 'no name found';
  try {
    languageNameInCurrentLanguage = new Intl.DisplayNames('en', { type: 'language' }).of(language) ?? languageNameInCurrentLanguage;
  } catch (e) { /* empty */ }

  let languageNameInForeignLanguage = 'no name found';
  try {
    languageNameInForeignLanguage = new Intl.DisplayNames(language, { type: 'language' }).of(language) ?? languageNameInForeignLanguage;
  } catch (e) { /* empty */ }

  if (baseLanguage && language === baseLanguage) {
    return {
      value: language,
      label: `${languageNameInCurrentLanguage} - ${language}`,
    };
  }
  return {
    value: language,
    label: `${languageNameInCurrentLanguage} - ${language}`,
  };
}

export default function LocalizedFrameGroup({
  showMessage,
  localizedLabels,
  selectedNodes,
  figmaRemote,
  localizedLabelManager,
}: LocalizedFrameGroupProps) {
  if (localizedLabels.length === 0) return null;

  const firstTranslationState = localizedLabels[0];
  const { rootFrameName, rootFrameId } = firstTranslationState;

  let rootFrameLanguage: SelectOption | undefined;
  const languageOptiones = [] as SelectOption[];

  const languages = localizedLabelManager.messageStore.getLanugages()!.sort();

  languageOptiones.push(toLanguageOption(localizedLabelManager.messageStore.getRefLanugage()!));

  for (const language of languages) {
    const currentLanguageOption = toLanguageOption(language);
    if (language === firstTranslationState.rootFrameLanguage) {
      rootFrameLanguage = currentLanguageOption;
    }
    if (localizedLabelManager.messageStore.getRefLanugage()! !== language) {
      languageOptiones.push(currentLanguageOption);
    }
  }

  async function onLanguageSelectionClick(firstLocalizedLabelInFrame: LocalizedLabel, language: Locale) {
    const translationProvider = GoogleTranslator.translate;

    localizedLabelManager.setFrameLanguage(firstLocalizedLabelInFrame.rootFrameId, language, translationProvider);
  }

  async function onNodeSelect(nodeId: string) {
    await figmaRemote.scrollIntoViewIfNeeded(nodeId, true);
  }

  return (
    <>

      <div className="header">
        <div className={`column-1 nodes-parent${selectedNodes[rootFrameId]?.directSelection ? ' selected' : ''}`} onClick={() => { onNodeSelect(rootFrameId); }}>
          <div className="spacer" />
          <div className="element-symbol">
            <div className="svg-container number-sign-svg" />
          </div>
          <div className="element-name font-body-24-bold">
            {rootFrameName}

          </div>
          <div
            className="row-actions"
          >
            <Select
              tooltip="Container Frame Langueage"
              placeholder="Select item"
              onChange={(value) => { onLanguageSelectionClick(firstTranslationState, value.value as Locale); }}
              defaultValue={languageOptiones.find((opt) => opt.value === rootFrameLanguage?.value)}
              getOptions={() => languageOptiones}
            />

          </div>
        </div>
      </div>

      {rootFrameLanguage?.value && localizedLabels.map((translationState) => {
        let selection = 'unselected' as 'unselected' | 'selected' | 'selected-by-parent';
        if (selectedNodes[translationState.nodeId] !== undefined) {
          if (selectedNodes[translationState.nodeId].directSelection) {
            selection = 'selected';
          } else {
            selection = 'selected-by-parent';
          }
        }

        return (
          <LocalizedLabelListItem
            showMessage={showMessage}
            key={translationState.nodeId}
            figmaRemote={figmaRemote}
            localizedLabelManager={localizedLabelManager}
            selected={selection}
            localizedLabel={translationState}
          />
        );
      })}

      {rootFrameLanguage?.value === undefined
              && <div>choose current design language</div>}

    </>
  );
}
