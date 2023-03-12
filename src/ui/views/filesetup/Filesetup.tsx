/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import Select, { SelectOption } from '../../compontents/select/select';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import Language from '../../../lib/base/Language';
import './Filesetup.css';

  type FilesetupProps = {
    translationKeyStore: MemoryTranslationKeyStore
    // selectLanguage: Function,
  };

export default function Filesetup({
  translationKeyStore,
}: FilesetupProps) {
  const languageOptiones = [] as SelectOption[];

  const availableLanguages = Object.values(Language);
  const [selectedLanguages, setSelectedLanguages] = useState(translationKeyStore.getLanugages() ?? []);
  const [baseLanguageState, setBaseLanguageState] = useState(translationKeyStore.getBaseLanugage());

  // const [baseLanguage, setBaseLanguages] = useState(translationKeyStore.getBaseLanugages());

  for (const language of availableLanguages) {
    const currentLanguageOption = {
      value: language, label: language, icon: `flag-${language}`,
    };
    /*
    if (language === firstTranslationState.rootFrameLanguage) {
      rootFrameLanguage = currentLanguageOption;
    } */
    languageOptiones.push(currentLanguageOption);
  }

  function setLanguageSelected(language: Language, selected: boolean) {
    setSelectedLanguages((languages) => {
      let newLanguages;
      if (selected) {
        if (languages.indexOf(language) === -1) {
          newLanguages = [...languages, language];
        } else {
          newLanguages = [...languages];
        }
      } else {
        newLanguages = languages.filter((l) => l !== language);
      }
      translationKeyStore.setLanguages(newLanguages);
      return newLanguages;
    });
  }

  function setBaselanguage(language: Language) {
    setLanguageSelected(language, true);
    setBaseLanguageState(language);
    translationKeyStore.setBaseLanguages(language);
  }

  useEffect(() => {

  }, []);

  return (
    <div>
      <div>
        Please select the base language.
        <br />
        Please select the language in which the design file is currently written?
        <br />
        <Select
          placeholder="Select item"
          onChange={(value) => { setBaselanguage(value.value as Language); }}
          // defaultValue={rootFrameLanguage?.value}
          options={languageOptiones}
        />
        <div>
          { Object.values(availableLanguages).map((language) => (
            <div key={language} className="available-language">
              <label className="checkboxHitbox">
                <input
                  className="checkboxInput"
                  type="checkbox"
                  key={language}
                  onChange={(e: any) => { setLanguageSelected(language, e.target.checked); }}
                  checked={selectedLanguages.indexOf(language) !== -1}
                  disabled={language === baseLanguageState}
                />
                <span className={`svg-container checkbox-svg checkbox--checkmark checkbox--checkmark mixed_checkbox--checkmark${selectedLanguages.indexOf(language) !== -1 ? ' checkbox--checked' : ''}`} />
              </label>

              <div className={`svg-container flag-${language}`} />
              <div className="language">
                {language}
                {' '}
                {(language === baseLanguageState) ? '(base language)' : ''}
              </div>
            </div>
          )) }
        </div>
      </div>
    </div>
  );
}
