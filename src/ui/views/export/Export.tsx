/* eslint-disable no-await-in-loop */
/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import '../../localization/i18n';
import { useTranslation } from 'react-i18next';
import OutsideClickHandler from 'react-outside-click-handler';

import MessageStoreMemory from '../../../lib/message/store/MessageStoreMemory';
import Select, { SelectOption } from '../../compontents/select/select';
import './Export.css';
import TileSelect, { TileSelectOption } from '../../compontents/tileselect/tileselect';
import { Locale } from '../../../lib/message/variants/Locale';
import KeyExporter from '../../../lib/export/KeyExporter';
import FEATURES_FLAGS from '../../featuretoggle';

type ExportProps = {
  messageStore: MessageStoreMemory
};
/**
 * Select versionTag (allow to tag current Version)
 * Select Language for export
 * Select platform (ios/android) / export format
 */
export default function Export({
  messageStore,
}: ExportProps) {
  const { t } = useTranslation();

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

  const initTagOptions = defaultOptions.concat(messageStore.historyTags.slice().reverse().map((historyTag) => ({
    label: historyTag.title,
    value: historyTag.versionId!,
  } as SelectOption)));

  const [selectedVersion, setSelectedVersion] = useState<string>('head');
  const [title, setTitle] = useState('test');
  const [description, setDescription] = useState('');
  const [tagOptions, setTagOptions] = useState(initTagOptions);
  const [exportLanguage, setExportLanguage] = useState<Locale | undefined>(undefined);
  const [exportPlatform, setExportPlatform] = useState<string | undefined>(undefined);

  const exportLanguageOptions = [] as TileSelectOption<Locale>[];
  const exportPlatformOptions = [{
    label: 'Android',
    value: 'android',
    subLabel: 'strings.xml',
    forceSelected: false,
  }, {
    label: 'iOS',
    value: 'ios',
    subLabel: 'strings.dict, language.strings',
    forceSelected: false,
  }] as TileSelectOption<string>[];

  for (const language of messageStore.getLanugages()!) {
    // const untypedStrings = strings as any;

    const currentLanguageOption = {
      value: language,
      label: (new Intl.DisplayNames('en', { type: 'language' }).of(language)) + ' - ' + language,
      // tooltip: 'select this',
      // icon: `flag-${language}`,
      forceSelected: language === exportLanguage,
      subLabel: language === exportLanguage ? '(base language)' : undefined,
    } as TileSelectOption<Locale>;

    exportLanguageOptions.push(currentLanguageOption);
  }

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
  // const [baseLanguage, setBaseLanguages] = useState(messageStore.getBaseLanugages());

  const onTagCurrentVersionClick = async () => {
    const newTag = await messageStore.createTag(title, description);
    const options = defaultOptions.concat(messageStore.historyTags.slice().reverse().map((historyTag) => ({
      label: historyTag.title,
      value: historyTag.versionId!,
    } as SelectOption)));
    setTagOptions(options);
    setSelectedVersion(newTag.versionId!);
  };

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
      <div>
        Select Language
        <TileSelect<Locale>
          onChange={(selectedLang: Locale[]) => {
            if (selectedLang.length === 1) {
              setExportLanguage(selectedLang[0]);
            } else {
              setExportLanguage(undefined);
            }
          }}
            // defaultValue={rootFrameLanguage?.value}
          options={exportLanguageOptions}
          defaultSelection={exportLanguage ? [exportLanguage] : undefined}
          multiselect={false}
        />
      </div>
      <div>
        select platform
        <TileSelect<string>
          onChange={(selectedPlatform: string[]) => {
            if (selectedPlatform.length === 1) {
              setExportPlatform(selectedPlatform[0]);
            } else {
              setExportPlatform(undefined);
            }
          }}
            // defaultValue={rootFrameLanguage?.value}
          options={exportPlatformOptions}
          defaultSelection={exportLanguage ? [exportLanguage] : undefined}
          multiselect={false}
        />
      </div>
      <div>
        { exportPlatform === 'ios' && (
        <>
          <button
            className="button button--buttonSecondary"
            type="button"
            onClick={async () => {
              const exportedFile = KeyExporter.export(messageStore, exportLanguage!, 'apple-strings', selectedVersion);

              if (exportedFile) {
                downloadFile(exportedFile.fileName, exportedFile.fileType, exportedFile.content);
              }
            }}
          >
            <span data-tooltip-type="text">
              Export to strings file
            </span>
          </button>
          <button
            className="button button--buttonSecondary"
            type="button"
            onClick={async () => {
              const exportedFile = KeyExporter.export(messageStore, exportLanguage!, 'apple-dict', selectedVersion);

              if (exportedFile) {
                downloadFile(exportedFile.fileName, exportedFile.fileType, exportedFile.content);
              }
            }}
          >
            <span data-tooltip-type="text">
              Export dict file
            </span>
          </button>

        </>
        )}
        { exportPlatform === 'android' && (
        <button
          className="button button--buttonSecondary"
          type="button"
          onClick={async () => {
            const exportedFile = KeyExporter.export(messageStore, exportLanguage!, 'android-xml', selectedVersion);

            if (exportedFile) {
              downloadFile(exportedFile.fileName, exportedFile.fileType, exportedFile.content);
            }
          }}
        >
          <span data-tooltip-type="text">
            Export to strings.xml file
          </span>
        </button>
        )}
      </div>
      { selectedVersion === 'tag-current' && (
      <div className="modal-window-background">
        <OutsideClickHandler
          onOutsideClick={() => setSelectedVersion('head')}
          display="contents"
        >
          <div className="modal-window">
            <div className="modal-window-title">Tag current version</div>
            <div>
              <div className="modal-window-section">

                <input
                  type="text"
                  className="modal-window-input"
                  placeholder="Titel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="modal-window-section">
                <textarea
                  className="modal-window-input"
                  style={{ minHeight: '90px', minWidth: '300px' }}
                  placeholder="Description what changed"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="modal-window-button-row">
                <div className="buttonGroup buttonGroup-reversed">
                  <button
                    className="button button-primary"
                    type="button"
                    onClick={() => onTagCurrentVersionClick()}
                    disabled={title.length === 0}
                  >
                    <span data-tooltip-type="text">
                      Tag
                    </span>
                  </button>
                  <button
                    className="button button-secondary"
                    type="button"
                    onClick={() => {
                      // set back to head
                      setSelectedVersion('head');
                    }}
                  >
                    <span data-tooltip-type="text">
                      Cancel
                    </span>
                  </button>
                </div>
              </div>
            </div>
          </div>

        </OutsideClickHandler>
      </div>
      )}
    </div>
  );
}
