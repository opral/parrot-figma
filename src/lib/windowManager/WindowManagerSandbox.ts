import { debug } from 'console';
import { FigmaFileTranslationKeyStore } from '../keystore/FigmaFileTranslationKeyStore';

export enum WindowMode {
  IntroWindow = 'introWindow',
  Window = 'window',
  Mini = 'mini',
  BottomSheet = 'bottomSheet',
  Fullscreen = 'fullscreen',
}

export class WindowManagerSandbox {
  public proxClassName = 'LocalizedLabelManager';

  windowMode: WindowMode;

  size: any;

  titleBarHeight = 40;

  // bottom sheet

  bottomSheetHeight = 300;

  // fullscreen

  fullscreenMarginRight = 35;

  fullscreenMarginLeft = 35;

  fullscreenMarginTop = 35;

  fullscreenMarginBottom = 35;

  viewportResizeCheckInterval: any;

  pluginDragCheckInterval: any;

  handlePluginX = -1;

  handlePluginY = -1;

  handledViewportZoom = -1;

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
      figma.clientStorage.getAsync('windowBottomSheetHeight'),
      figma.clientStorage.getAsync('windowMode'),
    ]).then((values) => {
      const [storedWindowSize, storedWindowBottomSheetHeight, storedWindowMode] = values;

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
        themeColors: true, width: this.size.width, height: this.size.height, visible: true,
      });

      this.viewportResizeCheckInterval = setInterval(() => {
        if (this.handledViewportWidth !== figma.viewport.bounds.width
                    || this.handledViewportHeight !== figma.viewport.bounds.height) {
          // if we have a change in zoom we don't have a resize of the viewport
          if (this.handledViewportZoom !== -1 // if never checked - it is not a zoom
            && this.handledViewportZoom !== figma.viewport.zoom) {
            this.handledViewportWidth = figma.viewport.bounds.width;
            this.handledViewportHeight = figma.viewport.bounds.height;
            this.handledViewportZoom = figma.viewport.zoom;
            return;
          }
          // set flag to signal the user is currently changing the viewport (window size change)
          this.viewPortResizing = true;

          // we debounce this call since reposition can only be done by hiding and showing the window
          if (this.viewPortResizeSettleTimeout) {
            clearTimeout(this.viewPortResizeSettleTimeout);
          }
          this.viewPortResizeSettleTimeout = setTimeout(() => {
            this.viewPortResizing = false;
          }, this.settleTime);

          this.repositionWindow(false);

          this.handledViewportWidth = figma.viewport.bounds.width;
          this.handledViewportHeight = figma.viewport.bounds.height;
          this.handledViewportZoom = figma.viewport.zoom;
        }
      }, 1);

      figma.ui.on('message', (message) => {
        if (message.target === 'WindowManager') {
          if (message.size) {
            this.handleSizeMessage(message);
          } else if (message.requestedWindowMode !== undefined) {
            if (!this.viewPortResizing && this.windowMode !== message.requestedWindowMode) {
              this.setWindowMode(message.requestedWindowMode, message.fromDrag);
              setTimeout(() => {
                figma.ui.postMessage({
                  target: 'WindowManager',
                  windowMode: this.windowMode,
                });
              }, 30);
            }
          } else if (message.uiInit) {
            // while the ui is leading changes in the window mode - it needs to get informed about initial state
            figma.ui.postMessage({
              target: 'WindowManager',
              windowMode: this.windowMode,
            });
          }
        }
      });
    });
  }

  private setWindowMode(mode: WindowMode, fromDrag: boolean) {
    if (this.windowMode === WindowMode.BottomSheet 
      && mode === WindowMode.Window && fromDrag) {
      const width = Math.ceil(figma.viewport.bounds.width * figma.viewport.zoom);
      const height = this.bottomSheetHeight; // in case of the bottom sheet we always keep the windows size equal to the viewport size
      this.size.width = width;
      this.size.height = height;

      figma.clientStorage.setAsync('windowSize', this.size);

      this.windowMode = mode;
      figma.clientStorage.setAsync('windowMode', mode);
      // no resize needed
    } else {
      this.windowMode = mode;
      figma.clientStorage.setAsync('windowMode', mode);
      this.repositionWindow(true);
    }
  }

  handleSizeMessage(message: any) {
    if (this.windowMode === WindowMode.Window && message.source === 'dragging') {
      this.size = message.size;
      figma.clientStorage.setAsync('windowSize', this.size);
    } else if (this.windowMode === WindowMode.BottomSheet) {
      this.bottomSheetHeight = message.size.height;
      figma.clientStorage.setAsync('windowBottomSheetHeight', message.size.height);
    }

    this.repositionWindow(false);
  }

  repositionWindow(forceReshow: boolean) {
    let { height, width } = this.size;
    let x = undefined as number | undefined;
    let y = undefined as number | undefined;

    if (this.windowMode === WindowMode.Fullscreen) {
      const leftPanelWidth = 240;
      const rightPanelWidth = 240;

      width = figma.viewport.bounds.width * figma.viewport.zoom + leftPanelWidth + rightPanelWidth - (this.fullscreenMarginLeft + this.fullscreenMarginRight);
      height = figma.viewport.bounds.height * figma.viewport.zoom - (this.titleBarHeight + this.fullscreenMarginTop + this.fullscreenMarginBottom);

      x = figma.viewport.bounds.x - ((leftPanelWidth) / figma.viewport.zoom) + (this.fullscreenMarginLeft / figma.viewport.zoom);
      y = figma.viewport.bounds.y + (this.fullscreenMarginTop / figma.viewport.zoom);
    } else if (this.windowMode === WindowMode.BottomSheet) {
      width = figma.viewport.bounds.width * figma.viewport.zoom;
      height = this.bottomSheetHeight; // in case of the bottom sheet we always keep the windows size equal to the viewport size

      x = figma.viewport.bounds.x;
      y = figma.viewport.bounds.y + figma.viewport.bounds.height - ((this.bottomSheetHeight + this.titleBarHeight - 5) / figma.viewport.zoom);
    } else if (this.windowMode === WindowMode.Window) {
      if (this.currentMode !== this.windowMode) {
        // center window on switch to window mode - there is no way to save the window position at the moment
        x = figma.viewport.bounds.x + ((figma.viewport.bounds.width / 2) - ((width / 2) / figma.viewport.zoom));
        y = figma.viewport.bounds.y + ((figma.viewport.bounds.height / 2) - (((height + this.titleBarHeight) / 2) / figma.viewport.zoom));
      }
    }

    if (x !== undefined && y !== undefined && !this.windowResizing) {
      // figma doesn't allow reposition after the user has moved the window manual once - by hiding and showing the ui it looses its corresponding state
      this.reposition(x, y, forceReshow);
    }

    // eslint-disable-next-line no-bitwise
    figma.ui.resize(width | 0, height | 0);

    this.currentMode = this.windowMode;
  }

  lastReposition: any;

  reshowing = false;

  reposition(x: number, y: number, forceReshow: boolean) {
    if ((forceReshow) && !this.reshowing) {
      figma.ui.hide();
      this.reshowing = true;
      setTimeout(() => {
        figma.ui.show();
        setTimeout(() => {
          this.reshowing = false;
        }, 1);
      }, 1);
    }

    // @ts-ignore
    figma.ui.reposition(x, y);
  }
}
