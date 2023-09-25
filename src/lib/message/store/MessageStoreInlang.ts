/* eslint-disable class-methods-use-this */
/* eslint-disable no-await-in-loop */

import TextEncoding from 'text-encoding';

import blake from 'blakejs';
import {
  ProjectSettings, loadProject, getVariant, InlangProject,
} from '@inlang/sdk';
import { createMessage } from '@inlang/sdk/test-utilities';
import { createNodeishMemoryFs } from './inlang/FigmaRootFs';
import { Locale } from '../variants/Locale';
import { Plural } from '../variants/Plural';
import {
  HistoryTag, HistoryEntry, Message, Messages, Fillins, PlaceholderType, Variants,
} from '../Message';
import { MessageUI } from '../MessageUI';
import { Gender } from '../variants/Gender';

const encoder = new TextEncoding.TextEncoder();

export interface Config {
  baseLanguage?: Locale,
  enabledLanguages?: Locale[]
}

const defaultStringFillinValue = 'Loren Impsum';
const defaultDecimalFillinValue = 7;
const defaultFloatFillinValue = Math.PI;

const fs = createNodeishMemoryFs();

export class MessageStoreInlang {
  public proxyClassName = 'MessageStoreInlang';

  inlangProject: InlangProject | undefined;

  constructor(asProxy: boolean) {
    if (!asProxy) {
      // figma.on('documentchange', this.forwardDocumentChanges.bind(this));
    }
  }

  getConfigSync() {
    // TODO #14 get config from inlang project insteadx
    return {
      baseLanguage: undefined,
      enabledLanguages: undefined,
    } as Config;
  }

  async getConfig() {
    return this.getConfigSync();
  }

  async setConfig(languageConfig: Config) {
    // TODO #14 set config in inlang project insteadx
    // figma.root.setPluginData(MessageStoreFigmaRoot.configDataKey, JSON.stringify(languageConfig));
  }

  getHistoryTagsSync() {
    // TODO #14 remove history from parrot
    return [];
  }

  async getHistoryTags() {
    return this.getHistoryTagsSync();
  }

  async createTag(tagId: number, title: string, description: string | undefined) {
    // TODO #14 check how we want to handle tags in parrot
  }

  async getHistory(messageName: string) : Promise<HistoryEntry[]> {
    // TODO #14 check how we want to handle tags in parrot
    return [];
  }

  getHistorySync(messageName: string) {
    return [];
  }

  getMessageByName(name: string) {
    // TODO #14 query inlang project instead
    this.inlangProject!.query.messages.get({ where: { id: name } });
    return undefined;
  }

  getMessage(id: string): Message | undefined {
    this.inlangProject!.query.messages.get({ where: { id } });
    return undefined;
  }

  async getMessageAsync(id: string) {
    return this.getMessage(id);
  }

  private async persistKey(messagePased: Message): Promise<Message> {
    // TODO #14 use inlang to return message
    return messagePased;
  }

  async createMessage(name: string, variants: { locale: Locale; gender: Gender, plural: Plural; text: string | undefined; skip: boolean }[], gender: boolean, plural: boolean, quantity?: { value: number } | { placeholder: string }, defaultFillins?: Fillins): Promise<Message> {
    // TODO #14 use inlang to create message
    const messagesObj = {} as any;
    for (const variant of variants) {
      if (!messagesObj[variant.locale]) {
        messagesObj[variant.locale] = {};
      }

      if (!messagesObj[variant.locale][variant.gender]) {
        messagesObj[variant.locale][variant.gender] = {};
      }

      if (!messagesObj[variant.locale][variant.gender][variant.plural]) {
        messagesObj[variant.locale][variant.gender][variant.plural] = {};
      }

      messagesObj[variant.locale][variant.gender][variant.plural].text = variant.text;
    }

    const unusedId = 'unusedId';
    const placeholders = MessageUI.extractParameters(messagesObj, this.getConfigSync().baseLanguage!, gender, plural);

    return {
      id: unusedId,
      latestVersion: 0,
      name,
      labels: [],
      gender,
      plural,
      variants: messagesObj,
      referencingTextNodes: /* this.messageIdToLabels[name] ? [...this.messageIdToLabels[name]] : */ [],
      placeholders,
      quantity,
      defaultFillins,
      history: [], // first history entry will be added in persistKey method...
      historyTags: [],
    } as Message;
  }

  async updateMessage(id: string, properties: {
    name?: string,
    variants: { locale: Locale; plural: Plural; gender: Gender, text: string | undefined; skip: boolean }[],
    gender?: boolean,
    plural?: boolean,
    quantity?: { value: number } | { placeholder: string },
    fillins?: Fillins
  }): Promise<Message> {
    const messageToUpdate = this.getMessage(id);
    // TODO #14 use inlangs update method
    return messageToUpdate!;
  }

  async deleteMessage(id: string): Promise<void> {
    // TODO #14 delete via inlang

  }


  async commitUndo() {
    return figma.commitUndo();
  }
}
