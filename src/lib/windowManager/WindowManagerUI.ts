/* eslint-disable class-methods-use-this */
import { WindowMode } from './WindowManagerSandbox';

export default class WindowManagerUi extends EventTarget {
  sizeWrapper: HTMLElement;

  contentEl: HTMLElement;

  resizeHandelEl: HTMLElement;

  intersectionObserver: IntersectionObserver | undefined;

  sizeSettled: any;

  static instance: WindowManagerUi | undefined;

  windowMode = WindowMode.Window;

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

    const threshol = [];
    for (let i = 0; i <= 1.0; i += 0.01) {
      threshol.push(i);
    }

    let lastRatio = 0 as number;
    this.intersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[]) => {
      if (entries[0] && entries[0].target === this.sizeWrapper) {
        if (lastRatio !== entries[0].intersectionRatio && entries[0].intersectionRatio !== 1 && entries[0].intersectionRect.height !== 0) {
          lastRatio = entries[0].intersectionRatio;

          const intersectionHeight = Math.ceil(entries[0].intersectionRect.height);

          console.log('height detected: ' + entries[0].intersectionRect.height);
          this.contentEl!.style.height = `${intersectionHeight}px`;
          ((document.querySelector(':root')!) as HTMLElement).style.setProperty('--window-client-height', `${entries[0].intersectionRect.height}px`);

          // eslint-disable-next-line no-restricted-globals
          parent.postMessage({
            pluginMessage: {
              target: 'WindowManager',
              size: {
                width: contentEl.clientWidth,
                height: intersectionHeight,
              },
              source: 'intersection',
            },
          }, '*');
        }
      }
    }, {
      root: null, // default is the viewport
      threshold: threshol, // percentage of target's visible area. Triggers "onIntersection"
    });

    this.intersectionObserver.observe(sizeWrapperEl!);

    this.resizeHandelEl.onpointerdown = this.onResizeHandlePointerDown.bind(this);
    this.resizeHandelEl.onpointerup = this.onResizeHandlePointerUp.bind(this);

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'WindowManager') {
        if (event.data.pluginMessage.windowMode) {
          this.setWindowMode(event.data.pluginMessage.windowMode);
        }
      }
    });

    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: { target: 'WindowManager', uiInit: true } }, '*');
  }

  onResizeHandleDrag(e: any) {
    const size = {
      width: Math.max(50, Math.floor(e.clientX + 5)),
      height: Math.max(50, Math.floor(e.clientY + 5)),
    };
    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' } }, '*');
  }

  onResizeHandlePointerUp(e: any) {
    e.target.onpointermove = null;
    e.target.releasePointerCapture(e.pointerId);
  }

  onResizeHandlePointerDown(e: any) {
    e.target.onpointermove = this.onResizeHandleDrag;
    e.target.setPointerCapture(e.pointerId);
  }

  setWindowMode(mode: WindowMode) {
    if (this.windowMode !== mode) {
      this.windowMode = mode;
      const event = new CustomEvent<any>('changed');
      this.dispatchEvent(event);
      // eslint-disable-next-line no-restricted-globals
      parent.postMessage({ pluginMessage: { target: 'WindowManager', windowMode: mode } }, '*');
    }
  }
}
