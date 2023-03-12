import * as React from 'react';
import { useEffect, useState } from 'react';
import Language from '../../../lib/base/Language';
import { LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import FigmaUtil from '../../../shared/FigmaUtil';
import LocalizedFrameGroup from './LocalizedFrameGroup';
import './LocalizedLabelsListView.css';

type LocalizedLabelsListViewProps = {
  translationKeyStore: MemoryTranslationKeyStore
  figmaRemote: FigmaUtil
  localizedLabelManager: LocalizedLabelManagerUI,
};

interface LocalizedLabelListItem extends LocalizedLabel {
//    selected?: boolean
}

export default function LocalizedLabelsListView({
  translationKeyStore,
  figmaRemote,
  localizedLabelManager,
}: LocalizedLabelsListViewProps) {
  const [localizedLabels, setLocalizedLabels] = useState([] as LocalizedLabelListItem[]);

  const [selection, setSelection] = useState({} as {
    [rootFrameId: string]: string[]
  });

  useEffect(() => {
    // connect figmas plugin message to the apps onMessage handler
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    onmessage = messageHandler;

    // asynchronous fetch the state from figma helper
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await refreshSelection();
    })();

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    localizedLabelManager.addEventListener('updated', refreshSelection);

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    return () => localizedLabelManager.removeEventListener('updated', refreshSelection);
  }, []);

  function messageHandler(event: any) {
    if (event.data.pluginMessage.type === 'event') {
      if (event.data.pluginMessage.name === 'selectionchange') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
        refreshSelection();
      }
    }
  }

  async function refreshSelection() {
    // console.log('refreshSelection()');

    const selectedNodes = await figmaRemote.getSelection();

    const selectedByFrame = {} as {
      [rootFrameId: string]: string[]
    };

    let selectedLabels = [] as LocalizedLabel[];

    for (const selectedNode of selectedNodes) {
      if (!selectedByFrame[selectedNode.rootFrameId]) {
        // console.log('getting labels from manager');
        // eslint-disable-next-line no-await-in-loop -- parallizing would not bring any advantage here
        const selectedLabelsByFrame = await localizedLabelManager.getLocalizedLabelsByFrame(selectedNode.rootFrameId);

        if (selectedLabelsByFrame) {
          selectedLabels = selectedLabels.concat(selectedLabelsByFrame.lokalizedLabels);
        }

        // console.log(selectedLabels);

        selectedByFrame[selectedNode.rootFrameId] = [selectedNode.selectedNodeId];
      } else {
        selectedByFrame[selectedNode.rootFrameId].push(selectedNode.selectedNodeId);
      }
    }
    setLocalizedLabels(selectedLabels);
    setSelection(selectedByFrame);
  }

  if (localizedLabels.length === 0) {
    return (
      <div className="emptyState">
        <div className="emptyStateTitle">No Frames selected</div>
        <div className="emptyStateSubtitle">
          <div>
            Labels for localization
            <br />
            will show up here when selected.
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="table">
      {Object.keys(selection).map((mainFrameId) => (
        <LocalizedFrameGroup
          localizedLabels={localizedLabels}
          selectionByFrame={selection}
          translationKeyStore={translationKeyStore}
          figmaRemote={figmaRemote}
          localisedLabelManager={localizedLabelManager}
          key={mainFrameId}
        />
      ))}
    </div>
  );
}
