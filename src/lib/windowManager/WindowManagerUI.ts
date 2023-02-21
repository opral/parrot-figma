import { WindowMode } from "./WindowManagerSandbox";

export class WindowManagerUi {

    sizeWrapper: HTMLElement;
    contentEl: HTMLElement;
    resizeHandelEl: HTMLElement;

    intersectionObserver: IntersectionObserver | undefined;

    sizeSettled: any

    static instance: WindowManagerUi | undefined

    static init(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
        if (this.instance) {
            throw Error('WindowManagerUi initialized twice')
        }
        this.instance = new WindowManagerUi(sizeWrapperEl, contentEl, resizeHandelEl);
    }

    private constructor(sizeWrapperEl: HTMLElement, contentEl: HTMLElement, resizeHandelEl: HTMLElement) {
        this.sizeWrapper = sizeWrapperEl;
        this.contentEl = contentEl;
        this.resizeHandelEl = resizeHandelEl;

        let threshol = [];
        for (let i=0; i<=1.0; i+= 0.01) {
            threshol.push(i); 
        }

        let lastRatio = 0 as number;
        this.intersectionObserver = new IntersectionObserver((entries: IntersectionObserverEntry[], opts: any) => {
                if (entries[0] && entries[0].target === this.sizeWrapper) {
                    
                    if (lastRatio != entries[0].intersectionRatio && entries[0].intersectionRatio != 1) {
                        lastRatio = entries[0].intersectionRatio;
                        
                        contentEl!.style.height = entries[0].intersectionRect.height + 'px';
                        parent.postMessage( { pluginMessage: { target: 'WindowManager', size: {
                            width: contentEl.clientWidth,
                            height: contentEl.clientHeight
                        }, source: 'intersection' }}, '*');
                        
                    }
                    
                } 
        }, {
            root: null,   // default is the viewport
            threshold: threshol // percentage of target's visible area. Triggers "onIntersection"
        }) 

        this.intersectionObserver.observe(sizeWrapperEl!)

        this.resizeHandelEl.onpointerdown = this.onResizeHandlePointerDown.bind(this)
        this.resizeHandelEl.onpointerup = this.onResizeHandlePointerUp.bind(this)
    }

    onResizeHandleDrag(e: any) {
        const size = {
            width: Math.max(50,Math.floor(e.clientX+5)),
            height: Math.max(50,Math.floor(e.clientY+5))
        };
        parent.postMessage( { pluginMessage: { target: 'WindowManager', size: size, source: 'dragging' }}, '*');
    }

    onResizeHandlePointerUp(e: any) {
        e.target.onpointermove = null;
        e.target.releasePointerCapture(e.pointerId);
    };
    
    onResizeHandlePointerDown(e: any) {
        e.target.onpointermove = this.onResizeHandleDrag;
        e.target.setPointerCapture(e.pointerId);
    };

    setWindowMode(mode: WindowMode) {
        parent.postMessage( { pluginMessage: { target: 'WindowManager', windowMode: mode }}, '*');
    }
}