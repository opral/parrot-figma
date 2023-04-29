/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import { SupportedLanguages, Language } from '../../../lib/base/Language';
import TileSelect, { TileSelectOption } from '../../compontents/tileselect/tileselect';

import './Import.css';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import FileDropZone from '../../compontents/dropzone/Dropzone';
import KeyImporter from '../../../lib/import/KeyImporter';
import { ImportTranslationKey } from '../../../lib/import/ImportTranslationKey';


type ImportProps = {
  translationKeyStore: MemoryTranslationKeyStore
};

export default function Import({
  translationKeyStore,
}: ImportProps) {
  const { t } = useTranslation();

  const languageOptiones = [] as TileSelectOption<Language>[];
  const availableLanguages = SupportedLanguages;
  const [importLanguageState, setImportLanguageState] = useState<Language | undefined>(undefined);
  const [activeView, setActiveView] = useState('baselanguage');
  const [importKeys, setImportKeys] = useState<ImportTranslationKey[] | undefined>(undefined);
  const [fileType, setFileType] = useState<string | undefined>(undefined);
  const [importKeysByState, setimportKeysByState] = useState<{
    newKeys: ImportTranslationKey[],
    newTranslations: ImportTranslationKey[],
    updatedTranslations: ImportTranslationKey[],
  } | undefined>(undefined);

  const setImportLanguage = (importLanguage: Language[]) => {
    if (importLanguage.length === 1) {
      setImportLanguageState(importLanguage[0]);
      const importStats = KeyImporter.getImportStatistics(translationKeyStore, importKeys!, importLanguage[0]);
      setimportKeysByState(importStats);
    } else {
      setImportLanguageState(undefined);
      setimportKeysByState(undefined);
    }
  };

  // const [baseLanguage, setBaseLanguages] = useState(translationKeyStore.getBaseLanugages());

  for (const language of availableLanguages) {
    const currentLanguageOption = {
      value: language,
      label: t(`l_${language}`) ?? language,
      icon: `flag-${language}`,
      // tooltip: 'select this',
    };

    languageOptiones.push(currentLanguageOption);
  }

  return (
    <div>
      { (!fileType || fileType === 'unsupported') && (
      <div>
        <FileDropZone
          onFilesReceived={(files: any) => {
            for (const filename of Object.keys(files)) {
              const importResult = KeyImporter.processFile(filename, files[filename]);
              setFileType(importResult.type);
              setImportKeys(importResult.keys);
            }
          }}
        />
      </div>
      )}

      { fileType && fileType !== 'unsupported' && (

      <>
        <div>
          <div>
            { fileType }
            <br />
            Please select langueages to translate the designfile for.
          </div>
          <div>
            <TileSelect<Language>
              onChange={setImportLanguage}
            // defaultValue={rootFrameLanguage?.value}
              options={languageOptiones}
              defaultSelection={importLanguageState ? [importLanguageState] : undefined}
              multiselect={false}
            />

          </div>
          { importKeysByState && (
          <div>
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
            <div>
              {importKeysByState.updatedTranslations.map((value) => {
                console.log('diff');
                console.log(value.text);
                console.log(translationKeyStore.getKey(value.keyName)!.translations[importLanguageState!]![value.plural]!.text);

                return (
                  <>
                    <div>{value.keyName}</div>
                    <div>{value.plural}</div>
                    <div>{value.text}</div>
                    <div>{translationKeyStore.getKey(value.keyName)!.translations[importLanguageState!]![value.plural]!.text}</div>
                  </>
                );
              })}
            </div>
          </div>
          )}

        </div>
        <div>
          { importKeysByState && (
          <button
            className="button button--buttonSecondary"
            type="button"
            onClick={() => {
              KeyImporter.import(translationKeyStore, importKeys!, importLanguageState!);
            }}
          >
            <span data-tooltip-type="text">
              Import
            </span>
          </button>
          )}
          {
            // TODO deactivate if baseLanguageState === undefined && selectedLanguages.length === 0
          }
          <button
            className="button button--buttonSecondary"
            type="button"
            onClick={() => {
              setFileType(undefined);
              setImportKeys(undefined);
            }}
          >
            <span data-tooltip-type="text">
              cancel
            </span>
          </button>
        </div>

      </>

      )}

    </div>
  );
}
