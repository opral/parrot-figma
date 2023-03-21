import { WindowMode } from './WindowManagerSandbox';

export default class WindowManagerUi {
  sizeWrapper: HTMLElement;

  contentEl: HTMLElement;

  resizeHandelEl: HTMLElement;

  intersectionObserver: IntersectionObserver | undefined;

  sizeSettled: any;

  static instance: WindowManagerUi | undefined;

  static init(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
    if (this.instance) {
      throw Error('WindowManagerUi initialized twice');
    }
    this.instance = new WindowManagerUi(sizeWrapperEl, contentEl, resizeHandelEl);
  }

  private constructor(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
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
        if (lastRatio !== entries[0].intersectionRatio && entries[0].intersectionRatio !== 1) {
          lastRatio = entries[0].intersectionRatio;

          this.contentEl!.style.height = `${entries[0].intersectionRect.height}px`;
          ((document.querySelector(':root')!) as HTMLElement).style.setProperty('--window-client-height', `${entries[0].intersectionRect.height}px`);
          // eslint-disable-next-line no-restricted-globals
          parent.postMessage({
            pluginMessage: {
              target: 'WindowManager',
              size: {
                width: contentEl.clientWidth,
                height: contentEl.clientHeight,
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
  }

  // eslint-disable-next-line class-methods-use-this
  onResizeHandleDrag(e: any) {
    const size = {
      width: Math.max(50, Math.floor(e.clientX + 5)),
      height: Math.max(50, Math.floor(e.clientY + 5)),
    };
    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: { target: 'WindowManager', size, source: 'dragging' } }, '*');
  }

  // eslint-disable-next-line class-methods-use-this
  onResizeHandlePointerUp(e: any) {
    e.target.onpointermove = null;
    e.target.releasePointerCapture(e.pointerId);
  }

  onResizeHandlePointerDown(e: any) {
    e.target.onpointermove = this.onResizeHandleDrag;
    e.target.setPointerCapture(e.pointerId);
  }

  // eslint-disable-next-line class-methods-use-this
  setWindowMode(mode: WindowMode) {
    // eslint-disable-next-line no-restricted-globals
    parent.postMessage({ pluginMessage: { target: 'WindowManager', windowMode: mode } }, '*');
  }
}
