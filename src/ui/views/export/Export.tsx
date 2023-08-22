/* eslint-disable no-await-in-loop */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import OutsideClickHandler from 'react-outside-click-handler';

import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import Select, { SelectOption } from '../../compontents/select/select';
import './Export.css';
import TileSelect, { TileSelectOption } from '../../compontents/tileselect/tileselect';
import { Language } from '../../../lib/base/Language';
import KeyExporter from '../../../lib/export/KeyExporter';
import FEATURES_FLAGS from '../../featuretoggle';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import UserManagerUI from '../../../lib/usage/UsageManagerUI';

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
      menuLabel: `${languageNameInCurrentLanguage} - ${language} (${languageNameInForeignLanguage})`,
      isDisabled: true,
    };
  }
  return {
    value: language,
    label: `${languageNameInCurrentLanguage} - ${language}`,
    menuLabel: `${languageNameInCurrentLanguage} - ${language} (${languageNameInForeignLanguage})`,
  };
}

function toLanguageOptions(languages: string[], baseLanguage?: string) {
  return languages.map((language) => toLanguageOption(language, baseLanguage));
}

type ExportProps = {
  labelManager: LocalizedLabelManagerUI,
  userManager: UserManagerUI,
};
/**
 * Select versionTag (allow to tag current Version)
 * Select Language for export
 * Select platform (ios/android) / export format
 */
export default function Export({
  labelManager,
  userManager,
}: ExportProps) {
  const { t } = useTranslation();
  const translationKeyStore = labelManager.keyStore;

  const baseLanguage = labelManager.keyStore.getBaseLanugage()!;
  const selectedLanguages = toLanguageOptions(labelManager.keyStore.getLanugages()!.filter((language) => language !== baseLanguage));
  const selectedBaseLanguage = toLanguageOption(baseLanguage);

  const defaultOptions = [{
    label: 'Current Version',
    value: 'head',
  }, {
    label: '',
    divider: true,
  }, {
    label: 'Tag Current Version...',
    value: 'tag-current',
  }, {
    label: '',
    divider: true,
  }] as SelectOption[];

  const initTagOptions = defaultOptions.concat(translationKeyStore.historyTags.slice().reverse().map((historyTag) => ({
    label: historyTag.title,
    value: historyTag.versionId!,
  } as SelectOption)));

  const [selectedVersion, setSelectedVersion] = useState<string>('head');
  const [title, setTitle] = useState('test');
  const [description, setDescription] = useState('');
  const [tagOptions, setTagOptions] = useState(initTagOptions);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  const [exportTarget, setExportTarget] = useState<string | undefined>(undefined);

  const exportPlatformOptions = [ /* {
    label: 'i18next - json format',
    value: 'i18next',
  }, */ {
      label: 'Android - Resource XML',
      value: 'android-xml',
    }, {
      label: 'iOS - .strings File',
      value: 'apple-strings',
    }] as SelectOption[];

  const downloadFile = (fileName: string, fileType: string, content: string) => {
    const contentBlob = new Blob([content], { type: fileType });
    const fileUrl = URL.createObjectURL(contentBlob);

    const link = document.createElement('a');
    link.href = fileUrl;
    link.download = fileName;

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const onVersionSelect = (version: string) => {
    setSelectedVersion(version);
  };
  // const [baseLanguage, setBaseLanguages] = useState(translationKeyStore.getBaseLanugages());

  const onTagCurrentVersionClick = async () => {
    const newTag = await translationKeyStore.createTag(title, description);
    const options = defaultOptions.concat(translationKeyStore.historyTags.slice().reverse().map((historyTag) => ({
      label: historyTag.title,
      value: historyTag.versionId!,
    } as SelectOption)));
    setTagOptions(options);
    setSelectedVersion(newTag.versionId!);
  };

  const doExport = async (exportLanguage: Language, format: string) => {
    const precondition = await userManager.requestFeature('export');
    if (!precondition) {
      console.log('nope');
      return
    }
    const exportedFile = KeyExporter.export(translationKeyStore, exportLanguage, format, selectedVersion);
    if (exportedFile) {
      downloadFile(exportedFile.fileName, exportedFile.fileType, exportedFile.content);
    }
  };

  const [keySummary, setKeySummary] = useState(labelManager.keyStore.findKeys({}, undefined));

  useEffect(() => {
    const updateSummary = () => { setKeySummary(labelManager.keyStore.findKeys({}, undefined)); };

    labelManager.keyStore.addEventListener('updated', updateSummary);

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    return () => {
      labelManager.keyStore.removeEventListener('updated', updateSummary);
    };
  }, []);

  return (
    <div>
      { FEATURES_FLAGS.versioning && (
      <div>
        Please select the version you want to export
        <Select
          placeholder="Select Version"
          onChange={(value) => { onVersionSelect(value.value as string); }}
          getOptions={() => tagOptions}
          defaultValue={tagOptions.find((option) => option.value === selectedVersion)!}
        />
      </div>
      )}
      <div style={{ display: 'flex' }}>
        <div className="setup-header-title">
          Export
        </div>
        <div style={{ marginLeft: 'auto', marginRight: '8px' }}>
          <Select
            placeholder="Export Target"
            onChange={(value) => { setExportTarget(value.value as string); }}
            getOptions={() => exportPlatformOptions}
          />
        </div>
      </div>
      <div>
        <div className="setup-header">
          <div className="setup-header-title">Main file language</div>
        </div>
        <div className="choosen-language-control">
          <div className="change-control">
            <div className="svg-container world-svg" />

            <div className="choosen-languages">
              <div className="language-name"><div>{selectedBaseLanguage?.label}</div></div>
              <div className="language-summary">
                {keySummary.matchingKeys.size}
                {' '}
                Translation Keys
                {keySummary.withMissingTranslationsPerLanguage[selectedBaseLanguage!.value as Language]
                 && keySummary.withMissingTranslationsPerLanguage[selectedBaseLanguage!.value as Language]!.size > 0 && (
                 <div>
                   (
                   {keySummary.withMissingTranslationsPerLanguage[selectedBaseLanguage!.value as Language]!.size}
                   {' '}
                   Missing Translations)
                 </div>
                )}
              </div>
              <div className="language-export-action">
                <button className="button button--buttonSecondary" disabled={exportTarget === undefined} type="button" onClick={() => { doExport(selectedBaseLanguage.value as Language, exportTarget!); }}>
                  <span data-tooltip-type="text">
                    Export
                  </span>
                </button>
              </div>
            </div>

          </div>
        </div>
        <div style={{ height: '8px' }} />
        <div className="setup-header needs-base-language">
          <div className="setup-header-title">Target locales</div>
        </div>
        <div className="choosen-language-control">
          <div className="change-control">
            <div className="svg-container world-svg" />
            <div className="choosen-languages">
              { selectedLanguages.map((languageOption) => (
                <>
                  <div className="language-name-wrapper"><div className="language-name"><div>{languageOption.label}</div></div></div>
                  <div className="language-summary">

                    <div>

                      {keySummary.withMissingTranslationsPerLanguage[languageOption.value as Language]?.size ?? 0}
                      {' '}
                      Missing Translations
                    </div>

                  </div>
                  <div className="language-export-action">
                    <button className="button button--buttonSecondary" disabled={exportTarget === undefined} type="button" onClick={() => { doExport(languageOption.value as Language, exportTarget!); }}>
                      <span data-tooltip-type="text">
                        Export
                      </span>
                    </button>
                  </div>
                </>
              ))}
            </div>
            {/* <div className="choosen-language-change" onClick={() => { setChangeLanguages(true); }}>Change</div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
