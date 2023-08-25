/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { Language } from '../../../lib/message/variants/Locale';
import LanguageSetup from '../../compontents/languageSetup/LanguageSetup';

type SetupViewProps = {
  labelManager: LocalizedLabelManagerUI
};

export default function SetupView({
  labelManager,
}: SetupViewProps) {
  return (
    <LanguageSetup
      labelManager={labelManager}
      baseLanguage={labelManager.keyStore.getBaseLanugage()}
      activeLanguages={labelManager.keyStore.getLanugages()!}
      onChange={async (baselanguage: Language, activeLanguages: Language[]) => {
        
        await labelManager.keyStore.setBaseLanguage(baselanguage);
        await labelManager.keyStore.setLanguages(activeLanguages);
      }}
    />
  );
}
