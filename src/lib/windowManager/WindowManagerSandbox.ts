import { FigmaFileTranslationKeyStore } from '../keystore/FigmaFileTranslationKeyStore';

const titleBarHeight = 40;

export enum WindowMode {
  Window = 'window',
  BottomSheet = 'bottomSheet',
  Fullscreen = 'fullscreen',
}

export class WindowManagerSandbox {
  public proxClassName = 'LocalizedLabelManager';

  windowMode: WindowMode;

  size: any;

  bottomSheetHeight = 300;

  viewportResizeCheckInterval: any;

  handledViewportWidth = -1;

  handledViewportHeight = -1;

  viewPortResizing = false;

  windowResizing = false;

  settleTime = 500;

  viewPortResizeSettleTimeout: any;

  windowResizeSettleTimeout: any;

  currentMode: WindowMode | undefined;

  static instance: WindowManagerSandbox | undefined;

  static init(initalWidth: number, initialHeight: number, initialBottomSheetHeight: number, initalWindowMode: WindowMode, enforceInitialConfig: boolean) {
    if (this.instance) {
      throw new Error('init called twice');
    }

    this.instance = new WindowManagerSandbox(initalWidth, initialHeight, initialBottomSheetHeight, initalWindowMode, enforceInitialConfig);
  }

  private constructor(initalWidth: number, initialHeight: number, initialBottomSheetHeight: number, initalWindowMode: WindowMode, enforceInitialConfig: boolean) {
    this.bottomSheetHeight = initialBottomSheetHeight;
    this.windowMode = initalWindowMode;

    this.size = {
      width: initalWidth,
      height: initialHeight,
    };

    Promise.all([
      figma.clientStorage.getAsync('windowSize'),
      figma.clientStorage.getAsync('windowPosition'),
      figma.clientStorage.getAsync('windowBottomSheetHeight'),
      figma.clientStorage.getAsync('windowMode'),
    ]).then((values) => {
      const [storedWindowSize, , storedWindowBottomSheetHeight, storedWindowMode] = values;

      if (!enforceInitialConfig) {
        if (storedWindowSize) {
          this.size = storedWindowSize;
        }

        if (storedWindowBottomSheetHeight) {
          this.bottomSheetHeight = storedWindowBottomSheetHeight;
        }

        if (storedWindowMode) {
          this.windowMode = storedWindowMode;
        }
      }

      figma.showUI(__html__, {
        themeColors: true, width: this.size.width, height: this.size.height, visible: false,
      });

      this.viewportResizeCheckInterval = setInterval(() => {
        if (this.handledViewportWidth !== figma.viewport.bounds.width
                    || this.handledViewportHeight !== figma.viewport.bounds.height) {
          // set flag to signal the user is currently changing the viewport this can be zooming or parent window size change
          this.viewPortResizing = true;

          if (this.viewPortResizeSettleTimeout) {
            clearTimeout(this.viewPortResizeSettleTimeout);
          }
          this.viewPortResizeSettleTimeout = setTimeout(() => {
            this.viewPortResizing = false;
            console.log('vieportChange -> repositionWindow (settled)');
            this.repositionWindow();
          }, this.settleTime);

          console.log('vieportChange -> repositionWindow ');
          this.repositionWindow();

          this.handledViewportWidth = figma.viewport.bounds.width;
          this.handledViewportHeight = figma.viewport.bounds.height;
        }
      }, 1);

      figma.ui.on('message', (message) => {
        if (message.target === 'WindowManager') {
          if (message.size) {
            this.handleSizeMessage(message);
          } else if (message.windowMode !== undefined) {
            this.setWindowMode(message.windowMode);
          }
        }
      });
    });
  }

  handleSizeMessage(message: any) {
    this.windowResizing = true;

    if (this.windowMode === WindowMode.Window && message.source === 'dragging') {
      this.size = message.size;
      figma.clientStorage.setAsync('windowSize', this.size);
    } else if (this.windowMode === WindowMode.BottomSheet && !this.viewPortResizing) {
      this.bottomSheetHeight = message.size.height;
      figma.clientStorage.setAsync('windowBottomSheetHeight', message.size.height);
    }

    console.log('handleSizeMessage -> repositionWindow');
    this.repositionWindow();

    if (this.windowResizeSettleTimeout) {
      clearTimeout(this.windowResizeSettleTimeout);
    }
    this.windowResizeSettleTimeout = setTimeout(() => {
      this.windowResizing = false;
      console.log('handleSizeMessage -> repositionWindow (settled)');
      this.repositionWindow();
    }, 500);
  }

  repositionWindow() {
    console.log('repositionWindow');
    let { height } = this.size;
    let { width } = this.size;
    let x = undefined as number | undefined;
    let y = undefined as number | undefined;

    if (this.windowMode === WindowMode.Fullscreen) {
      console.log('Fullscreen');
      const leftPanelWidth = 240;
      const rightPanelWidth = 240;

      width = figma.viewport.bounds.width * figma.viewport.zoom + leftPanelWidth + rightPanelWidth;
      height = figma.viewport.bounds.height * figma.viewport.zoom;

      x = figma.viewport.bounds.x - ((leftPanelWidth) / figma.viewport.zoom);
      y = figma.viewport.bounds.y;
    } else if (this.windowMode === WindowMode.BottomSheet) {
      console.log('BottomSheet');
      width = figma.viewport.bounds.width * figma.viewport.zoom;
      height = figma.viewport.bounds.height * figma.viewport.zoom;

      x = figma.viewport.bounds.x;
      y = figma.viewport.bounds.y + figma.viewport.bounds.height - ((this.bottomSheetHeight + titleBarHeight) / figma.viewport.zoom);
    } else if (this.windowMode === WindowMode.Window) {
      console.log('Window');
      if (this.currentMode !== this.windowMode) {
        // center window on switch to window mode
        x = figma.viewport.bounds.x + ((figma.viewport.bounds.width / 2) - ((width / 2) / figma.viewport.zoom));
        y = figma.viewport.bounds.y + ((figma.viewport.bounds.height / 2) - (((height + titleBarHeight) / 2) / figma.viewport.zoom));
      }
    }

    let reshow = false;
    if (x !== undefined && y !== undefined && !this.windowResizing) {
      reshow = true;
      console.log(`hiding to reposition${y} ${x}`);
      // figma doesn't allow reposition after the user has moved the window manual once - by hiding and showing the ui it looses its corresponding state
      figma.ui.hide();
      // @ts-ignore
      figma.ui.reposition(x, y);
    }

    // eslint-disable-next-line no-bitwise
    figma.ui.resize(width | 0, height | 0);

    this.currentMode = this.windowMode;

    if (reshow) {
      setTimeout(() => {
        figma.ui.show();
      }, 1);
    } 
  
  }

  setWindowMode(mode: WindowMode) {
    this.windowMode = mode;

    figma.clientStorage.setAsync('windowMode', mode);

    console.log('setWindowMode -> repositionWindow (settled)');
    this.repositionWindow();
  }
}
