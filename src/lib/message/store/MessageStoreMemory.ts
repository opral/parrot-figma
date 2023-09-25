/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import {
  ProjectSettings, loadProject, getVariant, InlangProject,
} from '@inlang/sdk';
import { createMessage } from '@inlang/sdk/test-utilities';
import type { Message, Pattern } from '@inlang/message';
import { Locale } from '../variants/Locale';
import { Plural, getPluralFormsByLanguage } from '../variants/Plural';
import { Config, MessageStoreInlang } from './MessageStoreInlang';

import { NodeSelection } from '../../localizedlabels/LocalizedLabelManager';
import { Gender, genderList } from '../variants/Gender';
import { createNodeishMemoryFs } from './inlang/FigmaRootFs';

export type SearchQuery = {
  selected?: 'FRAME' | 'LABEL' | undefined,
  hasLabel?: string[] | undefined,
  oneLabelOf?: string[] | undefined,
  unverified?: boolean | undefined,
  missingTranslation?: boolean | undefined,
  name?: string | undefined,
  nameAtEnd?: boolean | undefined,
  text?: string | undefined,
  exactText?: boolean | undefined,
  searchString?: string | undefined,
};

export type SearchResult = {

  inNames: Set<string>,
  inText: Set<string>,
  withMissingVariants: Set<string>,
  withMissingVariantsPerLanguage: {
    [language in Locale]? : Set<string>
  },
  withMissingReview: Set<string>,
  matchingNames: Set<string>,
  referencedInFrame: Set<string>,
  referencedInLabels: Set<string>,
  matches: { [messageId: string] : {
    messageNameMatch: { start: number, length: number } | undefined,
    textMatches: {
      [language in Locale]?: { [gender in Gender]?: { [plural in Plural]?: { start: number, length: number } } }
    }
  } },

};

export interface MessagesUI {
  [messageName: string]: MessageUI
}

const fs = createNodeishMemoryFs();

export default class MessageStoreMemory extends EventTarget {
  config: Config | undefined;

  inlangProject: InlangProject | undefined;

  constructor(parentKeyStore: MessageStoreInlang) {
    super();

    window.addEventListener('message', (event : MessageEvent) => {
      if (event.data.pluginMessage.target === 'TranslationKeyStore') {
        if (event.data.pluginMessage.type === 'cacheUpdate') {
          // TODO #15 make this part of the FS
          // this.processCacheUpdate(event.data.pluginMessage.changedKeys, event.data.pluginMessage.updatedHistoryTags);
        }
      }
    });
  }

  public async updateMessageLinks(messageIds: string[]) {
    // TODO #14 rething message links
    /*
    const changes = {
      updated: [] as string[],
      changedKeys: messageIds,
    };

    for (const updatedKeyLink of messageIds) {
      const message = await this.parentKeyStore.getMessageAsync(updatedKeyLink);
      if (message) {
        this.upsertCache(message);
      }
    }

    const event = new CustomEvent<any>('updated', { detail: changes });
    this.dispatchEvent(event);
    */
  }

  private async processCacheUpdate(changedMessages: { deleted: string[], added: string[], updated: string[] }, updatedHistoryTags: HistoryTag[] | undefined) {
    // TODO #14 handle updated comming from the fs in inlang
    /*
    const changes = {
      deleted: [] as string[],
      updated: [] as string[],
      added: [] as string[],
      changedKeys: [] as string[],
      historyTags: updatedHistoryTags,
    };

    if (updatedHistoryTags) {
      this.historyTags = updatedHistoryTags;
    }

    for (const deltedKey of changedMessages.deleted) {
      this.removeCache(deltedKey);
      changes.deleted.push(deltedKey);
      changes.changedKeys.push(deltedKey);
    }

    for (const updatedMessage of changedMessages.updated) {
      const freshKey = await this.parentKeyStore.getMessageAsync(updatedMessage);
      if (!freshKey) {
        throw new Error(`fresh message does not exist... [${updatedMessage}]`);
      }

      this.upsertCache(freshKey);
      changes.updated.push(updatedMessage);
      changes.changedKeys.push(updatedMessage);
    }

    for (const addedKey of changedMessages.added) {
      const freshKey = await this.parentKeyStore.getMessageAsync(addedKey);
      if (!freshKey) {
        throw new Error(`fresh message does not exist... [${addedKey}]`);
      }

      this.upsertCache(freshKey);
      changes.added.push(addedKey);
      changes.changedKeys.push(addedKey);
    }

    const event = new CustomEvent<any>('updated', { detail: changes });
    this.dispatchEvent(event);
    */
  }

  getLanugages(): Locale[] | undefined {
    // TODO #14 update to use inlangs project
    return this.config!.enabledLanguages;
  }

  async setLanguages(languages: Locale[]) {
    this.config!.enabledLanguages = languages;
    // TODO #14 update config within inlangs project
    // this.inlangProject?.setSettings()
    // const parentConfig = await this.parentKeyStore.getConfig();

    // parentConfig.enabledLanguages = languages;
    // await this.parentKeyStore.setConfig(parentConfig);
  }

  getBaseLanugage(): Locale | undefined {
    // TODO #14 update to use inlangs project
    return this.config!.baseLanguage;
  }

  async setBaseLanguage(language: Locale) {
    this.config!.baseLanguage = language;
    // TODO #14 set baselanguage in inlang project
    // const parentConfig = await this.parentKeyStore.getConfig();
    // parentConfig.baseLanguage = language;
    // await this.parentKeyStore.setConfig(parentConfig);
  }

  getMessagesByMessageName(language: Locale, versionId: string): { [messageName: string]: Message } {
    const messages = {} as { [id: string]: Message };

    // TODO #14 used by exporter - rewrite exporter to use inlangs project directly
    // const tagIndex = versionId ? this.getTagIndexByVersionId(versionId) : -1;

    // for (const messageId of Object.keys(this.messages)) {
    //   const currentMessage = this.messages[messageId];
    //   if (tagIndex >= 0) {
    //     const messageVersion = currentMessage.getMessageVersionByTagIndex(tagIndex);
    //     if (messageVersion !== undefined) {
    //       const messageInVersion = currentMessage.getInVersion(messageVersion);
    //       messages[messageInVersion.name] = messageInVersion;
    //     }
    //   } else if (currentMessage.variants[language]) {
    //     messages[currentMessage.name] = currentMessage;
    //   }
    // }

    return messages;
  }

  getMessage(id: string) : Message | undefined {
    // TOOD #14 use inlang Message as return instead of UI
    return this.inlangProject!.query.messages.get({ where: { id } });
  }

  getMessageByName(messageName: string) : Message | undefined {
    // TOOD #14 use inlang Message as return instead of UI
    return this.inlangProject!.query.messages.get({ where: { id: messageName } });
  }

  static toSearchString(searchQuery: SearchQuery): string {
    let searchString = '';
    if (searchQuery.selected === 'FRAME') {
      searchString += 'selected:FRAME ';
    }

    if (searchQuery.selected === 'LABEL') {
      searchString += 'selected:LABEL ';
    }

    if (searchQuery.hasLabel && searchQuery.hasLabel.length > 0) {
      searchString += `label:${searchQuery.hasLabel.join(' label:')} `;
    }

    if (searchQuery.oneLabelOf && searchQuery.oneLabelOf.length > 0) {
      searchString += `one_label_of:${searchQuery.oneLabelOf.join(',')} `;
    }

    if (searchQuery.unverified !== undefined) {
      searchString += `unverified:${searchQuery.unverified ? 'true' : 'false'} `;
    }

    if (searchQuery.missingTranslation !== undefined) {
      searchString += `missing_translation:${searchQuery.missingTranslation ? 'true' : 'false'} `;
    }

    if (searchQuery.exactText === true) {
      searchString += 'exact_text:true ';
    }

    if (searchQuery.name !== undefined) {
      searchString += `name:${searchQuery.name}`;
      if (!searchQuery.nameAtEnd) {
        searchString += ' ';
      }
    }

    searchString += searchQuery.text;

    return searchString;
  }

  static toQueryObject(searchString: string): SearchQuery {
    const searchQueryObj = {
      selected: undefined,
      hasLabel: [],
      oneLabelOf: [],
      verified: undefined,
      name: undefined,
      nameAtEnd: false,
      text: '',
      exactText: false,
      searchString,
    } as SearchQuery;

    let processedInputString = searchString;

    // extract the text surrounded by quotest first:
    const textInQuotesRe = /"((?:[^"\\]|\\.)*)"(?![^\\]*\\)/g;
    const quotedTextMatches = processedInputString.match(textInQuotesRe);

    if (quotedTextMatches) {
      for (const quotedTextMatch of quotedTextMatches) {
        searchQueryObj.text += quotedTextMatch;
        processedInputString = searchString.split(quotedTextMatch).join('');
      }
    }

    // extract and remove all filters
    const filterRe = /((\b\w+:[\w,*:]+))\s/g;
    const filterMatches = processedInputString.match(filterRe);
    const filters = [] as string[];

    if (filterMatches) {
      for (const filterMatch of filterMatches!.sort((match) => match.length)) {
        const filterParts = filterMatch.split(' ').join('').split(':');
        if (filterParts[0] === 'selected') {
          if (filterParts[1] === 'FRAME') {
            searchQueryObj.selected = 'FRAME';
          } else if (filterParts[1] === 'LABEL') {
            searchQueryObj.selected = 'LABEL';
          }
        } else if (filterParts[0] === 'label' && filterParts.length > 1) {
          searchQueryObj.hasLabel!.push(filterParts[1]);
        } else if (filterParts[0] === 'one_label_of' && filterParts.length > 1) {
          searchQueryObj.oneLabelOf = searchQueryObj.oneLabelOf!.concat(filterParts[1].split(','));
        } else if (filterParts[0] === 'missing_translation' && filterParts.length > 1) {
          searchQueryObj.missingTranslation = filterParts[1] === 'true';
        } else if (filterParts[0] === 'unverified' && filterParts.length > 1) {
          searchQueryObj.unverified = filterParts[1] === 'true';
        } else if (filterParts[0] === 'exact_text' && filterParts.length > 1) {
          searchQueryObj.exactText = filterParts[1] === 'true';
        } else if (filterParts[0] === 'name' && filterParts.length > 1) {
          // eslint-disable-next-line prefer-destructuring
          searchQueryObj.name = filterParts[1];
        } else {
          // eslint-disable-next-line no-continue
          continue;
        }

        filters.push(filterMatch.split(' ').join(''));
        processedInputString = processedInputString.split(filterMatch).join('');
      }
    }

    if (!searchQueryObj.name) {
      // the regex expects a leading space - if we haven't found the name filter yet - try to find it at
      // the very end

      const nameAtTheEnd = /name:([\w,*:]+)$/g;
      const matches = processedInputString.match(nameAtTheEnd);
      if (matches) {
        // eslint-disable-next-line prefer-destructuring
        searchQueryObj.name = matches[0].split(':')[1];
        processedInputString = processedInputString.split(matches[0]).join('');
        searchQueryObj.nameAtEnd = true;
      }
    }

    // extract the rest as text if none was found previously
    if (searchQueryObj.text === '') {
      searchQueryObj.text = processedInputString;
    }

    return searchQueryObj;
  }

  /**
   * what do we want to search
   * "emission"
   *  - all messageNames with "emission" in their name
   * or
   *  - all messageNames with "emission" in their text
   * or
   *  - all messageNames with a tag called "emmission"
   *
   * name:emision
   *  - all messageNames with emmision in their name
   *    - asterix not adding a lot of value
   *
   * text:"emision"
   *  - all messageNames with emmision in thair text
   *
   * "translation:missing:de"
   * "translation:complete"
   *
   * "one_tag_of:tag_a,tag_b,"
   * "tag:tag_a"
   *
   * "verified:true"
   *
   *
   * " verified:true "
   *
   * messageNames:asdasd_asdasd_asd
   *
   * all filter but text have no space, and a leading no space name spearated by colon
   *
   *
   */
  findMessages(query: SearchQuery, selection?: NodeSelection): SearchResult {
    const results = {
      inNames: new Set<string>(),
      inText: new Set<string>(),
      withMissingVariants: new Set<string>(),
      withMissingVariantsPerLanguage: { } as {
        [language in Locale]? : Set<string>
      },
      withMissingReview: new Set<string>(),
      matchingNames: new Set<string>(),
      referencedInFrame: new Set<string>(),
      referencedInLabels: new Set<string>(),
      matches: {} as { [name:string] : {
        messageNameMatch: { start: number, length: number } | undefined,
        textMatches: {
          [language in Locale]?: { [gender in Gender]?: { [plural in Plural]?: { start: number, length: number } } }
        }
      } },
    };

    if (selection) {
      Object.values(selection).forEach((selectedNode) => {
        if (selectedNode.messageId !== undefined) {
          if (!selectedNode.directSelection) {
            results.referencedInLabels.add(selectedNode.messageId);
          }
          results.referencedInFrame.add(selectedNode.messageId);
        }
      });
    }

    for (const message of Object.values(this.messages)) {
      for (const locale of this.getLanugages()!) {
        for (const gender of genderList) {
          for (const plural of getPluralFormsByLanguage(locale as Locale)) {
            const variant = message.variants[locale]?.[gender]?.[plural];
            if (query.text === undefined || query.text === '') {
              results.matchingNames.add(message.id);
            } else if (variant?.text !== undefined) {
              const matchStartText = variant!.text!.toLowerCase().indexOf(query.text.toLowerCase());
              if ((query.exactText && matchStartText === 0 && variant!.text!.length === query.text.length)
                || (!query.exactText && matchStartText !== -1)) {
                if (!results.matches[message.id]) {
                  results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
                }

                if (!results.matches[message.id].textMatches![locale as Locale]) {
                  results.matches[message.id].textMatches![locale as Locale]! = {};
                }

                if (!results.matches[message.id].textMatches![locale as Locale]![gender as Gender]) {
                  results.matches[message.id].textMatches![locale as Locale]![gender as Gender] = {};
                }

                results.matches[message.id].textMatches![locale as Locale]![gender as Gender]![plural as Plural] = { start: matchStartText, length: query.text.length };
                results.matchingNames.add(message.id);
                results.inText.add(message.id);
              }
            }

            if (variant?.text === undefined) {
              if (variant?.skip !== true) {
                if (message.plural || plural === Plural.OTHER) {
                  if ((!variant?.text || variant?.text === '')) {
                    if (message.plural || plural === Plural.OTHER) {
                      results.withMissingVariants.add(message.id);

                      if (results.withMissingVariantsPerLanguage[locale] === undefined) {
                        results.withMissingVariantsPerLanguage[locale] = new Set<string>();
                      }
                      results.withMissingVariantsPerLanguage[locale]!.add(message.id);
                    }
                  }
                }
              }
            }

            if (variant && !variant!.verified) {
              results.withMissingReview.add(message.id);
            }
          }
        }
      }

      if (query.name) {
        if (query.name !== '*') {
          const mameMatchStart = message.name.toLowerCase().indexOf(query.name.toLowerCase());

          if (mameMatchStart === 0) {
            if (!results.matches[message.id]) {
              results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
            }
            results.matches[message.id].messageNameMatch = { start: mameMatchStart, length: query.name.length };
            results.inNames.add(message.id);
          } else {
            // eslint-disable-next-line no-continue
            results.matchingNames.delete(message.id);
          }
        }
      } else if (query.text !== undefined && query.text !== '') {
        const nameMatchStart = message.name.toLowerCase().indexOf(query.text.toLowerCase());
        if (nameMatchStart !== -1) {
          if (!results.matches[message.id]) {
            results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
          }
          results.matches[message.id].messageNameMatch = { start: nameMatchStart, length: query.text.length };
          results.inNames.add(message.id);
          results.matchingNames.add(message.id);
        }
      }
    }

    results.withMissingReview = new Set([...results.withMissingReview].filter((x) => results.matchingNames.has(x)));
    results.withMissingVariants = new Set([...results.withMissingVariants].filter((x) => results.matchingNames.has(x)));

    if (query.missingTranslation === true) {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => results.withMissingVariants.has(x)));
    } else if (query.missingTranslation === false) {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => !results.withMissingVariants.has(x)));
    }

    if (query.unverified === true) {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => results.withMissingReview.has(x)));
    } else if (query.unverified === false) {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => !results.withMissingReview.has(x)));
    }

    if (query.selected === 'FRAME') {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => results.referencedInFrame.has(x)));
    } else if (query.selected === 'LABEL') {
      results.matchingNames = new Set([...results.matchingNames].filter((x) => results.referencedInLabels.has(x)));
    }

    // in case we have no specific we want to suggest specific like
    // - matches in messageNames (n)
    // - matches in text (n)
    // - with missing messages (n)
    // - with missing review (n)
    return results;
  }

  async createTag(title: string, description: string | undefined) {
    /* TODO #14 we skip this in inlang for now
    // TODO #11 we update the messages here - shouldn't we wait for the messaage bus instead?
    const tagId = this.historyTags.length;
    for (const messageId of Object.keys(this.messages)) {
      this.messages[messageId].historyTags[tagId] = this.messages[messageId].latestVersion;
    }

    this.historyTags[tagId] = await this.parentKeyStore.createTag(tagId, title, description);
    return this.historyTags[tagId];
    */
  }

  async createMessage(name: string, messages: { locale: Locale; gender: Gender, plural: Plural; text: string | undefined; skip: boolean }[], gender: boolean, plural: boolean, fillins?: Fillins, quantity?: { value: number } | { placeholder: string }): Promise<Message> {
    if (name === '') {
      throw new Error('message name must have at least one character');
    }
    // TODO #14 create message in inlang project
    const createdMessage = await this.parentKeyStore.createMessage(name, messages, gender, plural, quantity, fillins);
    return this.upsertCache(createdMessage);
  }

  async updateMessage(id: string, properties: {
    name?: string,
    variants: { locale: Locale, gender: Gender, plural: Plural, text: string | undefined, skip: boolean }[],
    gender?: boolean,
    plural?: boolean,
    fillins?: Fillins,
    quantity?: { value: number } | { placeholder: string }
  }) {
    // TODO #14 update message in inlang project
    const updatedMessage = await this.parentKeyStore.updateMessage(id, properties);
    return this.upsertCache(updatedMessage);
  }

  async deleteMessage(id: string) {
    // await this.parentKeyStore.deleteMessage(id);
    this.inlangProject?.query.messages.delete({ where: { id } });
    // TODO #14 listen on deletions to propagate changes
    // this.removeCache(id);
  }

  private async loadInlang() {
    const messages = {} as Messages;

    // creating a project file
    const config = {
      sourceLanguageTag: 'en',
      modules: ['./plugin.js'],
      languageTags: ['en', 'de'],
    } satisfies ProjectSettings;

    // writing the project file to the virtual filesystem
    await fs.writeFile('/project.inlang.json', JSON.stringify(config));

    // opening the project file and loading the plugin
    this.inlangProject = await loadProject({
      nodeishFs: fs,
      settingsFilePath: '/project.inlang.json',
      // simulate the import function that the SDK uses
      // to inject the plugin into the project
      _import: async () => {
        console.log('import called');
        return {
          default: {
          // id: id as Plugin["id"],
            id: 'plugin.organization.pluginName', // as Plugin['id'],
            displayName: { en: 'test' }, // as Plugin['displayName'],
            description: { en: 'test' }, // as Plugin['description'],
            // displayName,
            // description,
            loadMessages: async () => {
              const fakeMessages = [
                createMessage('this-is-a-test-message', {
                  en: 'Hello world!',
                  de: 'Hallo welt!',
                }),
                createMessage('this-is-a-test-message-2', {
                  en: 'Hello world2!',
                  de: 'Hallo welt2!',
                }),
              ] as any[];
              return fakeMessages;
            },
            saveMessages: () => {

            },
          },

        };
        // return import('./inlang/FigmaPlugin');
      },
    });
    for (const inlangMessage of this.inlangProject.query.messages.getAll()) {
      const messageVariants = {} as Variants;
      for (const variant of inlangMessage.variants) {
        messageVariants[variant.languageTag as Locale] = {
          [Gender.NEUTRAL]: {
            [Plural.OTHER]: {
              version: 0,
              verified: false,
              skip: false,
              text: (variant.pattern[0] as any).value,
            },
          },
        };
      }
      messages[inlangMessage.id] = {
        id: inlangMessage.id,
        history: [],
        name: inlangMessage.id,
        latestVersion: 1,
        historyTags: { },
        labels: [],
        referencingTextNodes: [],
        gender: false,
        plural: false,
        variants: messageVariants,
        quantity: { value: 1 },
        placeholders: {},
        defaultFillins: {},
      };
    }

    return messages;
  }

  async load(): Promise<Readonly<Message[]>> {
    // TODO #14 get from real config eventual use figma util
    // TODO #14 load config from figma helper await this.parentKeyStore.getConfig();
    this.config = {
      baseLanguage: Locale.EN,
      enabledLanguages: [Locale.EN, Locale.DE],
    };

    await this.loadInlang();
    return this.inlangProject!.query.messages.getAll();
  }
}
