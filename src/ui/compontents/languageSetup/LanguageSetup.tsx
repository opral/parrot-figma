/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import { use } from 'i18next';
import Select, { SelectOption } from '../select/select';
import { SearchQuery, UITranslationKeys } from '../../../lib/keystore/MemoryTranslationKeyStore';
import { Language } from '../../../lib/base/Language';
import './LanguageSetup.css';
import ReactSelect, { MultiValueRemoveProps, components } from 'react-select';
import OutsideClickHandler from 'react-outside-click-handler';
import FileDropZone from '../dropzone/Dropzone';
import FileSelect from '../fileselect/FileSelect';
import KeyImporter, { ImportResult, ImportType } from '../../../lib/import/KeyImporter';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import { ImportTranslationKey } from '../../../lib/import/ImportTranslationKey';
import Drawer from '../drawer/Drawer';

function Option(props: any) {
  return (
    <div>
      <components.Option {...props}>
        <div className="svg-container checkmark-svg" />
        <label>{props.data.menuLabel}</label>
      </components.Option>
    </div>
  );
}

function MultiValueRemove(props: MultiValueRemoveProps<any>) {
  return (
    <components.MultiValueRemove {...props}><div className="react-select__remove_language svg-container cross-svg" /></components.MultiValueRemove>
  );
}

function DropdownIndicator(props: any) {
  return (<div className="react-select__dropdown_indicator  svg-container caret-svg" />);
}

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

type LanguageSetupProps = {
  labelManager: LocalizedLabelManagerUI,
  activeLanguages: Language[]
  baseLanguage: Language | undefined
  onChange: (baseLanguage: Language, activeLanguages: Language[]) => void
};
export default function LanguageSetup({
  labelManager,
  activeLanguages,
  baseLanguage,
  onChange,
}: LanguageSetupProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<any[]>(toLanguageOptions(activeLanguages.filter((language) => language !== baseLanguage)));
  const [selectedBaseLanguage, setSelectedBaseLanguage] = useState(baseLanguage !== undefined ? toLanguageOption(baseLanguage) : undefined);

  const [changeBaseLanguage, setChangeBaseLanguage] = useState(baseLanguage === undefined);
  const [changeLanguages, setChangeLanguages] = useState(activeLanguages.length === 0);

  const availableLanguages = toLanguageOptions(Object.values(Language), selectedBaseLanguage !== undefined ? selectedBaseLanguage.value : undefined);

  const [importResult, setImportResult] = useState(undefined as ImportResult | undefined);

  const [importKeysByState, setimportKeysByState] = useState<{
    language: Language,
    newKeys: ImportTranslationKey[],
    newTranslations: ImportTranslationKey[],
    updatedTranslations: ImportTranslationKey[],
  } | undefined>(undefined);

  const [keySummary, setKeySummary] = useState(labelManager.keyStore.findKeys({}, undefined));

  useEffect(() => {
    const updateSummary = () => { setKeySummary(labelManager.keyStore.findKeys({}, undefined)); };

    labelManager.keyStore.addEventListener('updated', updateSummary);

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    return () => {
      labelManager.keyStore.removeEventListener('updated', updateSummary);
    };
  }, []);

  const onSelectedBaseLanguageChange = (
    value: any,
  ) => {
    setChangeBaseLanguage(false);

    if (selectedBaseLanguage?.value !== value) {
      const previousBaseLanguage = selectedBaseLanguage;
      const currentLanguages = selectedLanguages;
      if (previousBaseLanguage !== undefined && currentLanguages.findIndex((languageOption) => languageOption.value === previousBaseLanguage.value) === -1) {
        currentLanguages.push(previousBaseLanguage);
      }
      const updatedLanguages = currentLanguages;

      setSelectedLanguages(updatedLanguages.filter((languageOption) => languageOption.value !== value.value));

      setSelectedBaseLanguage(value);
      onChange(value.value as Language, updatedLanguages.map((languageOption: any) => languageOption.value as Language));
    }
  };

  const onSelectedLanguagesChange = (
    values: any,
  ) => {
    const languagesWithBaseLanguage = [...values];
    if (languagesWithBaseLanguage.findIndex((languageOption) => languageOption.value === selectedBaseLanguage!.value) === -1) {
      languagesWithBaseLanguage.push(selectedBaseLanguage);
    }

    setSelectedLanguages(values);
    onChange(selectedBaseLanguage!.value as Language, languagesWithBaseLanguage.map((languageOption: any) => languageOption.value as Language));
  };

  return (
    <div>
      <Drawer
        position="top"
        buttons={[
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              // set back to head
              setImportResult(undefined);
            },
          },
          {
            type: 'primary',
            text: 'Import Keys',
            key: 'enter',
            disabled: importResult && importResult!.type === ImportType.UNSUPPORTED,
            callback: () => {
              labelManager.import(importResult!.keys!, importKeysByState!.language);
              setImportResult(undefined);
              setimportKeysByState(undefined);
            },
          },

        ]}
        shown={importResult !== undefined}
      >
        <div className="history_view--topHeader">
          Import keys
        </div>
        <div>
          { importResult && importResult.type === ImportType.UNSUPPORTED && (
          <div>
            File Type currently not supported.
            <br />
            {' '}
            Supported are Apple's
            {' '}
            <b>.stringsdict</b>
            ,
            {' '}
            <b>.strings</b>
            {' '}
            and Android's
            {' '}
            <b>.xml</b>
            {' '}
            file.
            {' '}

          </div>
          )}

          { importResult && importResult.type !== ImportType.UNSUPPORTED && importKeysByState && (
          <div>
            Detected Format:
              {' '}
            {importResult.type}
            <br />
            Filename:
              {' '}
            {importResult.fileName}
            <br />
            Language:
              {' '}
            {importKeysByState.language}
            <br />
            New Keys:
              {' '}
            {importKeysByState.newKeys.length}
            <br />
            New translations:
              {' '}
            {importKeysByState.newTranslations.length}
            <br />
            Updated translations:
              {' '}
            {importKeysByState.updatedTranslations.length}
            <br />

          </div>

          )}
        </div>
      </Drawer>
      <div className={selectedBaseLanguage === undefined ? 'no-base-language' : undefined}>
        <div className="setup-header">
          <div className="setup-header-title">Main file language</div>
          { !changeBaseLanguage && (
          // eslint-disable-next-line jsx-a11y/no-static-element-interactions
          <div className="choosen-language-change" onClick={() => { setChangeBaseLanguage(true); }}>Change</div>
          )}
        </div>
        { changeBaseLanguage && (
          <div className="choose-language single-value">
            <OutsideClickHandler
              onOutsideClick={() => { if (selectedBaseLanguage !== undefined) setChangeBaseLanguage(false); }}
              display="contents"
            >
              <ReactSelect
                filterOption={(option : any, input) => option.data.menuLabel.toLowerCase().indexOf(input.toLowerCase()) !== -1}
                options={availableLanguages}
                placeholder="Select Language"
                defaultValue={selectedBaseLanguage}
                components={{
                  DropdownIndicator,
                  MultiValueRemove,
                  Option,
                }}
                classNamePrefix="react-select"
                onChange={onSelectedBaseLanguageChange}
              />

            </OutsideClickHandler>
          </div>
        )}
        { !changeBaseLanguage && (
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
              <div className="language-import-action">
                <FileSelect
                  text="Import"
                  onFilesReceived={(files: any) => {
                    for (const filename of Object.keys(files)) {
                      const importResultFromSelectedFile = KeyImporter.processFile(filename, files[filename]);
                      setImportResult(importResultFromSelectedFile);
                      const importStats = KeyImporter.getImportStatistics(labelManager.keyStore, importResultFromSelectedFile.keys!, selectedBaseLanguage!.value as Language);
                      setimportKeysByState(importStats);
                    }
                  }}
                />

              </div>
            </div>

          </div>
        </div>
        )}
        <div style={{ height: '8px' }} />
        <div className="setup-header needs-base-language">
          <div className="setup-header-title">Target locales</div>
          { !changeLanguages && (
          <div className="choosen-language-change" onClick={() => { setChangeLanguages(true); }}>Change</div>
          )}
        </div>
        <div className="setup-text needs-base-language">
          Select languages to translate to from the main language.
        </div>
        { changeLanguages && (
        <div className="choose-language needs-base-language">
          <OutsideClickHandler
            onOutsideClick={() => { setChangeLanguages(selectedLanguages.length === 0); }}
            display="contents"
            disabled={selectedBaseLanguage === undefined}
          >
            <ReactSelect
              filterOption={(option : any, input) => option.data.menuLabel.toLowerCase().indexOf(input.toLowerCase()) !== -1}
              options={availableLanguages}
              value={selectedLanguages}
              placeholder="Select additional Languages"
              isMulti
              isDisabled={selectedBaseLanguage === undefined}
              closeMenuOnSelect
              hideSelectedOptions={false}
              isClearable={false}
              components={{
                DropdownIndicator,
                MultiValueRemove,
                Option,
              }}
              onChange={onSelectedLanguagesChange}
              classNamePrefix="react-select"
            />
            {' '}

          </OutsideClickHandler>
        </div>
        )}
        { !changeLanguages && (
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
                  <div className="language-import-action">
                    <FileSelect
                      text="Import"
                      onFilesReceived={(files: any) => {
                        for (const filename of Object.keys(files)) {
                          const importResultFromSelectedFile = KeyImporter.processFile(filename, files[filename]);
                          setImportResult(importResultFromSelectedFile);
                          const importStats = KeyImporter.getImportStatistics(labelManager.keyStore, importResultFromSelectedFile.keys!, languageOption.value as Language);
                          setimportKeysByState(importStats);
                        }
                      }}
                    />
                  </div>
                </>
              ))}
            </div>
            {/* <div className="choosen-language-change" onClick={() => { setChangeLanguages(true); }}>Change</div> */}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
