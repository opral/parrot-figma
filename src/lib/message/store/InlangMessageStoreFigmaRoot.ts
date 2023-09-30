/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */

import TextEncoding from 'text-encoding';

import blake from 'blakejs';
import { Locale } from '../variants/Locale';
import { Message } from '@inlang/sdk';

const encoder = new TextEncoding.TextEncoder();

export interface Config {
  refLanguage?: Locale,
  enabledLanguages?: Locale[]
}

const defaultStringFillinValue = 'Loren Impsum';
const defaultDecimalFillinValue = 7;
const defaultFloatFillinValue = Math.PI;

export class InlangMessageStore {
  public proxyClassName = 'InlangMessageStore';

  // TODO #14 migration - migrate old config
  public static configDataKey = 'prt_ic';

  /**
   * we store a version map here:
   * [
   *  { name: 'v-1.0.0', description: '', id: string? },
   * ]
   */
  public static tagsDataKey = 'prt_t';

  /**
   * Prefix for messageId's
   * - the head version of a message is stored withing a pluginDataKey of the current document root node
   * - all messages are strored prefixed with the messagePrefix followed by a slot (for collisions) hashed orignal message name
   */
  messagePrefix = 'prt_im__';

  // contains a map from messageId to message hash 
  messageState = { } as {
    [messageId: string]: string
  };

  messageIdToLabels = {} as {
    [messageId: string]: Set<string>
  };

  constructor(asProxy: boolean) {
    if (!asProxy) {
      figma.on('documentchange', this.forwardDocumentChanges.bind(this));
    }
  }

  // eslint-disable-next-line class-methods-use-this
  forwardDocumentChanges(event: any) {
    for (const change of event.documentChanges) {
      if (change.origin === 'LOCAL') {
        // eslint-disable-next-line no-continue
        continue;
      }
      // TODO #14 CACHING implement for multi user - keep track of messages with there hash? we propagated
      // TODO #14 CACHING implement for multi user - keep trac of changes in config as well
      // eslint-disable-next-line default-case
      /* switch (change.type) {
        case 'PROPERTY_CHANGE': {
          if (change.node.parent === null // easy way to check if the node is the root node
          && change.properties.indexOf('pluginData') !== -1) {
            const currentFileStorageKeys = figma.root.getPluginDataKeys().filter((value) => value.indexOf(this.messageHistoryPrefix) === 0);
            let currentCachedMessageIds = Object.keys(this.messageState);

            const changedKeys = {
              deleted: [] as string[],
              updated: [] as string[],
              added: [] as string[],
            };

            for (const currentFileStorageKey of currentFileStorageKeys) {
              const id = currentFileStorageKey.slice(this.messageHistoryPrefix.length);

              if (this.messageState[id] === undefined) {
                if (JSON.parse(figma.root.getPluginData(currentFileStorageKey)).ref === undefined) {
                  changedKeys.added.push(id);
                }
              } else {
                if (figma.root.getPluginData(currentFileStorageKey).length !== this.messageState[id]) {
                  changedKeys.updated.push(id);
                }

                currentCachedMessageIds = currentCachedMessageIds.filter((messageId) => messageId !== id);
              }
            }
            changedKeys.deleted = currentCachedMessageIds;

            for (const deletedKey of currentCachedMessageIds) {
              delete this.messageState[deletedKey];
            }

            if (changedKeys.deleted.length > 0
              || changedKeys.added.length > 0
              || changedKeys.updated.length > 0) {
              figma.ui.postMessage({
                target: 'TranslationKeyStore',
                type: 'cacheUpdate',
                changedKeys,
              });
            }
          }
          break;
        }
      } */
    }
  }

  getConfigSync() {
    const messageRaw = figma.root.getPluginData(InlangMessageStore.configDataKey);

    if (messageRaw === '' || !messageRaw) {
      return {
        refLanguage: undefined,
        enabledLanguages: [],
      } as Config;
    }

    return (JSON.parse(messageRaw) as Config);
  }

  async getConfig() {
    return this.getConfigSync();
  }

  async setConfig(languageConfig: Config) {
    figma.root.setPluginData(InlangMessageStore.configDataKey, JSON.stringify(languageConfig));
  }

  async saveMessage(message: Message): Promise<void> {
    figma.root.setPluginData(this.messagePrefix + message.id, JSON.stringify(message));
  }

  async deleteMessage(id: string): Promise<void> {
    figma.root.setPluginData(this.messagePrefix + id, '');
  }

  async load(): Promise<Message[]> {
    const messages = [] as Message[];
    for (const messageStorageKey of figma.root.getPluginDataKeys()) {
      if (messageStorageKey.startsWith(this.messagePrefix)) {
        const message = JSON.parse(figma.root.getPluginData(messageStorageKey));
        if (message !== undefined) {
          messages.push(message);
        }
      }
    }
    return messages;
  }

  async commitUndo() {
    return figma.commitUndo();
  }
}
