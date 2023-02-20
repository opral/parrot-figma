import * as React from "react";
import { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";

import ConfigView from "./views/config/ConfigView";
import { LocalizedLabel } from "../lib/base/LocalizedLabel";
import LocalizedLabelsListView from "./views/localizedlabelslist/LocalizedLabelsListView"
import { FigmaUtil } from "../shared/FigmaUtil"
import { AsyncFunctionProxy } from "../lib/rpc/AsyncFunctionProxy";
import "./ui.css";
import FigmaHelper from "../shared/FigmaHelper";
import SearchKeyList from "./views/searchkeys/SearchKeys";
import { WindowManagerUi } from "../lib/windowManager/WindowManagerUI";
import { WindowMode } from "../lib/windowManager/WindowManagerSandbox";
import { TranslationKeys } from "../lib/base/TranslationKey";
import TranslationKeyListView from "./views/translationkeys/TranslationKeyListView";
import { Language } from "../lib/base/Language";


WindowManagerUi.init(
    document.getElementById('sizing-wrapper')!, 
    document.getElementById('react-page')!, 
    document.getElementById('corner')!
)

let asyncFunctionProxy = new AsyncFunctionProxy('UIAsyncFunctionProxy', (data: any) => {
    parent.postMessage( {
        pluginMessage: data
    }, '*')
}, window)

let figmaRemote = new FigmaUtil()
asyncFunctionProxy.proxyAsyncMethods(figmaRemote)

let figmaHelperRemote = new FigmaHelper(undefined);
asyncFunctionProxy.proxyAsyncMethods(figmaHelperRemote)


const defaultLinkStyleStorageKey = 'defaultLinkStyle';


function App() {
    const inputRef = React.useRef<HTMLInputElement>(null);
    

    // initial app screen is startup until we initialy loaded the data
    let [appScreen, setAppScreen] = useState('design')

    let [selectedKeys, setSelectedKeys] = useState([] as LocalizedLabel[])
    let [translatedLeys, setTranslatedKeys] = useState({} as TranslationKeys)
    let [languages, setLanguages] = useState([] as Language[])
    
    
    let [defaultLinkStyle, setDefaultLinkStyle] = useState('' as string)
    
    useEffect(() => {
        
        // connect figmas plugin message to the apps onMessage handler 
        onmessage = messageHandler;

        // asynchronous fetch the state from figma helper
        (async ()=>{
            
            await figmaHelperRemote.refreshLocalizationState()
            
            let defaultLinkStyle = await figmaHelperRemote.getLinkStyle();
            setDefaultLinkStyle(defaultLinkStyle);
            
            await refreshSelection()
            await refreshTranslatedKeys();
            await refreshLanguages();
           
        })()
    }, [])

    function messageHandler(event: any) {
        if(event.data.pluginMessage.type === 'event') {
            if(event.data.pluginMessage.name === 'selectionchange') {
                refreshSelection()
                return;
            }
        } 
    } 

    async function refreshLanguages() {
        let languages = await figmaHelperRemote.getLanguages();
        setLanguages(languages);
    }

    async function refreshSelection() {
        let selectedKeys = await figmaHelperRemote.getSelection();    
        setSelectedKeys(selectedKeys)
    }

    async function setLinkStyle(linkStyle: string) {
        figmaHelperRemote.setLinkStyle(linkStyle);
        setDefaultLinkStyle(linkStyle);
    }

    async function refreshKeys() {
        let selectedKeys = await figmaHelperRemote.getSelection();
        setSelectedKeys(selectedKeys)
    }

    async function refreshTranslatedKeys() {
        let translatedKeys = await figmaHelperRemote.getTranslatedKeys();
        setTranslatedKeys(translatedKeys);
    }

    let view;
    if(appScreen=='keys') {
        view = <TranslationKeyListView 
                    figmaHelper={figmaHelperRemote}
                    figmaRemote={figmaRemote}
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
        figmaHelper={figmaHelperRemote}
        figmaRemote={figmaRemote}
        keys={selectedKeys} 
        languages={languages} 
        refreshKeys={refreshKeys}
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
                <div className="frame-actions">
                    
                     <div className="circular-button" onClick={e=> { WindowManagerUi.instance?.setWindowMode(WindowMode.Window) }}>
                        <div className="window-mode-window" />
                    </div>
                    <div className="circular-button" onClick={e=> { WindowManagerUi.instance?.setWindowMode(WindowMode.Fullscreen) }}>
                        <div className="window-mode-fullscreen" />
                    </div>
                    <div className="circular-button" onClick={e=> { WindowManagerUi.instance?.setWindowMode(WindowMode.BottomSheet) }}>
                        <div className="window-mode-bottom-attached" />
                    </div>
                    
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
