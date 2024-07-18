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
import * as mixpanel from 'mixpanel-figma';

import { initializeSentry } from './utils/sentry';
import {
  initializeAnalytics,
  track,
  identify,
  identifyProject,
  captureLoadProjectEvent,
} from './utils/analytics';

import LocalizedLabelsListView from './views/localizedlabelslist/LocalizedLabelsListView';
import FigmaUtil from '../shared/FigmaUtil';
import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import './ui.css';
import WindowManagerUi from '../lib/windowManager/WindowManagerUI';
import { WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import MessageListView from './views/messages/MessageListView';
import MessageStoreMemory from '../lib/message/store/MessageStoreMemory';

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
import UserManager, { PluginUser, UserFileRole } from '../lib/usage/UsageManager';
import UserManagerUI from '../lib/usage/UsageManagerUI';
import UserManagement from './views/usermanagement/Usermanagement';
import Drawer from './compontents/drawer/Drawer';

import ComparisonChart from './compontents/plans/ComparisonChart';
import { InlangMessageStore } from '../lib/message/store/InlangMessageStoreFigmaRoot';
import 'overlayscrollbars/overlayscrollbars.css';
import { OverlayScrollbarsComponent } from './compontents/overlayscrollbar';
import TranslatorMachine from '../lib/translationprovider/TranslatorMachine';
import MessageUpsellOverlay from './compontents/upselloverlay/MessageUpsellOverlay';
import MessagesConsumptionPaywall from './compontents/plans/MessagesConsumptionPaywall';
import TextField from './compontents/textfield/TextField';
import Monitoring from '../lib/monitoring/MonitoringProxy';
import FeatureFlags from '../lib/featureflags/FeatureFlags';
import { TranslationCredit } from '../lib/api/Parrot';

console.log(`Starting Figma UI - Version ${pjs.version}`);

TimeAgo.addDefaultLocale(en);

initializeSentry();

initializeAnalytics();

const monkeyPatchCommandExec = document.execCommand;
// eslint-disable-next-line func-names
document.execCommand = function () {
  // eslint-disable-next-line prefer-rest-params
  if (arguments[0] === 'undo' || arguments[0] === 'redo') {
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
  return monkeyPatchCommandExec.apply(document, arguments as any);
};

document.addEventListener(
  'keydown',
  (e) => {
    // Handle Select All, Undo and Redo in the desktop app
    if (
      e.keyCode === 65
      && /* A */ e.metaKey
      && !(e.target! as any).classList.contains('cm-content')
    ) {
      document.execCommand('selectAll');
    } else if (e.keyCode === 90 /* Z */ && e.metaKey) {
      if (e.shiftKey) {
        document.execCommand('redoForce');
      } else {
        document.execCommand('undoForce');
      }
    }
  },
  true,
);

window.addEventListener('keydown', (e) => {
  if (
    e.key === 'z'
    && !e.shiftKey
    && !e.altKey
    && !(e.target! as any).classList.contains('cm-content')
  ) {
    // Undo the action in Figma
    const isMac = navigator.userAgent.indexOf('Macintosh') >= 0;
    const isCmd = isMac && e.metaKey && !e.ctrlKey;
    const isCtrl = !isMac && !e.metaKey && e.ctrlKey;
    if (isCmd || isCtrl) {
      window.parent.postMessage({ pluginMessage: { type: 'undo' }, pluginId: '*' }, '*');
    }
  }
});

const resizeHandle = document.getElementById('resize-handle')!;
const resizeHeightHandle = document.getElementById('height-resize-handle')!;

WindowManagerUi.init(
  document.getElementById('sizing-wrapper')!,
  document.getElementById('react-page')!,
  resizeHandle,
  resizeHeightHandle,
  'toolbar-resize-handle',
);
// @ts-expect-error
window.startDevMode = WindowManagerUi.instance!.startDevMode;

const asyncFunctionProxy = new AsyncFunctionProxy(
  'UIAsyncFunctionProxy',
  (data: any) => {
    // eslint-disable-next-line no-restricted-globals
    parent.postMessage(
      {
        pluginMessage: data,
        pluginId: '*',
      },
      '*',
    );
  },
  window,
);

const monitoring = new Monitoring(Sentry, mixpanel);
asyncFunctionProxy.registerInstance(monitoring);

const figmaRemote = new FigmaUtil();
asyncFunctionProxy.proxyAsyncMethods(figmaRemote);

(async () => {
  // reportUnreportedMigrationReports
  const reports = await figmaRemote.getReportsAsync();
  for (const report of Object.values(reports)) {
    if (!report.reportedToSentry) {
      console.log(`reporting: Migration version: ${report.version} - ${report.message}`);
      Sentry.captureException(
        new Error(`Migration version: ${report.version} - ${report.message}`),
      );
      report.reportedToSentry = true;
      // eslint-disable-next-line no-await-in-loop
      await figmaRemote.updateReport(report);
    }
  }
})();

figmaRemote.getFeatureFlags().then((featureFlags) => {
  FeatureFlags.setFeatureflags(featureFlags);
});

figmaRemote.getUserId().then((userId) => {
  identify(userId!);
  if (userId) {
    Sentry.setUser({ id: userId! });
  }
});

Promise.all([figmaRemote.getInlangFileId()]).then(([fileId]) => {
  if (fileId) {
    track('file opened', { fileId });
    identifyProject({ projectId: fileId, properties: { name: fileId }, figmaRemote });
  }
});

const translationMachine = new TranslatorMachine();
asyncFunctionProxy.proxyAsyncMethods(translationMachine);

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

const userStateManagerSandbox = new UserManager(true);
asyncFunctionProxy.proxyAsyncMethods(userStateManagerSandbox);
const userStateManagerUi = new UserManagerUI(userStateManagerSandbox);
const figmaFileTranslationKeyStore = new InlangMessageStore(true);

asyncFunctionProxy.proxyAsyncMethods(figmaFileTranslationKeyStore);
const memoryTranslationKeyStore = new MessageStoreMemory(figmaFileTranslationKeyStore, figmaRemote);

const remoteLocalizedLabelManager = new LocalizedLabelManager();
asyncFunctionProxy.proxyAsyncMethods(remoteLocalizedLabelManager);
const localizedLabelManager = new LocalizedLabelManagerUI(
  remoteLocalizedLabelManager,
  memoryTranslationKeyStore,
);

enum LicenseState {
  unvalidated,
  validating,
  valid,
  activatedAlready,
  used,
  invalid,
}

function App() {
  // initial app screen is startup until we initialy loaded the data
  const [appScreen, setAppScreen] = useState(undefined as String | undefined);
  const [consumptionPayWallFeature, setCunsumptionPayWallFeature] = useState(
    undefined as String | undefined,
  );

  const [enteredLicenseKey, setEnteredLicenseKey] = useState(undefined as string | undefined);

  const [didntbuyReason, setDidntBuyReason] = useState(undefined as string | undefined);

  const [refillClicked, setRefillClicked] = useState(false);

  const [licenseKeyState, setLicenseKeyState] = useState<LicenseState>(LicenseState.unvalidated);
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  const [user, setUser] = useState(undefined as PluginUser | undefined);

  const [windowMode, setWindowMode] = useState(WindowManagerUi.instance!.windowMode);
  const [keyQuery, setKeyQuery] = useState(MessageStoreMemory.toQueryObject(''));

  const [boughtCredit, setBoughtCredit] = useState(true);

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      await userStateManagerUi.loadUserState();
      userStateManagerUi.trackFileUsageStatistics();

      if (FeatureFlags.features.payment) {
        const state = TranslatorMachine.instance.getCreditStateAsync();
        setBoughtCredit((await state).credits.length > 1);
      }

      if (windowMode === WindowMode.DevPanel) {
        const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.developer);
        setUser(updatedUser);
      } else {
        const updatedUser = await userStateManagerUi.requestUserRole(UserFileRole.designer);
        setUser(updatedUser);
      }
    })();

    const onUsersUpdated = (event: any) => {
      console.log('onUsersUpdated');
    };

    const onCurrentUserUpdated = (event: any) => {
      setUser(userStateManagerUi.getCurrentUser());
    };

    const onPlanUpgradeNeeded = (event: any) => {
      setCunsumptionPayWallFeature(event.detail as String);
    };

    userStateManagerUi.addEventListener('planUpgradeNeeded', onPlanUpgradeNeeded);
    userStateManagerUi.addEventListener('usersUpdated', onUsersUpdated);
    userStateManagerUi.addEventListener('currentUserUpdated', onCurrentUserUpdated);
    return () => {
      userStateManagerUi.removeEventListener('usersUpdated', onUsersUpdated);
      userStateManagerUi.removeEventListener('currentUserUpdated', onCurrentUserUpdated);
      userStateManagerUi.removeEventListener('planUpgradeNeeded', onPlanUpgradeNeeded);
    };
  }, []);

  useEffect(() => {
    const creditUpdateHandler = (event: MessageEvent) => {
      if (event.data.pluginMessage.target === 'TranslatorMachine') {
        if (event.data.pluginMessage.type === 'creditUpdate') {
          if (event.data.pluginMessage.requestShowUpsellCTA) {
            setCunsumptionPayWallFeature('message');
          }

          const state = event.data.pluginMessage.data as {
            credits: TranslationCredit[],
            availableMessages: number,
          };

          const usageSum = state.credits.reduce((acc, obj) => acc + obj.msgu, 0);
          const creditTypes = state.credits.map((credit) => credit.ct);
          Monitoring.instance?.mixpanel_people_set('translationsUsed', usageSum);
          Monitoring.instance?.mixpanel_people_set('translationsAvailable', state.availableMessages);
          for (const creditType of creditTypes) {
            Monitoring.instance?.mixpanel_people_set(`creditType_${creditType}`, true);
          }
        }
      }
    };

    window.addEventListener('message', creditUpdateHandler);
    // TODO listen to events from translatorMachine

    return () => {
      window.removeEventListener('message', creditUpdateHandler);
    };
  }, []);

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      console.log('load - keys');

      const fileSetupCompleted = await figmaRemote.getRootPluginData('fileSetupCompleted');

      await localizedLabelManager.prepare();
      await memoryTranslationKeyStore.load();
      localizedLabelManager.startFillupCache().then(() => {
        captureLoadProjectEvent(figmaRemote);
      });

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

  if (!appScreen || !user) {
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

  if (user.userRole !== UserFileRole.designer && user.userRole !== UserFileRole.owner) {
    return (
      <>
        Not the permission to view
        {' '}
        {user.openUserRoleRequest !== undefined ? `${user.openUserRoleRequest} requested` : ' -'}
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
              segments={[
                {
                  iconName: 'window-mode-window-svg',
                  value: WindowMode.Window,
                  tooltip: 'Window Mode',
                },
              ]}
              selectedSegment={windowMode}
              onChoose={(choosenWindowMode: WindowMode) => {
                WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false);
              }}
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
              WindowManagerUi.instance?.requestWindowMode(WindowMode.Window, false);
              await memoryTranslationKeyStore.load();
              setAppScreen('design');
            }}
          />
        </>
      );
    case 'messages':
      view = (
        <>
          <MessageListView
            showSearchBar={false}
            initialSearchQuery={keyQuery}
            messageStore={memoryTranslationKeyStore}
            localizedLabelManager={localizedLabelManager}
            figmaRemote={figmaRemote}
            highlightSelectedNodes
          />
          { FeatureFlags.features.payment
           && (
           <MessageUpsellOverlay
             hideInfo
             onclick={() => {
               setCunsumptionPayWallFeature('test');
             }}
           />
           )}
        </>

      );
      break;
    case 'settings':
      view = (
        <>
          <SetupView labelManager={localizedLabelManager} />
          { FeatureFlags.features.payment
          && (
          <MessageUpsellOverlay
            hideInfo={false}
            onclick={() => {
              setCunsumptionPayWallFeature('test');
            }}
          />
          )}
        </>
      );
      break;

    case 'export':
      view = <Export userManager={userStateManagerUi} labelManager={localizedLabelManager} />;
      break;
    case 'design':
      view = (
        <>
          <LocalizedLabelsListView
            showMessage={(messageName: string) => {
              setKeyQuery(MessageStoreMemory.toQueryObject(`name:${messageName}`));
              setAppScreen('messages');
            }}
            localizedLabelManager={localizedLabelManager}
            figmaRemote={figmaRemote}
          />
          { FeatureFlags.features.payment
          && (
          <MessageUpsellOverlay
            hideInfo
            onclick={() => {
              setCunsumptionPayWallFeature('test');
            }}
          />
          )}
        </>

      );
      break;
    case 'users':
      view = <UserManagement userManager={userStateManagerUi} />;
      break;
    default:
      break;
  }

  return (
    <>
      <Tooltip contentAttribute="data-tooltip-content" />
      { !boughtCredit && (
      <div className="discountBanner">
        <span onClick={() => { Monitoring.instance?.mixpanel_track('consumptionDiscountClicked'); setCunsumptionPayWallFeature('.'); return false; }}>🎉🎉🎉 Unlock a 40% discount on additional
        translations
        
        until the end of February with the exclusive code: </span> EARLYPARROT 🎉🎉🎉
      </div>
      )}
      <div className="toolbar">
        <div className="tabHeader">
          <div
            className={`tab ${appScreen === 'design' ? 'active' : ''}`}
            onClick={() => setAppScreen('design')}
          >
            Layers
          </div>
          <div
            className={`tab ${appScreen === 'messages' ? 'active' : ''}`}
            onClick={() => {
              setKeyQuery(MessageStoreMemory.toQueryObject(''));
              setAppScreen('messages');
            }}
          >
            Messages
          </div>
          {FEATURES_FLAGS.export && (
            <div
              className={`tab ${appScreen === 'export' ? 'active' : ''}`}
              onClick={() => setAppScreen('export')}
            >
              {FEATURES_FLAGS.versioning ? 'Versions & Export' : 'Export'}
            </div>
          )}
          <div
            className={`tab ${appScreen === 'settings' ? 'active' : ''}`}
            onClick={() => setAppScreen('settings')}
          >
            Setup
          </div>
          {/* <div className={`tab ${appScreen === 'users' ? 'active' : ''}`} onClick={() => setAppScreen('users')}>Users</div> */}
        </div>

        <div
          id="toolbar-resize-handle"
          className="toolbar-resize-handle"
          style={{
            pointerEvents: 'none',
            flexGrow: 1,
            display: 'none',
          }}
        >
          <div className="svg-container resize-height" />
        </div>

        <div className="window-control">
          <SegmentedControl
            segments={[
              /* {
              iconName: 'window-mode-minimized-svg',
              value: WindowMode.Minimized,
              tooltip: 'Minimize',
            }, *//* {
                iconName: 'window-mode-bottom-attached-svg',
                value: WindowMode.BottomSheet,
                tooltip: 'Dock to bottom',
              }, */
              {
                iconName: 'window-mode-window-svg',
                value: WindowMode.Window,
                tooltip: 'Use as Window',
              },
              {
                iconName: 'window-mode-fullscreen-svg',
                value: WindowMode.Fullscreen,
                tooltip: 'Switch to Fullscreen',
              },
            ]}
            selectedSegment={windowMode}
            onChoose={(choosenWindowMode: WindowMode) => {
              WindowManagerUi.instance?.requestWindowMode(choosenWindowMode, false);
            }}
          />
        </div>
      </div>
      <OverlayScrollbarsComponent
        className="view"
        options={{
          showNativeOverlaidScrollbars: true,
          scrollbars: {
            clickScroll: true,
          },
        }}
        defer
      >
        {view}
      </OverlayScrollbarsComponent>
      <a id="focusHelper" href="" />
      <Drawer
        position="top"
        shown={didntbuyReason !== undefined}
        buttons={[
          {
            type: 'primary',
            text: 'Submit feedback',
            key: undefined,
            disabled: (didntbuyReason !== undefined && didntbuyReason.length < 1),
            callback: () => {
              const reason = didntbuyReason;
              Monitoring.instance?.mixpanel_people_set('didntRefillReason', reason);
              setDidntBuyReason(undefined);
              figmaRemote.notify('Thank you for your feedback!');
            },
          },
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              setDidntBuyReason(undefined);
            },
          },
        ]}
      >
        <>
          <div className="modal-dialog-title-bar">
            <div className="modal-dialog-title-text">Refill Purchase Feedback</div>
            <div
              className="modal-dialog-title-close button"
              onClick={() => {
                setEnteredLicenseKey(undefined);
              }}
            />
          </div>
          <div className="modal-dialog-body refill-feedback">
            <div className="modal-dialog-text ">Could you please share any specific reasons or concerns that influenced your decision not to purchase a refill?</div>
            <textarea
              rows={5}
              cols={35}
              wrap="off"
              maxLength={400}
              value={didntbuyReason}
              onChange={(e) => { setDidntBuyReason(e.target.value); }}
              placeholder="Add your feedback"
            />

          </div>

        </>
      </Drawer>

      <Drawer
        position="top"
        shown={enteredLicenseKey !== undefined}
        buttons={[
          {
            type: 'secondary',
            text: 'Cancel',
            key: 'escape',
            callback: () => {
              if (refillClicked) {
                setDidntBuyReason('');
                Monitoring.instance?.mixpanel_track('consumptionPaywallTranslationsDidntBuy');
              }
              setEnteredLicenseKey(undefined);
              setLicenseKeyState(LicenseState.unvalidated);
            },
          },
          {
            type: 'primary',
            text: licenseKeyState === LicenseState.validating ? 'Validating...' : 'Use License Key',
            key: 'enter',
            disabled: (enteredLicenseKey !== undefined && enteredLicenseKey.length < 10) || licenseKeyState === LicenseState.validating || licenseKeyState === LicenseState.invalid,
            callback: () => {
              Monitoring.instance?.mixpanel_track('activateLicenseClicked');

              // setEnteredLicenseKey(undefined);
              setLicenseKeyState(LicenseState.validating);
              // call backend
              translationMachine.activateLicenseAsync(enteredLicenseKey!).then((result) => {
                if (result.activated || result.success) {
                  // {activated: true, error: null, license_key: {…}, instance: {…}, meta: {…}}
                  if (result.activated) {
                    figmaRemote.notify('🎉🎉 Licence Key was activated 🎉🎉');

                    Monitoring.instance?.mixpanel_track('licenseActivated');
                    translationMachine.syncTranslations().then(() => {
                      setLicenseKeyState(LicenseState.valid);
                      setEnteredLicenseKey(undefined);
                    });
                  } else {
                    figmaRemote.notify('Licence Key is active already');
                    setLicenseKeyState(LicenseState.valid);
                    setEnteredLicenseKey(undefined);
                  }
                } else if (result.error) {
                  // currently only
                  setLicenseKeyState(LicenseState.invalid);
                  figmaRemote.notifyError('License key not accepted.');
                  Sentry.captureException(new Error(result.error));
                }
              }).catch((e) => {
                setLicenseKeyState(LicenseState.unvalidated);
                figmaRemote.notifyError('Networking issue. Couldn\'t validate the license key.');
                Sentry.captureException(e);
              });
            },
          },
        ]}
      >
        <>
          <div className="modal-dialog-title-bar">
            <div className="modal-dialog-title-text">Activate your License</div>
            <div
              className="modal-dialog-title-close button"
              onClick={() => {
                setEnteredLicenseKey(undefined);
              }}
            >
              <div className="svg-container cross-svg" />
            </div>
          </div>
          <div className="modal-dialog-body">
            <div className="modal-dialog-text">Enter your License Key:</div>
            <TextField
              singleClick
              onSave={() => {}}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXXX"
              onChange={(value: string) => {
                setLicenseKeyState(LicenseState.unvalidated);
                setEnteredLicenseKey(value);
              }}
              text={enteredLicenseKey || ''}
            />
            <div className="modal-dialog-error-text">
              {licenseKeyState === LicenseState.used && '* License Key in use'}
              {licenseKeyState === LicenseState.invalid && '* Not valid'}
            </div>
          </div>

        </>
      </Drawer>

      <Drawer
        shown={consumptionPayWallFeature !== undefined}
        beforeShow={async () => {
          Monitoring.instance?.mixpanel_track('consumptionPaywallTranslationsShown');
          const waitOneFrame = () => new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 30);
          });
          WindowManagerUi.instance?.requestWindowMode(WindowMode.Fullscreen, false);
          return waitOneFrame();
        }}
        buttons={[]}
        onCancel={() => {
          setCunsumptionPayWallFeature(undefined);
        }}
        position="top"
      >
        <MessagesConsumptionPaywall
          closeClick={() => {
            setCunsumptionPayWallFeature(undefined);
            setRefillClicked(false);
          }}
          buyClick={() => {
            Monitoring.instance?.mixpanel_track('consumptionPaywallTranslationsCheckoutClicked');
            window.open('https://parrot.lemonsqueezy.com/checkout/buy/9a667dcf-2039-462b-8809-5fd977859fee', 'blank');
            setCunsumptionPayWallFeature(undefined);
            setEnteredLicenseKey('');
            setRefillClicked(true);
          }}
          gotLicencesClick={() => {
            setCunsumptionPayWallFeature(undefined);
            setEnteredLicenseKey('');
            setRefillClicked(false);
          }}
        />
      </Drawer>
      <Drawer
        shown={showAllFeatures}
        beforeShow={async () => {
          const waitOneFrame = () => new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 30);
          });
          WindowManagerUi.instance?.requestWindowMode(WindowMode.Fullscreen, false);
          return waitOneFrame();
        }}
        buttons={[]}
        onCancel={() => {
          setShowAllFeatures(false);
        }}
        position="top"
      >
        <ComparisonChart
          upgradePlan={() => {
            setCunsumptionPayWallFeature(undefined);
            // upgradePlan();
          }}
        />
      </Drawer>

      {/* <Drawer
        shown={showUpgradePlan}
        beforeShow={async () => {
          const waitOneFrame = () => new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 30);
          });
          WindowManagerUi.instance?.requestWindowMode(WindowMode.Fullscreen, false);
          return waitOneFrame();
        }}
        buttons={[]}
        position="top"
      >
        <ConsumptionPaywall showAllFeatures={() => {}} upgradePlan={() => {}}/>

      </Drawer> */}

      {/* <Drawer
        shown={showThanksForYourSupport}
        beforeShow={async () => {
          const waitOneFrame = () => new Promise<void>((resolve) => {
            setTimeout(() => {
              resolve();
            }, 30);
          });
          WindowManagerUi.instance?.requestWindowMode(WindowMode.Fullscreen, false);
          return waitOneFrame();
        }}
        buttons={[]}
        position="top"
      >
        <div>Thanks for your support!</div>

      </Drawer> */}
    </>
  );
}

ReactDOM.render(<App />, document.getElementById('react-page'));
