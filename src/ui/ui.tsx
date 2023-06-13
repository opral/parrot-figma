/* eslint-disable jsx-a11y/anchor-is-valid */
/* eslint-disable jsx-a11y/anchor-has-content */
/* eslint-disable jsx-a11y/control-has-associated-label */
/* eslint-disable jsx-a11y/no-static-element-interactions */
/* eslint-disable jsx-a11y/click-events-have-key-events */
import * as React from 'react';
import { useEffect, useState } from 'react';
import * as ReactDOM from 'react-dom';
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en.json';

import LocalizedLabelsListView from './views/localizedlabelslist/LocalizedLabelsListView';
import FigmaUtil from '../shared/FigmaUtil';
import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import './ui.css';
import WindowManagerUi from '../lib/windowManager/WindowManagerUI';
import { WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import { TranslationKeys } from '../lib/keystore/TranslationKey';
import TranslationKeyListView from './views/translationkeys/TranslationKeyListView';

import MemoryTranslationKeyStore, { UITranslationKeys } from '../lib/keystore/MemoryTranslationKeyStore';
import { FigmaFileTranslationKeyStore } from '../lib/keystore/FigmaFileTranslationKeyStore';

import LocalizedLabelManager from '../lib/localizedlabels/LocalizedLabelManager';
import LocalizedLabelManagerUI from '../lib/localizedlabels/LocalizedLabelManagerUI';

import './tabbar.css';
import './assets/icons.css';
import SegmentedControl from './compontents/segmentedControl/SegmentedControl';
import Filesetup from './views/filesetup/Filesetup';
import Onboarding from './views/onboarding/Onboarding';
import { Language } from '../lib/base/Language';
import Tooltip from './compontents/tooltip/Tooltip';
import Import from './views/import/Import';
import Export from './views/export/Export';

TimeAgo.addDefaultLocale(en);


const monkeyPatchCommandExec = document.execCommand;
// eslint-disable-next-line func-names
document.execCommand = function() {
  // eslint-disable-next-line prefer-rest-params
  if (arguments[0] === 'undo' || arguments[0] === 'redo') {
    return false;
  }

  // eslint-disable-next-line prefer-rest-params
  if (arguments[0] === 'undoForce') {
    return monkeyPatchCommandExec.call(document, 'undo');
  }

  // eslint-disable-next-line prefer-rest-params
  if (arguments[0] === 'redoForce') {
    return monkeyPatchCommandExec.call(document, 'redo');
  }
  // eslint-disable-next-line prefer-rest-params
  return monkeyPatchCommandExec.apply(document, (arguments as any));
};

document.addEventListener('keydown', (e) => {
  // Handle Select All, Undo and Redo in the desktop app
  if (e.keyCode === 65 /* A */ && e.metaKey && !(e.target! as any).classList.contains('cm-content')) {
    document.execCommand('selectAll')
  } else if (e.keyCode === 90 /* Z */ && e.metaKey) {
    if (e.shiftKey) {
      document.execCommand('redoForce');
    } else {
      document.execCommand('undoForce');
    }
  }
}, true);


window.addEventListener('keydown', (e) => {
  if (e.key === 'z' && !e.shiftKey && !e.altKey && !(e.target! as any).classList.contains('cm-content')) {
    console.log('sending undo');
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
  document.getElementById('resize-handle')!,
);

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

  const [translatedKeys, setTranslatedKeys] = useState({} as UITranslationKeys);
  const [windowMode, setWindowMode] = useState(WindowManagerUi.instance!.windowMode);

  const [, setDefaultLinkStyle] = useState('' as string);

  const refreshTranslatedKeys = async () => {
    setTranslatedKeys(memoryTranslationKeyStore.translationKeys);
  };

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      // console.log('load - keys');
      await memoryTranslationKeyStore.load();
      localizedLabelManager.startFillupCache();

      setDefaultLinkStyle(await remoteLocalizedLabelManager.getLinkStyle());

      await refreshTranslatedKeys();
      let initialScreen = (await figmaRemote.getLocalFileConfig('lastView')) ?? 'design';
      if (localizedLabelManager.keyStore.config?.baseLanguage === undefined
        || localizedLabelManager.keyStore.config?.enabledLanguages === undefined) {
        initialScreen = 'onboarding';
      }
      setAppScreen(initialScreen);
    })();
  }, []);

  useEffect(() => {
    if (appScreen) {
      figmaRemote.setLocalFileConfig('lastView', appScreen);
    }
  }, [appScreen]);

  useEffect(() => {
    function windowModeUpdated() {
      setWindowMode(WindowManagerUi.instance!.windowMode);
    }

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    WindowManagerUi.instance!.addEventListener('changed', windowModeUpdated);

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    return () => {
      WindowManagerUi.instance!.removeEventListener('changed', windowModeUpdated);
    };
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
  }

  if (appScreen === 'keys') {
    view = (
      <TranslationKeyListView
        searchQuery={MemoryTranslationKeyStore.toQueryObject('')}
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
  } else if (appScreen === 'import') {
    view = (
      <Import
      figmaRemote={figmaRemote}
        labelManager={localizedLabelManager}
      />
    );
  /* (
      <ConfigView
        linkStyle={defaultLinkStyle}
        setLinkStyle={setLinkStyle}
        translationKeyStore={memoryTranslationKeyStore}
      />
    ); */
  } else if (appScreen === 'export') {
    view = (
      <Export
        translationKeyStore={memoryTranslationKeyStore}
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
        localizedLabelManager={localizedLabelManager}
        figmaRemote={figmaRemote}
      />
    );
  }

  return (

    <>
      <Tooltip triggerAttribute="data-tooltip-trigger" contentAttribute="data-tooltip-content" />
      <div className="toolbar">
        <div className="tabHeader">
          <div className={`tab ${appScreen === 'design' ? 'active' : ''}`} onClick={() => setAppScreen('design')}>Design</div>
          <div className={`tab ${appScreen === 'keys' ? 'active' : ''}`} onClick={() => setAppScreen('keys')}>Keys</div>
          <div className={`tab ${appScreen === 'export' ? 'active' : ''}`} onClick={() => setAppScreen('export')}>Versions & Export</div>
          <div className={`tab ${appScreen === 'import' ? 'active' : ''}`} onClick={() => setAppScreen('import')}>Import</div>
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
            selectedSegment={windowMode}
            onChoose={(choosenWindowMode: WindowMode) => { WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false); }}
          />

        </div>

      </div>

      <div className="view">
        {view}
      </div>
      <a id="focusHelper" href="" />

    </>
  );
}

ReactDOM.render(<App />, document.getElementById('react-page'));
