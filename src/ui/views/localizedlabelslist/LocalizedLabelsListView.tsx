import * as React from "react";
import { useEffect, useState } from "react";
import * as ReactDOM from "react-dom";
import { Language } from "../../../lib/base/Language";
import { LocalizedLabel } from "../../../lib/localizedlabels/LocalizedLabel";
import { MemoryTranslationKeyStore } from "../../../lib/keystore/MemoryTranslationKeyStore";
import { LocalizedLabelManagerUI } from "../../../lib/localizedlabels/LocalizedLabelManagerUI";
import FigmaHelper from "../../../shared/FigmaHelper";
import { FigmaUtil } from "../../../shared/FigmaUtil";
import LocalizedFrameGroup from "./LocalizedFrameGroup";
import "./LocalizedLabelsListView.css"

type LocalizedLabelsListViewProps = {
    languages: Language[]
    translationKeyStore: MemoryTranslationKeyStore
    figmaRemote: FigmaUtil
    localisedLabelManager: LocalizedLabelManagerUI,
  }
  
interface LocalizedLabelListItem extends LocalizedLabel {
//    selected?: boolean
}

export default function LocalizedLabelsListView(props: LocalizedLabelsListViewProps) {

    let [localizedLabels, setLocalizedLabels] = useState([] as LocalizedLabelListItem[])

    let [selection, setSelection] = useState({} as {
        [rootFrameId: string]: string[]
    })

    useEffect(() => {
        
        // connect figmas plugin message to the apps onMessage handler 
        onmessage = messageHandler;

        // asynchronous fetch the state from figma helper
        (async ()=>{
            await refreshSelection()
        })()


        props.localisedLabelManager.addEventListener('updated', refreshSelection)

        return () => props.localisedLabelManager.removeEventListener('updated', refreshSelection)
    }, [])

    function messageHandler(event: any) {
        if(event.data.pluginMessage.type === 'event') {
            if(event.data.pluginMessage.name === 'selectionchange') {
                refreshSelection()
                return;
            }
        } 
    } 

    async function refreshSelection() {
        console.log('refreshSelection()');

        let selectedNodes = await props.figmaRemote.getSelection();  
        
        let selectedByFrame = {} as {
            [rootFrameId: string]: string[]
        };

        let selectedLabels = [] as LocalizedLabel[]

        
        for (let selectedNode of selectedNodes) {

            if (!selectedByFrame[selectedNode.rootFrameId]) {
                console.log('getting labels from manager')
                let selectedLabelsByFrame = await props.localisedLabelManager.getLocalizedLabelsByFrame(selectedNode.rootFrameId);
                
                if (selectedLabelsByFrame) {
                    selectedLabels = selectedLabels.concat(selectedLabelsByFrame.lokalizedLabels);
                }

                console.log(selectedLabels);

                selectedByFrame[selectedNode.rootFrameId] = [selectedNode.selectedNodeId];
            } else {
                selectedByFrame[selectedNode.rootFrameId].push(selectedNode.selectedNodeId)
            }

        }
        setLocalizedLabels(selectedLabels);
        setSelection(selectedByFrame);
    }

    if (localizedLabels.length == 0) {
        return (
        <div className="emptyState">
            <div className="emptyStateTitle">No Frames selected</div>
            <div className="emptyStateSubtitle">
                <div>
                Labels for localization<br/>
                will show up here when selected.
                </div>
            </div>
        </div>
        )
    }

    return (
        <div className="table">
                {Object.keys(selection).map((mainFrameId) => 
                    <LocalizedFrameGroup 
                        languages={props.languages} 
                        localizedLabels={localizedLabels} 
                        selectionByFrame={selection}
                        translationKeyStore={props.translationKeyStore}
                        figmaRemote={props.figmaRemote}
                        localisedLabelManager={props.localisedLabelManager}
                        key={mainFrameId} 
                        
                        />)
                }
            </div>
    )
}

