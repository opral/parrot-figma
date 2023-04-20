/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { SupportedLanguages, Language } from '../../../lib/base/Language';
import TileSelect, { TileSelectOption } from '../../compontents/tileselect/tileselect';

import './Onboarding.css';

  type OnboardingProps = {
    onFinishSetup: Function,
  };

export default function Onboarding({
  onFinishSetup,
}: OnboardingProps) {
  const { t } = useTranslation();

  const languageOptiones = [] as TileSelectOption<Language>[];
  const baseLanguageOptiones = [] as TileSelectOption<Language>[];

  const availableLanguages = SupportedLanguages;
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [baseLanguageState, setBaseLanguageState] = useState<Language | undefined>(undefined);
  const [activeView, setActiveView] = useState('baselanguage');

  // const [baseLanguage, setBaseLanguages] = useState(translationKeyStore.getBaseLanugages());

  for (const language of availableLanguages) {
    const currentLanguageOption = {
      value: language,
      label: t(`l_${language}`) ?? language,
      icon: `flag-${language}`,
      // tooltip: 'select this',
    };

    baseLanguageOptiones.push(currentLanguageOption);
  }

  for (const language of availableLanguages) {
    // const untypedStrings = strings as any;

    const currentLanguageOption = {
      value: language,
      label: t(`l_${language}`) ?? language,
      // tooltip: 'select this',
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
            {t('file_onboarding__baselang_cta')}
            <br />
            {t('file_onboarding__baselang_cta_detail')}
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
              {t('file_onboarding__next_button')}
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
              {t('file_onboarding__back_button')}
            </span>
          </button>
          {
            // TODO deactivate if baseLanguageState === undefined && selectedLanguages.length === 0
          }
          <button
            className="button button--buttonSecondary"
            type="button"
            onClick={() => {
              if (baseLanguageState !== undefined) {
                onFinishSetup(baseLanguageState, selectedLanguages);
              }
            }}
          >
            <span data-tooltip-type="text">
              {t('file_onboarding__finish_setup_button')}
            </span>
          </button>
        </div>

      </>

      )}

    </div>
  );
}
