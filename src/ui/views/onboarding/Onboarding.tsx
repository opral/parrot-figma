/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import LanguageSetup from '../../compontents/languageSetup/LanguageSetup';

import './Onboarding.css';
import { Language } from '../../../lib/base/Language';

type OnboardingProps = {
  onFinishSetup: Function,
};

export default function Onboarding({
  onFinishSetup,
}: OnboardingProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>([]);
  const [selectedBaseLanguage, setSelectedBaseLanguage] = useState<Language | undefined>(undefined);

  const handleChange = (newBaseLanguage: Language, newSelectedLanguages: Language[]) => {
    setSelectedBaseLanguage(newBaseLanguage);
    setSelectedLanguages(newSelectedLanguages);
  };

  const finishSetupClick = () => {
    onFinishSetup(selectedBaseLanguage, selectedLanguages);
  };

  return (
    <div className="view">
      
      <div className="setup-header">
        Set up your file
      </div>
      <div className="setup-text">
        Let Parrot know which language your design file is mainly using. You can then define target locales to translate to.
      </div>
      <LanguageSetup activeLanguages={[]} baseLanguage={undefined} onChange={handleChange} />
      <div className="onboarding-buttonbar">
        <button className="button button--buttonPrimary" disabled={selectedBaseLanguage === undefined || selectedLanguages.length === 0} type="button" onClick={finishSetupClick}>
          <span data-tooltip-type="text">
            Finish Setup
          </span>
        </button>
      </div>
    </div>
  );
}
