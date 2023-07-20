/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import LanguageSetup from '../../compontents/languageSetup/LanguageSetup';

import './Onboarding.css';
import { Language } from '../../../lib/base/Language';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';

type OnboardingProps = {
  labelManager: LocalizedLabelManagerUI,
  onFinishSetup: Function,
};

export default function Onboarding({
  labelManager,
  onFinishSetup,
}: OnboardingProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<Language[]>(labelManager.keyStore.getLanugages() ?? []);
  const [selectedBaseLanguage, setSelectedBaseLanguage] = useState<Language | undefined>(labelManager.keyStore.getBaseLanugage());

  const finishSetupClick = () => {
    onFinishSetup();
  };

  return (
    <div className="view">
      <div className="setup-header">
        Set up your file
      </div>
      <div className="setup-text">
        Let Parrot know which language your design file is mainly using. You can then define target locales to translate to.
      </div>
      <LanguageSetup
        labelManager={labelManager}
        activeLanguages={[]}
        baseLanguage={undefined}
        onChange={(baselanguage: Language, activeLanguages: Language[]) => {
          setSelectedBaseLanguage(baselanguage);
          setSelectedLanguages(activeLanguages);
          labelManager.keyStore.setBaseLanguage(baselanguage);
          labelManager.keyStore.setLanguages(activeLanguages);
        }}
      />
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
