/* eslint-disable class-methods-use-this */
import { RESIZEDETECTION_OVERLAP_PX, WindowMode } from './WindowManagerSandbox';

const threshol = [] as number[];
for (let i = 0; i <= 1.0; i += 0.01) {
  threshol.push(i);
}

export default class WindowManagerUi extends EventTarget {
  sizeWrapper: HTMLElement;

  contentEl: HTMLElement;

  resizeHandelEl: HTMLElement;

  intersectionObserver: IntersectionObserver | undefined;

  windowHeight: number;

  sizeSettled: any;

  static instance: WindowManagerUi | undefined;

  isResizing = false;

  // a hacky solution for now but we want this to be available synchronous so we replace this before the html is injected
  windowMode = '__%%InitialWindowMode%%__' as WindowMode;

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

    this.windowHeight = parseInt(height, 10);

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

          // eslint-disable-next-line no-restricted-globals
          parent.postMessage({ pluginMessage: { target: 'WindowManager', windowOverlapChanged: true }, pluginId: '*' }, '*');
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

    this.resizeHandelEl.classList.remove(...this.resizeHandelEl.classList);
    this.resizeHandelEl.classList.add(this.windowMode);

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
    parent.postMessage({ pluginMessage: { target: 'WindowManager', uiInit: true }, pluginId: '*' }, '*');
  }

  requestResize(size: { height?: number, width?: number }) {
    parent.postMessage({ pluginMessage: { target: 'WindowManager', size }, pluginId: '*' }, '*');
  }

  startDevMode() {
    parent.postMessage({ pluginMessage: { target: 'WindowManager', startDevMode: true }, pluginId: '*' }, '*');
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
      parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' }, pluginId: '*' }, '*');
    } else if (this.windowMode === WindowMode.BottomSheet) {
      if (!isNaN(height)) {
        const size = {
          height: Math.max(this.minHeight, Math.floor(height - (e.clientY - this.startingOffsetY))),
        };
        parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' }, pluginId: '*'  }, '*');
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
      parent.postMessage({ pluginMessage: { target: 'WindowManager', requestedWindowMode: mode, fromDrag }, pluginId: '*' }, '*');
    }
  }
}
