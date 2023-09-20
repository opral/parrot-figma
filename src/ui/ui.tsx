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
import * as Sentry from '@sentry/react';
import { initializeSentry } from './utils/sentry';
import { initializeAnalytics, track, identify } from './utils/analytics';

import LocalizedLabelsListView from './views/localizedlabelslist/LocalizedLabelsListView';
import FigmaUtil from '../shared/FigmaUtil';
import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import './ui.css';
import WindowManagerUi from '../lib/windowManager/WindowManagerUI';
import { WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import { Messages } from '../lib/message/Message';
import MessageListView from './views/messages/MessageListView';

import MessageStoreMemory, { MessagesUI } from '../lib/message/store/MessageStoreMemory';
import { MessageStoreFigmaRoot } from '../lib/message/store/MessageStoreFigmaRoot';

import LocalizedLabelManager from '../lib/localizedlabels/LocalizedLabelManager';
import LocalizedLabelManagerUI from '../lib/localizedlabels/LocalizedLabelManagerUI';

import './tabbar.css';
import './assets/icons.css';
import SegmentedControl from './compontents/segmentedControl/SegmentedControl';
import Onboarding from './views/onboarding/Onboarding';
import { Locale } from '../lib/message/variants/Locale';
import Tooltip from './compontents/tooltip/Tooltip';

import Export from './views/export/Export';
import FEATURES_FLAGS from './featuretoggle';
import SetupView from './views/setup/SetupView';
import * as pjs from '../../package.json';

console.log(`Starting Figma UI - Version ${pjs.version}`);

TimeAgo.addDefaultLocale(en);

initializeSentry();

initializeAnalytics();

const monkeyPatchCommandExec = document.execCommand;
// eslint-disable-next-line func-names
document.execCommand = function () {
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
    document.execCommand('selectAll');
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
    // Undo the action in Figma
    const isMac = navigator.userAgent.indexOf('Macintosh') >= 0;
    const isCmd = isMac && e.metaKey && !e.ctrlKey;
    const isCtrl = !isMac && !e.metaKey && e.ctrlKey;
    if (isCmd || isCtrl) {
      window.parent.postMessage({ pluginMessage: { type: 'undo' } }, '*');
    }
  }
});

const resizeHandle = document.getElementById('resize-handle')!;

WindowManagerUi.init(
  document.getElementById('sizing-wrapper')!,
  document.getElementById('react-page')!,
  resizeHandle,
);

const asyncFunctionProxy = new AsyncFunctionProxy('UIAsyncFunctionProxy', (data: any) => {
  // eslint-disable-next-line no-restricted-globals
  parent.postMessage({
    pluginMessage: data,
  }, '*');
}, window);

const figmaRemote = new FigmaUtil();
asyncFunctionProxy.proxyAsyncMethods(figmaRemote);

figmaRemote.getUserId().then((userId) => {
  identify(userId!);
  if (userId) {
    Sentry.setUser({ id: userId! });
  }
});


const checkVersion = async () => {
  const minVersionRequest = await fetch('https://parrot-global.github.io/parrot/min-version.json', {
    cache: 'no-cache',
  });
  const { minVersion } = await minVersionRequest.json();
  const figVersion = Number.parseInt(pjs.version.split('.')[2], 10);
  console.log(`Current Version: ${figVersion} Minimum version ${minVersion}`);
  if (minVersion > figVersion) {
    if (document.getElementById('version-outdated')) {
      document.getElementById('version-outdated')!.classList.remove('gone');
      document.getElementById('version-outdated')!.classList.add('visible');
    }
  }
};

const versionCheckInterval = 1000 * 40;
// we use any here since NodeJS.Timout - the suggested type by the ide is not correct
checkVersion().catch(console.log);
setInterval(() => {
  checkVersion().catch(console.log);
}, versionCheckInterval);

const figmaFileTranslationKeyStore = new MessageStoreFigmaRoot(true);

asyncFunctionProxy.proxyAsyncMethods(figmaFileTranslationKeyStore);
const memoryTranslationKeyStore = new MessageStoreMemory(figmaFileTranslationKeyStore);

const remoteLocalizedLabelManager = new LocalizedLabelManager(undefined);
asyncFunctionProxy.proxyAsyncMethods(remoteLocalizedLabelManager);
const localizedLabelManager = new LocalizedLabelManagerUI(remoteLocalizedLabelManager, memoryTranslationKeyStore);

function App() {
  // initial app screen is startup until we initialy loaded the data
  const [appScreen, setAppScreen] = useState(undefined as String | undefined);

  const [windowMode, setWindowMode] = useState(WindowManagerUi.instance!.windowMode);
  const [keyQuery, setKeyQuery] = useState(MessageStoreMemory.toQueryObject(''));

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      await localizedLabelManager.prepare();
      // console.log('load - messages');
      await memoryTranslationKeyStore.load();
      localizedLabelManager.startFillupCache();
      const fileSetupCompleted = await figmaRemote.getRootPluginData('fileSetupCompleted');

      let initialScreen = (await figmaRemote.getLocalFileConfig('lastView')) ?? 'design';
      if (fileSetupCompleted === undefined || fileSetupCompleted === '') {
        initialScreen = 'onboarding';
      }
      setAppScreen(initialScreen);
    })();
  }, []);

  useEffect(() => {
    if (appScreen) {
      track(`app_screen__${appScreen}`);
      figmaRemote.setLocalFileConfig('lastView', appScreen);
    }
  }, [appScreen]);

  useEffect(() => {
    function windowModeUpdated() {
      setWindowMode(WindowManagerUi.instance!.windowMode);
    }

    WindowManagerUi.instance!.addEventListener('changed', windowModeUpdated);

    return () => {
      WindowManagerUi.instance!.removeEventListener('changed', windowModeUpdated);
    };
  }, []);

  if (!appScreen) {
    return <>Loading Plugin</>;
  }

  let view;

  if (windowMode === WindowMode.DevPanel) {
    return (
      <>
        <Tooltip contentAttribute="data-tooltip-content" />
        <div className="view dev-panel">
          <div className="comming-soon">
            Parrot´s Dev Mode version is comming soon...
            {' '}
            <br />
            <br />
            Translate your Designs with Parrot in Design Mode in the meantime!
            <br />
            <br />
            🦜
          </div>

        </div>
      </>
    );
  }

  if (windowMode === WindowMode.Minimized) {
    return (
      <>
        <Tooltip contentAttribute="data-tooltip-content" />
        <div className="toolbar">
          <select>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
            <option>test</option>
          </select>

          <div className="window-control">
            <SegmentedControl
              segments={[{
                iconName: 'window-mode-window-svg',
                value: WindowMode.Window,
                tooltip: 'Window Mode',
              }]}
              selectedSegment={windowMode}
              onChoose={(choosenWindowMode: WindowMode) => { WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false); }}
            />

          </div>

        </div>
      </>
    );
  }

  switch (appScreen) {
    case 'onboarding':
      return (
        <>
          <Tooltip contentAttribute="data-tooltip-content" />
          <Onboarding
            labelManager={localizedLabelManager}
            onFinishSetup={async () => {
              await figmaRemote.setRootPluginData('fileSetupCompleted', 'true');
              WindowManagerUi.instance?.requestWindowMode(WindowMode.BottomSheet, false);
              setAppScreen('design');
            }}
          />
        </>
      );
    case 'messages':
      view = (
        <MessageListView
          showSearchBar={false}
          initialSearchQuery={keyQuery}
          messageStore={memoryTranslationKeyStore}
          localizedLabelManager={localizedLabelManager}
          figmaRemote={figmaRemote}
          highlightSelectedNodes
        />
      );
      break;
    case 'settings':
      view = (
        <SetupView labelManager={localizedLabelManager} />
      );
      break;

    case 'export':
      view = (
        <Export
          labelManager={localizedLabelManager}
        />
      );
      break;
    case 'design':
      view = (
        <LocalizedLabelsListView
          showMessage={(messageName: string) => {
            setKeyQuery(MessageStoreMemory.toQueryObject(`name:${messageName}`));
            setAppScreen('messages');
          }}
          localizedLabelManager={localizedLabelManager}
          figmaRemote={figmaRemote}
        />
      );
      break;
    default:
      break;
  }

  return (

    <>
      <Tooltip contentAttribute="data-tooltip-content" />
      <div className="toolbar">
        <div className="tabHeader">
          <div className={`tab ${appScreen === 'design' ? 'active' : ''}`} onClick={() => setAppScreen('design')}>Design</div>
          <div
            className={`tab ${appScreen === 'messages' ? 'active' : ''}`}
            onClick={() => {
              setKeyQuery(MessageStoreMemory.toQueryObject(''));
              setAppScreen('messages');
            }}
          >
            Messages
          </div>
          { FEATURES_FLAGS.export && (<div className={`tab ${appScreen === 'export' ? 'active' : ''}`} onClick={() => setAppScreen('export')}>{ FEATURES_FLAGS.versioning ? 'Versions & Export' : 'Export'}</div>)}
          <div className={`tab ${appScreen === 'settings' ? 'active' : ''}`} onClick={() => setAppScreen('settings')}>Setup</div>
        </div>
        { windowMode === WindowMode.BottomSheet && (
          <div
            className="toolbar-resize-handle"
            style={{ flexGrow: 1 }}
            onPointerDown={(event) => {
              event.preventDefault(); // Prevent the default behavior
              event.stopPropagation(); // Stop event bubbling
              resizeHandle.dispatchEvent(new PointerEvent('pointerdown', event as any));
            }}
            onPointerUp={(event) => {
              event.preventDefault(); // Prevent the default behavior
              event.stopPropagation(); // Stop event bubbling
              resizeHandle.dispatchEvent(new PointerEvent('onpointerup', event as any));
            }}
            onMouseEnter={(event) => {
              event.preventDefault(); // Prevent the default behavior
              event.stopPropagation(); // Stop event bubbling
              resizeHandle.dispatchEvent(new PointerEvent('mouseenter', event as any));
            }}
          />
        )}

        <div className="window-control">
          <SegmentedControl
            segments={[/* {
              iconName: 'window-mode-minimized-svg',
              value: WindowMode.Minimized,
              tooltip: 'Minimize',
            }, */ {
                iconName: 'window-mode-bottom-attached-svg',
                value: WindowMode.BottomSheet,
                tooltip: 'Dock to bottom',
              }, {
                iconName: 'window-mode-window-svg',
                value: WindowMode.Window,
                tooltip: 'Use as Window',
              }, {
                iconName: 'window-mode-fullscreen-svg',
                value: WindowMode.Fullscreen,
                tooltip: 'Switch to Fullscreen',
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
