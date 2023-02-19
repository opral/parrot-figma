// This plugin will open a window to prompt the user to enter a number, and
// it will then create that many rectangles on the screen.

// This file holds the main code for the plugins. It has access to the *document*.
// You can access browser APIs in the <script> tag inside "ui.html" which has a
// full browser environment (see documentation).

// This shows the HTML page in "ui.html".

let height = 200;
let widht = 800;


import { AsyncFunctionProxy } from "../lib/rpc/AsyncFunctionProxy";
import { FigmaFileKeyStore } from "../lib/keystore/FigmaFileTranslationKeyStore"
import { FigmaUtil } from "../shared/FigmaUtil"
import FigmaHelper from "../shared/FigmaHelper";
import { WindowManagerSandbox, WindowMode } from "../lib/windowManager/WindowManagerSandbox";


let figmaRemote = new FigmaUtil();

WindowManagerSandbox.init(200, 800, 300, WindowMode.BottomSheet);

let asyncFunctionProxy = new AsyncFunctionProxy('SandboxAsyncFunctionProxy', (data: any) => {
  figma.ui.postMessage( data )
}, figma.ui);

asyncFunctionProxy.registerInstance(figmaRemote);

const figmaHelper = new FigmaHelper(figma);
asyncFunctionProxy.registerInstance(figmaHelper);

let localizationState = new FigmaFileKeyStore()

export interface TranslatableTextNodeWrapper {
  key: string,
  node: TextNode
}

figma.on("selectionchange", () => {
  figma.ui.postMessage(
    {
      type: 'event',
      name: 'selectionchange'
    });
})

// Calls to "parent.postMessage" from within the HTML page will trigger this
// callback. The callback will be passed the "pluginMessage" property of the
// posted message.
figma.ui.onmessage = payload => {

  /*if (asyncFunctionProxy.onMessage(payload)) {
    return
  }*/

  // Make sure to close the plugin when you're done. Otherwise the plugin will
  // keep running, which shows the cancel button at the bottom of the screen.
  // figma.closePlugin();
};