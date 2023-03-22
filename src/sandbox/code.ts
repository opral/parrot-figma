// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".

import { AsyncFunctionProxy } from '../lib/rpc/AsyncFunctionProxy';
import { FigmaFileTranslationKeyStore } from '../lib/keystore/FigmaFileTranslationKeyStore';
import FigmaUtil from '../shared/FigmaUtil';
import FigmaHelper from '../shared/FigmaHelper';
import { WindowManagerSandbox, WindowMode } from '../lib/windowManager/WindowManagerSandbox';
import LocalizedLabelManager from '../lib/localizedlabels/LocalizedLabelManager';

const figmaRemote = new FigmaUtil();

const fileConfigured = figma.root.getPluginData(FigmaFileTranslationKeyStore.languageConfigDataKey) !== '';
const introShownToUser = true; // TODO change this to a config when implemented

WindowManagerSandbox.init(800, 600, 300, WindowMode.Window, !introShownToUser || !fileConfigured);

const asyncFunctionProxy = new AsyncFunctionProxy('SandboxAsyncFunctionProxy', (data: any) => {
  figma.ui.postMessage(data);
}, figma.ui);

/*
let result = fetch('https://figma-assets-and-resources.loca.lt/api/v1/translate', {
  method: 'POST',
  headers: {
    'Authorization': 'DeepL-Auth-Key 391733de-67e0-be65-a8b7-4298511dd564:fx'
  },
  body: JSON.stringify({
    text: 'Hello world',
    target_lang: 'DE'
  }) }).then(result => {
  result.json().then(result => {
    console.log(result);
  })
}); */

asyncFunctionProxy.registerInstance(figmaRemote);

const localizationState = new FigmaFileTranslationKeyStore();
asyncFunctionProxy.registerInstance(localizationState);

const remoteLocalizedLabelManager = new LocalizedLabelManager(localizationState);
asyncFunctionProxy.registerInstance(remoteLocalizedLabelManager);

const figmaHelper = new FigmaHelper(figma, localizationState);
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
figma.ui.onmessage = () => {

  /* if (asyncFunctionProxy.onMessage(payload)) {
    return
  } */

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};
