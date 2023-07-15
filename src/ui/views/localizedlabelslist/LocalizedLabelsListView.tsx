import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import { LocalizedLabel } from '../../../lib/localizedlabels/LocalizedLabel';
import MemoryTranslationKeyStore from '../../../lib/keystore/MemoryTranslationKeyStore';
import LocalizedLabelManagerUI from '../../../lib/localizedlabels/LocalizedLabelManagerUI';
import FigmaUtil from '../../../shared/FigmaUtil';
import LocalizedFrameGroup from './LocalizedFrameGroup';
import './LocalizedLabelsListView.css';
import { UILocalizedLabel } from '../../../lib/localizedlabels/UILocalizedLabel';

declare global {
  interface Element {
    scrollIntoViewIfNeeded: (bool?: boolean) => void;
  }
}

if (!Element.prototype.scrollIntoViewIfNeeded) {
  Element.prototype.scrollIntoViewIfNeeded = function (
    this: HTMLElement,
    centerIfNeeded?: boolean,
  ) {
    // eslint-disable-next-line no-param-reassign
    centerIfNeeded = arguments.length === 0 ? true : !!centerIfNeeded;

    const parent = this.parentNode! as HTMLElement;
    const parentComputedStyle = window.getComputedStyle(parent, null);
    const parentBorderTopWidth = parseInt(
      parentComputedStyle.getPropertyValue('border-top-width'),
    );
    const parentBorderLeftWidth = parseInt(
      parentComputedStyle.getPropertyValue('border-left-width'),
    );
    const overTop = this.offsetTop - parent.offsetTop < parent.scrollTop;
    const overBottom = this.offsetTop
          - parent.offsetTop
          + this.clientHeight
          - parentBorderTopWidth
        > parent.scrollTop + parent.clientHeight;
    const overLeft = this.offsetLeft - parent.offsetLeft < parent.scrollLeft;
    const overRight = this.offsetLeft
          - parent.offsetLeft
          + this.clientWidth
          - parentBorderLeftWidth
        > parent.scrollLeft + parent.clientWidth;
    const alignWithTop = overTop && !overBottom;

    if ((overTop || overBottom) && centerIfNeeded) {
      parent.scrollTop = this.offsetTop
        - parent.offsetTop
        - parent.clientHeight / 2
        - parentBorderTopWidth
        + this.clientHeight / 2;
    }

    if ((overLeft || overRight) && centerIfNeeded) {
      parent.scrollLeft = this.offsetLeft
        - parent.offsetLeft
        - parent.clientWidth / 2
        - parentBorderLeftWidth
        + this.clientWidth / 2;
    }

    if ((overTop || overBottom || overLeft || overRight) && !centerIfNeeded) {
      this.scrollIntoView(alignWithTop);
    }
  };
}

type LocalizedLabelsListViewProps = {
  showKey: Function,
  figmaRemote: FigmaUtil
  localizedLabelManager: LocalizedLabelManagerUI,
};

export default function LocalizedLabelsListView({
  showKey,
  figmaRemote,
  localizedLabelManager,
}: LocalizedLabelsListViewProps) {
  const [localizedLabels, setLocalizedLabels] = useState<UILocalizedLabel[]>([]);

  const tableRef = useRef<HTMLDivElement>(null);

  const [selection, setSelection] = useState({} as {
    [rootFrameId: string]: string[]
  });

  async function refreshSelection() {
    const selectedNodes = await localizedLabelManager.getSelection();

    const selectedByFrame = {} as {
      [rootFrameId: string]: string[]
    };

    let selectedLabels = [] as UILocalizedLabel[];

    for (const selectedNode of Object.values(selectedNodes)) {
      if (!selectedNode.rootFrameId) {
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!selectedByFrame[selectedNode.rootFrameId]) {
        // console.log('getting labels from manager');
        // eslint-disable-next-line no-await-in-loop -- parallizing would not bring any advantage here
        const selectedLabelsByFrame = await localizedLabelManager.getLocalizedLabelsByFrame(selectedNode.rootFrameId);

        if (selectedLabelsByFrame) {
          selectedLabels = selectedLabels.concat(selectedLabelsByFrame);
        }

        selectedByFrame[selectedNode.rootFrameId] = [selectedNode.selectedNodeId];
      } else {
        selectedByFrame[selectedNode.rootFrameId].push(selectedNode.selectedNodeId);
      }
    }
    setLocalizedLabels(selectedLabels);
    setSelection(selectedByFrame);
  }

  function messageHandler(event: any) {
    if (event.data.pluginMessage.type === 'event') {
      if (event.data.pluginMessage.name === 'selectionchange') {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
        refreshSelection();
      }
    }
  }

  useEffect(() => {
    // asynchronous fetch the state from figma helper
    (async () => {
      // eslint-disable-next-line @typescript-eslint/no-use-before-define
      await refreshSelection();
    })();

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    localizedLabelManager.addEventListener('updated', refreshSelection);
    localizedLabelManager.keyStore.addEventListener('updated', refreshSelection);
    window.addEventListener('message', messageHandler);

    // eslint-disable-next-line @typescript-eslint/no-use-before-define -- i prefere this order
    return () => {
      localizedLabelManager.removeEventListener('updated', refreshSelection);
      localizedLabelManager.keyStore.removeEventListener('updated', refreshSelection);
      window.removeEventListener('message', messageHandler);
    };
  }, []);

  useEffect(() => {
    if (tableRef.current) {
      const firstSelected = tableRef.current.querySelector('.selected') as HTMLElement;
      if (firstSelected) {
        const foundElement = (firstSelected.firstChild as any);
        if (foundElement.scrollIntoViewIfNeeded) {
          (firstSelected.firstChild as any).scrollIntoViewIfNeeded({ block: 'center' });
        } else {

        }
      }
    }
  }, [selection]);

  return (
    <>
      {localizedLabels.length === 0 && (
      <div className="emptyState">
        <div className="emptyStateTitle">No Textnodes selected</div>
        <div className="emptyStateSubtitle">
          <div>
            Labels for localization
            <br />
            will show up here when selected - Select a label in your Design.
          </div>
        </div>
      </div>
      )}
      {localizedLabels.length >= 0 && (
      <div>

        <div className="table" ref={tableRef}>
          {Object.keys(selection).map((mainFrameId) => (
            <LocalizedFrameGroup
              showKey={showKey}
              localizedLabels={localizedLabels.filter((l) => l.rootFrameId === mainFrameId).sort((a, b) => Math.hypot(a.x, a.y * (2) - Math.hypot(b.x, b.y * 2)))}
              selectedNodes={selection[mainFrameId]}
              figmaRemote={figmaRemote}
              localizedLabelManager={localizedLabelManager}
              key={mainFrameId}
            />
          ))}
        </div>
      </div>
      )}
    </>
  );
}
