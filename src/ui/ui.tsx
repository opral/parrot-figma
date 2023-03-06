import * as React from "react";
import { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";

import ConfigView from "./views/config/ConfigView";
import { LocalizedLabel } from "../lib/localizedlabels/LocalizedLabel";
import LocalizedLabelsListView from "./views/localizedlabelslist/LocalizedLabelsListView"
import { FigmaUtil } from "../shared/FigmaUtil"
import { AsyncFunctionProxy } from "../lib/rpc/AsyncFunctionProxy";
import "./ui.css";
import FigmaHelper from "../shared/FigmaHelper";
import SearchKeyList from "./views/searchkeys/SearchKeys";
import { WindowManagerUi } from "../lib/windowManager/WindowManagerUI";
import { WindowMode } from "../lib/windowManager/WindowManagerSandbox";
import { TranslationKeys } from "../lib/keystore/TranslationKey";
import TranslationKeyListView from "./views/translationkeys/TranslationKeyListView";
import { Language } from "../lib/base/Language";

import { MemoryTranslationKeyStore } from "../lib/keystore/MemoryTranslationKeyStore";
import { FigmaFileTranslationKeyStore } from "../lib/keystore/FigmaFileTranslationKeyStore";

import { LocalizedLabelManager } from "../lib/localizedlabels/LocalizedLabelManager";
import { LocalizedLabelManagerUI } from "../lib/localizedlabels/LocalizedLabelManagerUI";

import "./tabbar.css"
import "./assets/icons.css"
import SegmentedControl from "./compontents/segmentedControl/SegmentedControl";

WindowManagerUi.init(
    document.getElementById('sizing-wrapper')!, 
    document.getElementById('react-page')!, 
    document.getElementById('corner')!
)

let asyncFunctionProxy = new AsyncFunctionProxy('UIAsyncFunctionProxy', (data: any) => {
    parent.postMessage( {
        pluginMessage: data
    }, '*')
}, window);

let remoteLocalizedLabelManager = new LocalizedLabelManager(undefined);
asyncFunctionProxy.proxyAsyncMethods(remoteLocalizedLabelManager);

let figmaRemote = new FigmaUtil()
asyncFunctionProxy.proxyAsyncMethods(figmaRemote)

let figmaFileTranslationKeyStore = new FigmaFileTranslationKeyStore()
asyncFunctionProxy.proxyAsyncMethods(figmaFileTranslationKeyStore);

let memoryTranslationKeyStore = new MemoryTranslationKeyStore(figmaFileTranslationKeyStore)

let localizedLabelManager = new LocalizedLabelManagerUI(remoteLocalizedLabelManager, memoryTranslationKeyStore);



const defaultLinkStyleStorageKey = 'defaultLinkStyle';


function App() {
    const inputRef = React.useRef<HTMLInputElement>(null);
    

    // initial app screen is startup until we initialy loaded the data
    let [appScreen, setAppScreen] = useState('design')

    let [translatedLeys, setTranslatedKeys] = useState({} as TranslationKeys)
    let [languages, setLanguages] = useState([] as Language[])

    let [initialLoadingCompleted, setIinitialLoadingCompleted] = useState(false)
    
    let [defaultLinkStyle, setDefaultLinkStyle] = useState('' as string)
    
    useEffect(() => {
        
        // asynchronous fetch the state from figma helper
        (async ()=>{
            await memoryTranslationKeyStore.load()
            await localizedLabelManager.loadAll();

            let defaultLinkStyle = await remoteLocalizedLabelManager.getLinkStyle();
            setDefaultLinkStyle(defaultLinkStyle);
            
            await refreshTranslatedKeys();
            await refreshLanguages();

            setIinitialLoadingCompleted(true);
           
        })()
    }, [])

    

    async function refreshLanguages() {
        // let languages = await figmaHelperRemote.getLanguages();
        setLanguages([Language.De, Language.En, Language.Bg, Language.Fr, Language.Cs, Language.It]);
    }

    async function setLinkStyle(linkStyle: string) {
        remoteLocalizedLabelManager.setLinkStyle(linkStyle);
        setDefaultLinkStyle(linkStyle);
    }

    async function refreshTranslatedKeys() {
        let translatedKeys = memoryTranslationKeyStore.translationKeys;
        setTranslatedKeys(translatedKeys);
    }

    if (!initialLoadingCompleted) {
        return <>{'Not ready'}</>
    }

    let view;
    if(appScreen=='keys') {
        view = <TranslationKeyListView 
                    figmaRemote={figmaRemote}
                    translationKeyStore={memoryTranslationKeyStore}
                    keys={translatedLeys} 
                    languages={languages} 
                    refreshKeys={refreshTranslatedKeys}
                />
    } else if(appScreen=='settings') {
        view = <ConfigView 
                    linkStyle={defaultLinkStyle}
                    setLinkStyle={setLinkStyle}
                />
    } else {
        view = <LocalizedLabelsListView 
                    translationKeyStore={memoryTranslationKeyStore}
                    localisedLabelManager={localizedLabelManager}
                    figmaRemote={figmaRemote}
                    languages={languages} 
                />
    }

    return (

       <>
            <div className="toolbar">
                <div className="tabHeader">
                    <div className={"tab " + (appScreen == 'design' ? 'active' : '')} onClick={e=> setAppScreen('design')}>Design</div>
                    <div className={"tab " + (appScreen == 'keys' ? 'active' : '')} onClick={e=> setAppScreen('keys')}>Keys</div>
                    <div className={"tab " + (appScreen == 'settings' ? 'active' : '')} onClick={e=> setAppScreen('settings')}>Settings</div>
                </div>
                <div className="window-control">
                    <SegmentedControl<WindowMode>
                        segments={[{
                            iconName: 'window-mode-window-svg',
                            value: WindowMode.Window
                        }, {
                            iconName: 'window-mode-fullscreen-svg',
                            value:  WindowMode.Fullscreen
                        }, {
                            iconName: 'window-mode-bottom-attached-svg',
                            value: WindowMode.BottomSheet
                        }]} selectedSegment={WindowMode.Window} onChoose={(windowMode: WindowMode) => { WindowManagerUi.instance?.setWindowMode(windowMode) }}/>
                
                </div>
                
            </div>
            
            <div className="view">
            {view}
            </div>
            <a id="focusHelper" href=""></a>
        </>
    )
  }
  
  ReactDOM.render(<App />, document.getElementById("react-page"));
