/* eslint-disable no-await-in-loop */
// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".

// import { createNodeishMemoryFs } from '@lix-js/fs';
import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import MigrationManager from '../lib/migrations/MigrationManager';

import FigmaUtil from '../shared/FigmaUtil';
import FigmaHelper from '../shared/FigmaHelper';
import { WindowManagerSandbox, WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import LocalizedLabelManager from '../lib/localizedlabels/LocalizedLabelManager'; // TODO change this to a config when implemented
import { InlangMessageStore } from '../lib/message/store/MessageStoreFigmaRoot';
import FigmaFsSandbox from '../lib/figmafs/FigmaFsSandbox';
import UserManager from '../lib/usage/UsageManager';

const figmaRemote = new FigmaUtil();

const fileConfigured = figmaRemote.getRootPluginDataSync('fileSetupCompleted') !== '';
const introShownToUser = true;

figma.root.setRelaunchData({ open: 'Let Your Design Speak all Languages' });

const migrationManager = new MigrationManager(figmaRemote);
migrationManager.migrate();

WindowManagerSandbox.init({
  bottomSheet: {
    height: 200,
  },
  introWindowSize: {
    centerHeight: 488,
    height: 364,
    width: 415,
  },
  windowSize: {
    width: 800,
    height: 600,
  },
  windowMode: WindowMode.IntroWindow,
}, (!fileConfigured || !introShownToUser) ? WindowMode.IntroWindow : undefined);

const asyncFunctionProxy = new AsyncFunctionProxy('SandboxAsyncFunctionProxy', (data: any) => {
  figma.ui.postMessage(data);
}, figma.ui);

asyncFunctionProxy.registerInstance(figmaRemote);

const usageManager = new UserManager(false);
asyncFunctionProxy.registerInstance(usageManager);

const inlangMessageStore = new InlangMessageStore(false);
asyncFunctionProxy.registerInstance(inlangMessageStore);

const remoteLocalizedLabelManager = new LocalizedLabelManager(inlangMessageStore);
asyncFunctionProxy.registerInstance(remoteLocalizedLabelManager);

const figmaFs = new FigmaFsSandbox(false);
/*new DelegatingFs([
  { path: '/.git', fs: createNodeishMemoryFs() },
  { path: '/', fs: new FigmaFsSandbox(false) },
]);*/
asyncFunctionProxy.registerInstance(figmaFs);

const startWatching = async () => {
  try {
    const watcher = figmaFs.watch('.', {
      // TODO #1844  - check who would signal here -
      // signal: abortController.signal,
      persistent: false,
      recursive: true,
    });
    if (watcher) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const event of watcher) {
        if (!event.filename) {
          throw new Error('filename not set in event...');
        }
        figma.ui.postMessage({
          target: 'FigmaFsUI',
          type: 'changeEvent',
          event,
        });
      }
    }
  } catch (err: any) {
    if (err.name === 'AbortError') return;
    // https://github.com/inlang/monorepo/issues/1647
    // the file does not exist (yet)
    // this is not testable beacause the fs.watch api differs
    // from node and lix. lenghty
    if (err.code === 'ENOENT') return;
    throw err;
  }
};

startWatching();

const figmaHelper = new FigmaHelper(figma);
asyncFunctionProxy.registerInstance(figmaHelper);

figma.on('selectionchange', () => {
  figma.ui.postMessage(
    {
      type: 'event',
      name: 'selectionchange',
    },
  );
});

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = (msg) => {
  // eslint-disable-next-line default-case
  switch (msg.type) {
    case 'undo':
      console.log('undo forwarded');
      figma.triggerUndo();
      break;
  }
  /* if (asyncFunctionProxy.onMessage(payload)) {
    return
  } */

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
