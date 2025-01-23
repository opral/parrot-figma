/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { Locale } from '../../../lib/message/variants/Locale';
import LanguageSetup from '../../compontents/languageSetup/LanguageSetup';

type SetupViewProps = {
  labelManager: LocalizedLabelManagerUI;
};

export default function SetupView({ labelManager }: SetupViewProps) {
  return (
    <>
      <LanguageSetup
        labelManager={labelManager}
        baseLanguage={labelManager.messageStore.getRefLanugage()}
        activeLanguages={labelManager.messageStore.getLanugages()!}
        onChange={async (baselanguage: Locale, activeLanguages: Locale[]) => {
          await labelManager.messageStore.setRefLanguage(baselanguage);
          await labelManager.messageStore.setLanguages(activeLanguages);
        }}
      />

      {/* <div
        className="start-staging-ui"
        onClick={() => {
          // @ts-expect-error
          window.startDevMode();
        }}
      >
        stagin-ui
      </div> */}
    </>
  );
}
