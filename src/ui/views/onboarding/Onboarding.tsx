/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import Language from '../../../lib/base/Language';
import TileSelect, { TileSelectOption } from '../../compontents/tileselect/tileselect';
import './Onboarding.css';

  type OnboardingProps = {
    onFinishSetup: Function,
  };

export default function Onboarding({
  onFinishSetup,
}: OnboardingProps) {
  const languageOptiones = [] as TileSelectOption<Language>[];
  const baseLanguageOptiones = [] as TileSelectOption<Language>[];

  const availableLanguages = Object.values(Language);
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [baseLanguageState, setBaseLanguageState] = useState<Language | undefined>(undefined);
  const [activeView, setActiveView] = useState('baselanguage');

  // const [baseLanguage, setBaseLanguages] = useState(translationKeyStore.getBaseLanugages());

  for (const language of availableLanguages) {
    const currentLanguageOption = {
      value: language, label: language, icon: `flag-${language}`,
    };

    baseLanguageOptiones.push(currentLanguageOption);
  }

  for (const language of availableLanguages) {
    const currentLanguageOption = {
      value: language,
      label: language,
      icon: `flag-${language}`,
      forceSelected: language === baseLanguageState,
      subLabel: language === baseLanguageState ? '(base language)' : undefined,
    } as TileSelectOption<Language>;

    languageOptiones.push(currentLanguageOption);
  }

  return (
    <div>
      { activeView === 'baselanguage' && (
      <>
        <div>
          <div>
            Please choose the base language.
            <br />
            Please select the language in which the design file is currently written?
          </div>
          <TileSelect<Language>
            onChange={(baseLanguage: Language[]) => {
              if (baseLanguage.length === 1) {
                setBaseLanguageState(baseLanguage[0]);
              } else {
                setBaseLanguageState(undefined);
              }
            }}
            // defaultValue={rootFrameLanguage?.value}
            options={baseLanguageOptiones}
            defaultSelection={baseLanguageState ? [baseLanguageState] : undefined}
            multiselect={false}
          />
        </div>
        <div>
          <button className="button button--buttonSecondary" type="button" onClick={() => { setActiveView('languages'); }}>
            <span data-tooltip-type="text">
              Next
            </span>
          </button>
        </div>

      </>
      )}
      { activeView === 'languages' && (

      <>
        <div>
          <div>
            Please select langueages to translate the designfile for.
          </div>
          <div>
            <TileSelect<Language>
              onChange={(selectedLanguageOptions: Language[]) => {
                setSelectedLanguages(selectedLanguageOptions.map((option) => option as Language));
              }}
              // defaultValue={rootFrameLanguage?.value}
              options={languageOptiones}
              defaultSelection={selectedLanguages}
              multiselect
            />

          </div>
        </div>
        <div>
          <button className="button button--buttonSecondary" type="button" onClick={() => { setActiveView('baselanguage'); }}>
            <span data-tooltip-type="text">
              Back
            </span>
          </button>
          {
            // TODO deactivate if baseLanguageState === undefined && selectedLanguages.length === 0
          }
          <button className="button button--buttonSecondary" type="button" onClick={() => { if (baseLanguageState !== undefined) { onFinishSetup(baseLanguageState, selectedLanguages); } }}>
            <span data-tooltip-type="text">
              Finish setup
            </span>
          </button>
        </div>

      </>

      )}

    </div>
  );
}
