/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { Language } from '../../../lib/base/Language';
import LanguageSetup from '../../compontents/languageSetup/LanguageSetup';

type SetupViewProps = {
  labelManager: LocalizedLabelManagerUI
};

export default function SetupView({
  labelManager,
}: SetupViewProps) {
  return (
    <LanguageSetup
      baseLanguage={labelManager.keyStore.getBaseLanugage()}
      activeLanguages={labelManager.keyStore.getLanugages()!}
      onChange={(baselanguage: Language, activeLanguages: Language[]) => {
        labelManager.keyStore.setBaseLanguage(baselanguage);
        labelManager.keyStore.setLanguages(activeLanguages);
      }}
    />
  );
}
