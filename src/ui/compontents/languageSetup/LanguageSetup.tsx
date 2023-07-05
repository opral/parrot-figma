/* eslint-disable jsx-a11y/label-has-associated-control */
/* eslint-disable jsx-a11y/no-noninteractive-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useState } from 'react';
import Select, { SelectOption } from '../select/select';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import { Language } from '../../../lib/base/Language';
import './LanguageSetup.css';
import ReactSelect, { MultiValueRemoveProps, components } from 'react-select';
import OutsideClickHandler from 'react-outside-click-handler';

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
  if (baseLanguage && language === baseLanguage) {
    return {
      value: language,
      label: `${new Intl.DisplayNames('en', { type: 'language' }).of(language)} - ${language}`,
      menuLabel: `${new Intl.DisplayNames('en', { type: 'language' }).of(language)} - ${language} (${new Intl.DisplayNames(language, { type: 'language' }).of(language)})`,
      isDisabled: true,
    };
  }
  return {
    value: language,
    label: `${new Intl.DisplayNames('en', { type: 'language' }).of(language)} - ${language}`,
    menuLabel: `${new Intl.DisplayNames('en', { type: 'language' }).of(language)} - ${language} (${new Intl.DisplayNames(language, { type: 'language' }).of(language)})`,
  };
}

function toLanguageOptions(languages: string[], baseLanguage?: string) {
  return languages.map((language) => toLanguageOption(language, baseLanguage));
}

type LanguageSetupProps = {
  activeLanguages: Language[]
  baseLanguage: Language | undefined
  onChange: (baseLanguage: Language, activeLanguages: Language[]) => void
};

export default function LanguageSetup({
  activeLanguages,
  baseLanguage,
  onChange,
}: LanguageSetupProps) {
  const [selectedLanguages, setSelectedLanguages] = useState<any[]>(toLanguageOptions(activeLanguages));
  const [selectedBaseLanguage, setSelectedBaseLanguage] = useState(baseLanguage !== undefined ? toLanguageOption(baseLanguage) : undefined);

  const [changeBaseLanguage, setChangeBaseLanguage] = useState(baseLanguage === undefined);
  const [changeLanguages, setChangeLanguages] = useState(activeLanguages.length === 0);

  const availableLanguages = toLanguageOptions(Object.values(Language), selectedBaseLanguage !== undefined ? selectedBaseLanguage.value : undefined);

  const onSelectedBaseLanguageChange = (
    value: any,
  ) => {
    setChangeBaseLanguage(false);
    setSelectedBaseLanguage(value);
  };

  const onSelectedLanguagesChange = (
    values: any,
  ) => {
    setSelectedLanguages(values);
    onChange(selectedBaseLanguage!.value as Language, values.map((languageOption: any) => languageOption.value as Language));
  };

  return (
    <div>
      <div className={selectedBaseLanguage === undefined ? 'no-base-language' : undefined}>
        <div className="setup-header">
          Main file language
        </div>
        { changeBaseLanguage && (
          <div className="choose-language single-value">
            <OutsideClickHandler
              onOutsideClick={() => { if (selectedBaseLanguage !== undefined) setChangeBaseLanguage(false); }}
              display="contents"
            >
              <ReactSelect
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
        <div className="choosen-language">
          <div className="change-control">
            <div className="svg-container world-svg" />
            <div className="choosen-languages">
              <div className="language-name"><div>{selectedBaseLanguage?.label}</div></div>
            </div>
            <div className="choosen-language-change" onClick={() => { setChangeBaseLanguage(true); }}>Change</div>
          </div>
        </div>
        )}
        <div style={{ height: '8px' }} />
        <div className="setup-header needs-base-language">
          Target locales
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
        <div className="choosen-language">
          <div className="change-control">
            <div className="svg-container world-svg" />
            <div className="choosen-languages">
              { selectedLanguages.map((languageOption) => <div className="language-name"><div>{languageOption.label}</div></div>)}
            </div>
            <div className="choosen-language-change" onClick={() => { setChangeLanguages(true); }}>Change</div>
          </div>
        </div>
        )}
        <div style={{ height: '50px' }} />
      </div>
    </div>
  );
}
