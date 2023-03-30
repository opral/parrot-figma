/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';

import LocalizedStrings, { LocalizedStringsMethods } from 'localized-strings';
import LocalizedLabelsListView from './views/localizedlabelslist/LocalizedLabelsListView';
import FigmaUtil from '../shared/FigmaUtil';
import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import './ui.css';
import WindowManagerUi from '../lib/windowManager/WindowManagerUI';
import { WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import { TranslationKeys } from '../lib/keystore/TranslationKey';
import TranslationKeyListView from './views/translationkeys/TranslationKeyListView';

import MemoryTranslationKeyStore from '../lib/keystore/MemoryTranslationKeyStore';
import { FigmaFileTranslationKeyStore } from '../lib/keystore/FigmaFileTranslationKeyStore';

import LocalizedLabelManager from '../lib/localizedlabels/LocalizedLabelManager';
import LocalizedLabelManagerUI from '../lib/localizedlabels/LocalizedLabelManagerUI';

import './tabbar.css';
import './assets/icons.css';
import SegmentedControl from './compontents/segmentedControl/SegmentedControl';
import Filesetup from './views/filesetup/Filesetup';
import Onboarding from './views/onboarding/Onboarding';
import Language from '../lib/base/Language';
import LanguageContextProvider from './LanguageContext';
import Tooltip from './compontents/tooltip/Tooltip';

window.addEventListener('keydown', (e) => {
  if (e.key === 'z' && !e.shiftKey && !e.altKey) {
    // Undo the action in Figma
    const isMac = navigator.userAgent.indexOf('Macintosh') >= 0;
    const isCmd = isMac && e.metaKey && !e.ctrlKey;
    const isCtrl = !isMac && !e.metaKey && e.ctrlKey;
    if (isCmd || isCtrl) {
      window.parent.postMessage({ pluginMessage: { type: 'undo' } }, '*');
    }
  }
});

WindowManagerUi.init(
  document.getElementById('sizing-wrapper')!,
  document.getElementById('react-page')!,
  document.getElementById('corner')!,
);

export interface IStrings extends LocalizedStringsMethods {
  score:string;
  time: String;
}

const asyncFunctionProxy = new AsyncFunctionProxy('UIAsyncFunctionProxy', (data: any) => {
  // eslint-disable-next-line no-restricted-globals
  parent.postMessage({
    pluginMessage: data,
  }, '*');
}, window);

const remoteLocalizedLabelManager = new LocalizedLabelManager(undefined);
asyncFunctionProxy.proxyAsyncMethods(remoteLocalizedLabelManager);

const figmaRemote = new FigmaUtil();
asyncFunctionProxy.proxyAsyncMethods(figmaRemote);

const figmaFileTranslationKeyStore = new FigmaFileTranslationKeyStore(true);
asyncFunctionProxy.proxyAsyncMethods(figmaFileTranslationKeyStore);

const memoryTranslationKeyStore = new MemoryTranslationKeyStore(figmaFileTranslationKeyStore);

const localizedLabelManager = new LocalizedLabelManagerUI(remoteLocalizedLabelManager, memoryTranslationKeyStore);

function App() {
  // initial app screen is startup until we initialy loaded the data
  const [appScreen, setAppScreen] = useState(undefined as String | undefined);

  const [translatedKeys, setTranslatedKeys] = useState({} as TranslationKeys);

  const [, setDefaultLinkStyle] = useState('' as string);

  const refreshTranslatedKeys = async () => {
    setTranslatedKeys(memoryTranslationKeyStore.translationKeys);
  };

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      await memoryTranslationKeyStore.load();
      await localizedLabelManager.loadAll();

      setDefaultLinkStyle(await remoteLocalizedLabelManager.getLinkStyle());

      await refreshTranslatedKeys();

      let initialScreen = 'design';
      if (localizedLabelManager.keyStore.config?.baseLanguage === undefined
        || localizedLabelManager.keyStore.config?.enabledLanguages === undefined) {
        initialScreen = 'onboarding';
      }
      setAppScreen(initialScreen);
    })();
  }, []);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- TODO implement this
  const setLinkStyle = async (linkStyle: string) => {
    remoteLocalizedLabelManager.setLinkStyle(linkStyle);
    setDefaultLinkStyle(linkStyle);
  };

  if (!appScreen) {
    return <>Not ready</>;
  }

  let view;
  if (appScreen === 'onboarding') {
    return (
      <>
        <Tooltip triggerAttribute="data-tooltip-trigger" contentAttribute="data-tooltip-content" />
        <Onboarding onFinishSetup={async (baseLanguage: Language, selectedLanguages: Language[]) => {
        // put baselanguage to the first position
          const languages = [baseLanguage, ...selectedLanguages.filter((lang) => lang !== baseLanguage)];
          await memoryTranslationKeyStore.setLanguages(languages);
          await memoryTranslationKeyStore.setBaseLanguage(baseLanguage);
          setAppScreen('design');
        }}
        />
      </>

    );
  } if (appScreen === 'keys') {
    view = (
      <TranslationKeyListView
        translationKeyStore={memoryTranslationKeyStore}
        localizedLabelManager={localizedLabelManager}
        keys={translatedKeys}
        figmaRemote={figmaRemote}
        refreshKeys={refreshTranslatedKeys}
      />
    );
  } else if (appScreen === 'settings') {
    view = (
      <Filesetup
        translationKeyStore={memoryTranslationKeyStore}
        showNextButton={false}
      />
    );
  /* (
      <ConfigView
        linkStyle={defaultLinkStyle}
        setLinkStyle={setLinkStyle}
        translationKeyStore={memoryTranslationKeyStore}
      />
    ); */
  } else {
    view = (
      <LocalizedLabelsListView
        translationKeyStore={memoryTranslationKeyStore}
        localizedLabelManager={localizedLabelManager}
        figmaRemote={figmaRemote}
      />
    );
  }

  return (

    <LanguageContextProvider>
      <Tooltip triggerAttribute="data-tooltip-trigger" contentAttribute="data-tooltip-content" />
      <div className="toolbar">
        <div className="tabHeader">
          <div className={`tab ${appScreen === 'design' ? 'active' : ''}`} onClick={() => setAppScreen('design')}>Design</div>
          <div className={`tab ${appScreen === 'keys' ? 'active' : ''}`} onClick={() => setAppScreen('keys')}>Keys</div>
          <div className={`tab ${appScreen === 'version&export' ? 'active' : ''}`} onClick={() => setAppScreen('keys')}>Versions & Export</div>
          <div className={`tab ${appScreen === 'settings' ? 'active' : ''}`} onClick={() => setAppScreen('settings')}>Settings</div>
        </div>
        <div className="window-control">
          <SegmentedControl
            segments={[{
              iconName: 'window-mode-window-svg',
              value: WindowMode.Window,
              tooltip: 'Window Mode',
            }, {
              iconName: 'window-mode-fullscreen-svg',
              value: WindowMode.Fullscreen,
              tooltip: 'Fullscreen Mode',
            }, {
              iconName: 'window-mode-bottom-attached-svg',
              value: WindowMode.BottomSheet,
              tooltip: 'Dock to bottom',
            }]}
            selectedSegment={WindowMode.Window}
            onChoose={(windowMode: WindowMode) => { WindowManagerUi.instance?.setWindowMode(windowMode); }}
          />

        </div>

      </div>

      <div className="view">
        {view}
      </div>
      <a id="focusHelper" href="" />

    </LanguageContextProvider>
  );
}

ReactDOM.render(<App />, document.getElementById('react-page'));
