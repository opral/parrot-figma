import { LocalizedLabel } from "./LocalizedLabel";
import { Plural } from "../base/Plural";
import { LocalizedLabelManager } from "./LocalizedLabelManager";


export class LocalizedLabelManagerUI extends EventTarget {

    cachedLokalisedLabels = {} as { [labelId: string]: 
      LocalizedLabel
    }

    cacheInvalidationIds = {} as { [nodeId: string]: Set<string> } 

    cachedFrames = {} as { [rootFrameId: string]: {
      frameId: string,
      frameName: string, 
      lokalizedLabels: LocalizedLabel[] 
    }}

    localisedLabelMangerSandbox: LocalizedLabelManager

    constructor(localisedLabelMangerSandbox: LocalizedLabelManager) {
      super()
      this.localisedLabelMangerSandbox = localisedLabelMangerSandbox

      window.addEventListener('message', (event : MessageEvent) => {
        if (event.data.pluginMessage.target === 'LocalizedLabelManager') {
          if (event.data.pluginMessage.type === 'cacheUpdate') {
            this.processCacheUpdate(event.data.pluginMessage)
          }
        }
      });
    }

    processCacheUpdate(cacheUpdateMessage: any) {
      
      for (let frameIdToInvalidate of cacheUpdateMessage.rootFrameIdsToReload) {
        console.log('invalidating frame ' + frameIdToInvalidate);
        delete this.cachedFrames[frameIdToInvalidate]
      }

      for (let changedNodeById of cacheUpdateMessage.changedNodesById) {
        let frameIdsToInvalidate = this.cacheInvalidationIds[changedNodeById]
        if (frameIdsToInvalidate) {
          for (let frameIdToInvalidate of frameIdsToInvalidate) {
            console.log('invalidating frame ' + frameIdToInvalidate + ' - changed child');
            delete this.cachedFrames[frameIdToInvalidate]
          }
        }
      }

      for (let deletedNodeId of cacheUpdateMessage.deletedNodeIds) {
        let frameIdsToInvalidate = this.cacheInvalidationIds[deletedNodeId]
        if (frameIdsToInvalidate) {
          for (let frameIdToInvalidate of frameIdsToInvalidate) {
            console.log('invalidating frame ' + frameIdToInvalidate + ' - deleted child');
            delete this.cachedFrames[frameIdToInvalidate]
          }
        }
      }

      for (let changedLabel of cacheUpdateMessage.changedLabels) {
        this.invalidateCacheIfNeeded(changedLabel);
        console.log('label updated '+ changedLabel.nodeId);
        this.cachedLokalisedLabels[changedLabel.nodeId] = changedLabel;
      } 

      const event = new CustomEvent('updated', { });
      this.dispatchEvent(event);
    }

    async updateLocalisedLabelProperties(nodeId: string, changedProperties: { plural: Plural, text: string, showSampleValues: boolean, showSampleValuesInherited: boolean }) {
      let localisedLabel = await this.localisedLabelMangerSandbox.updateLocalisedLabelProperties(nodeId, changedProperties);
      this.cachedLokalisedLabels[nodeId] = localisedLabel;
    }

    async getLocalizedLabelsByFrame(frameId: string) {
        if (this.cachedFrames[frameId]) {
          return this.cachedFrames[frameId];
        }

        let frameData = await this.localisedLabelMangerSandbox.getFrameById(frameId);

        this.cachedFrames[frameId] = {
          frameId: frameId,
          frameName: frameData.name,
          lokalizedLabels: frameData.localizedLabelsInFrame
        }

        for (let freshLocalizedLabel of frameData.localizedLabelsInFrame) {
          this.invalidateCacheIfNeeded(freshLocalizedLabel);          
          this.cachedLokalisedLabels[freshLocalizedLabel.nodeId] = freshLocalizedLabel
        }

        return this.cachedFrames[frameId];
    }

    invalidateCacheIfNeeded(updatedLocalizedLabel: LocalizedLabel) {
      let cachedLabel = this.cachedLokalisedLabels[updatedLocalizedLabel.nodeId];

      if (cachedLabel && cachedLabel.rootFrameId != updatedLocalizedLabel.rootFrameId) {
        delete this.cachedFrames[cachedLabel.rootFrameId];
      }
    }

    async loadAll() {
/*
        console.time('ask for labels ui');
        let localisedLabels = await this.localisedLabelMangerSandbox.loadAll()
        console.timeEnd('ask for labels ui');
        for (let localisedLabel of localisedLabels) {
          this.lokalisedLabels[localisedLabel.nodeId] = localisedLabel;
          if (!this.lokalisedLabelsByFrame[localisedLabel.rootFrameId]) {
            this.lokalisedLabelsByFrame[localisedLabel.rootFrameId] = [localisedLabel]
          } else {
            this.lokalisedLabelsByFrame[localisedLabel.rootFrameId].push(localisedLabel);
          }

          this.lokalisedLabels[localisedLabel.nodeId] = localisedLabel
          
        }*/
    }

}
