/* eslint-disable class-methods-use-this */
import { RESIZEDETECTION_OVERLAP_PX, WindowMode } from './WindowManagerSandbox';

export default class WindowManagerUi extends EventTarget {
  sizeWrapper: HTMLElement;

  contentEl: HTMLElement;

  resizeHandelEl: HTMLElement;

  intersectionObserver: IntersectionObserver | undefined;

  windowHeight: number;

  sizeSettled: any;

  static instance: WindowManagerUi | undefined;

  isResizing = false;

  windowMode = WindowMode.Window;

  ratioChangedOnce = false;

  fullscreenDragIdleInterval: any;

  openRequest: WindowMode | undefined;

  minHeight = 50;

  minWidth = 370;

  static init(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
    if (this.instance) {
      throw Error('WindowManagerUi initialized twice');
    }
    this.instance = new WindowManagerUi(sizeWrapperEl, contentEl, resizeHandelEl);
  }

  private constructor(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
    super();
    this.sizeWrapper = sizeWrapperEl;
    this.contentEl = contentEl;
    this.resizeHandelEl = resizeHandelEl;

    const computedStyle = getComputedStyle(this.sizeWrapper);
    const { height } = computedStyle;

    console.log(height);
    this.windowHeight = parseInt(height, 10);

    const threshol = [];
    for (let i = 0; i <= 1.0; i += 0.01) {
      threshol.push(i);
    }

    ((document.querySelector(':root')!) as HTMLElement).style.setProperty('--resize-detection-overlap', `${RESIZEDETECTION_OVERLAP_PX + 2}px`);

    let lastRatio = 0 as number;
    this.intersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (this.isResizing || this.openRequest) {
        // ignoring - resizing
        return;
      }

      if (entries[0] && entries[0].target === this.sizeWrapper) {
        if (lastRatio !== entries[0].intersectionRatio && entries[0].intersectionRatio !== 1 && entries[0].intersectionRect.height !== 0) {
          lastRatio = entries[0].intersectionRatio;

          const intersectionHeight = Math.ceil(entries[0].intersectionRect.height);

          // console.log(`height detected: ${entries[0].intersectionRect.height}`);
          // this.contentEl!.style.height = `${intersectionHeight}px`;
          ((document.querySelector(':root')!) as HTMLElement).style.setProperty('--window-client-height', `${entries[0].intersectionRect.height}px`);
          
          if (this.windowMode === WindowMode.Fullscreen) {
            if (this.fullscreenDragIdleInterval) {
              clearTimeout(this.fullscreenDragIdleInterval);
            }

            if (lastRatio < 0.98) {
              this.fullscreenDragIdleInterval = setTimeout(() => {
                this.requestWindowMode(WindowMode.Window, false);
              }, 1000);
            }
          }

          if (this.windowMode === WindowMode.BottomSheet) {
            if (true || this.ratioChangedOnce) {
              console.log('window drag detected the second time - changing to window mode to Window');
              this.requestWindowMode(WindowMode.Window, true);
            } else {
              console.log('window drag detected the first time - setting trap');
              this.ratioChangedOnce = true;
            }

            // if we drag the window we want to change it to window mode after 1 second of idle
          } else if (this.windowMode === WindowMode.Window) {
            // console.log('window drag detected - changing to window mode to BottomSheet');
            // this.setWindowMode(WindowMode.BottomSheet);

            // if we are in window mode we want to set a timeout of 3 seconds independend if a move ment was detected
            // to change to bottome sheet
            // if no movement is detected for a a half a second we also want to change to bottome sheet
          }

          // eslint-disable-next-line no-restricted-globals
          /* parent.postMessage({
            pluginMessage: {
              target: 'WindowManager',
              size: {
                width: contentEl.clientWidth,
                height: intersectionHeight,
              },
              source: 'intersection',
            },
          }, '*'); */
        }
      }
    }, {
      root: null, // default is the viewport
      threshold: threshol, // percentage of target's visible area. Triggers "onIntersection"
    });

    this.intersectionObserver.observe(sizeWrapperEl!);


    console.log(this.resizeHandelEl);
    this.resizeHandelEl.onpointerdown = this.onResizeHandlePointerDown.bind(this);
    this.resizeHandelEl.onpointerup = this.onResizeHandlePointerUp.bind(this);
    this.resizeHandelEl.onmouseenter = this.onMouseEnter.bind(this); 

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'WindowManager') {
        if (event.data.pluginMessage.windowMode) {
          const mode = event.data.pluginMessage.windowMode as WindowMode;
          if (mode === WindowMode.BottomSheet) {
            this.ratioChangedOnce = false;
          }
          this.resizeHandelEl.classList.remove(...this.resizeHandelEl.classList);
          this.resizeHandelEl.classList.add(mode);

          const currentModeClasses = [...this.contentEl.classList].filter((className) => className.startsWith('windowmanager-'));
          this.contentEl.classList.remove(...currentModeClasses);
          this.contentEl.classList.add(`windowmanager-${mode}`);

          this.windowMode = mode;
          if (this.openRequest && mode !== this.openRequest) {
            console.log(`WARNING: requested mode ${this.requestWindowMode} differs from received ${mode}`);
          }
          this.openRequest = undefined;
          const changeEvent = new CustomEvent<any>('changed');
          this.dispatchEvent(changeEvent);
        }
      }
    });

    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: { target: 'WindowManager', uiInit: true } }, '*');
  }

  onResizeHandleDrag(e: any) {
    if (e.buttons !== 1) {
      return;
    }

    const computedStyle = getComputedStyle(this.sizeWrapper);
    const height = parseInt(computedStyle.height, 10);
    const width = parseInt(computedStyle.width, 10);
    if (this.windowMode === WindowMode.Window) {
      const size = {
        width: Math.max(this.minWidth, Math.floor(e.clientX + 5)),
        height: Math.max(this.minHeight, Math.floor(e.clientY + 5)),
      };
      parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' } }, '*');
    } else if (this.windowMode === WindowMode.BottomSheet) {
      if (!isNaN(height)) {
        const size = {
          height: Math.max(this.minHeight, Math.floor(height - (e.clientY - this.startingOffsetY))),
        };
        parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' } }, '*');
      }
    }
    // eslint-disable-next-line no-restricted-globals
  }

  onResizeHandlePointerUp(e: any) {
    this.isResizing = false;
    e.target.onpointermove = null;
    e.target.releasePointerCapture(e.pointerId);
  }

  startingOffsetY = -1;

  startingOffsetX = -1;

  onResizeHandlePointerDown(e: any) {
    this.startingOffsetY = e.clientY;
    this.startingOffsetX = e.clientX;
    this.isResizing = true;
    e.target.onpointermove = this.onResizeHandleDrag.bind(this);
    e.target.setPointerCapture(e.pointerId);
  }

  onMouseEnter(e: any) {
    if (e.buttons !== 1) {
      this.isResizing = false;
      e.target.onpointermove = null;
    }
  }

  requestWindowMode(mode: WindowMode, fromDrag: boolean) {
    if (this.openRequest) {
      console.log(`WARNING tried to request ${mode} while request is ongoing for${this.openRequest}`);
    }

    if (this.windowMode !== mode && this.openRequest !== mode) {
      this.openRequest = mode;
      parent.postMessage({ pluginMessage: { target: 'WindowManager', requestedWindowMode: mode, fromDrag } }, '*');
    }
  }
}
