/* eslint-disable no-plusplus */
/* eslint-disable no-await-in-loop */
import {
  loadProject,
  getVariant,
  InlangProject,
  updateVariantPattern,
  createVariant,
} from '@inlang/sdk';
import { Message, Pattern } from '@inlang/sdk';

import { Repository, openRepository } from '@lix-js/client';
import { NodeishFilesystem } from '@lix-js/fs';
import { Locale } from '../variants/Locale';
import { Plural } from '../variants/Plural';

import { NodeSelection } from '../../localizedlabels/LocalizedLabelManager';
import { Gender, genderList } from '../variants/Gender';
import { createNodeishMemoryFs } from './inlang/FigmaRootFs';
import { Config, InlangMessageStore } from './MessageStoreFigmaRoot';
import { MessageParameterValues } from '../MessageParameterValues';
import PlaceholderHelper from '../PlaceholderUtil';

export type SearchQuery = {
  selected?: 'FRAME' | 'LABEL' | undefined;
  hasLabel?: string[] | undefined;
  oneLabelOf?: string[] | undefined;
  unverified?: boolean | undefined;
  missingTranslation?: boolean | undefined;
  name?: string | undefined;
  nameAtEnd?: boolean | undefined;
  text?: string | undefined;
  exactText?: boolean | undefined;
  searchString?: string | undefined;
};

export type SearchResult = {
  inNames: Set<string>;
  inText: Set<string>;
  withMissingVariants: Set<string>;
  withMissingVariantsPerLanguage: {
    [language in Locale]?: Set<string>;
  };
  withMissingReview: Set<string>;
  matchingNames: Set<string>;
  referencedInFrame: Set<string>;
  referencedInLabels: Set<string>;
  matches: {
    [messageId: string]: {
      messageNameMatch: { start: number; length: number } | undefined;
      textMatches: {
        [language in Locale]?: {
          [gender in Gender]?: { [plural in Plural]?: { start: number; length: number } };
        };
      };
    };
  };
};

const projectFolder = '/project.inlang';
const messagePath = `${projectFolder}/messages/`;

const PUBLIC_GIT_PROXY_BASE_URL = 'http://localhost:3001';
const host = 'github.com';
const owner = 'martin-lysk';
const repository = 'example';

export default class MessageStoreMemory extends EventTarget {
  config: Config = {};

  repo: Repository | undefined;

  inlangProject: InlangProject | undefined;

  // parentKeyStore: InlangMessageStore;

  fs: NodeishFilesystem;

  async pushChanges() {
    // stage all changes
    const status = await this.repo!.statusMatrix({
      filter: (f: any) =>
        f.endsWith('.json') ||
        f.endsWith('.po') ||
        f.endsWith('.yaml') ||
        f.endsWith('.yml') ||
        f.endsWith('.js') ||
        f.endsWith('.ts'),
    });

    await this.repo!.pull({
      author: {
        name: 'test',
        email: 'test@test.test',
      },
      fastForward: true,
      singleBranch: true,
    });

    const filesWithUncommittedChanges = status.filter(
      (row: any) =>
        // files with unstaged and uncommitted changes
        (row[2] === 2 && row[3] === 1) ||
        // added files
        (row[2] === 2 && row[3] === 0),
    );
    if (filesWithUncommittedChanges.length > 0) {
      // add all changes
      for (const file of filesWithUncommittedChanges) {
        await this.repo!.add({ filepath: file[0] });
      }
      // commit changes
      await this.repo!.commit({
        author: {
          name: 'test',
          email: 'test@test.test',
        },
        message: 'inlang: update translations',
      });

      const push = await this.repo!.push();
      if (push?.ok === false) {
        return 'ERROR';
      }
    }
    return 'success';
  }

  watcher: any;

  constructor(fs: NodeishFilesystem) {
    super();
    // this.parentKeyStore = parentKeyStore;
    this.fs = fs;

    const httpPath = `${PUBLIC_GIT_PROXY_BASE_URL}/git/${host}/${owner}/${repository}`;
    openRepository(httpPath, {
      nodeishFs: fs,
      auth: false,
      branch: 'main',
    }).then((repo) => {
      this.repo = repo;
      console.log(repo);
      // this.repo = repo
      let pushed = false;

      const startWatching = async () => {
        try {
          this.watcher = this.fs.watch('/project.inlang/', {
            // TODO #1844  - check who would signal here -
            // signal: abortController.signal,
            persistent: false,
            recursive: true,
          });
          if (this.watcher) {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            for await (const event of this.watcher) {
              console.log('change detected - push!');
              if (!pushed) {
                pushed = true;
                setTimeout(() => {
                  pushed = false;
                }, 2000);
                this.pushChanges();
              }
            }
          }
        } catch (err: any) {
          if (err.name === 'AbortError') return;
          // https://github.com/inlang/monorepo/issues/1647
          // the file does not exist (yet)
          // this is not testable beacause the fs.watch api differs
          // from node and lix. lenghty
          if (err.code === 'ENOENT') return;
          throw err;
        }
      };
      startWatching();
    });

    //   ;(async () => {
    //     try {
    //       const watcher = nodeishFs.watch(messageFolderPath, {
    //         // TODO #1844  - check who would signal here -
    //         // signal: abortController.signal,
    //         persistent: false,
    //         recursive: true,
    //       })
    //       if (watcher) {
    //         //eslint-disable-next-line @typescript-eslint/no-unused-vars
    //         for await (const event of watcher) {
    //           if (!event.filename) {
    //             throw new Error("filename not set in event...")
    //           }

    //           let fileContent: string | undefined
    //           // TODO #1844 lets read the message and reload it
    //           try {
    //             fileContent = await nodeishFs.readFile(
    //               messageFolderPath + "/" + event.filename!,
    //               { encoding: "utf-8" }
    //             )
    //           } catch (e) {
    //             // TODO #1844 check for file not exists - ENOENT and rethrow if different error
    //             // if (e.code !== 'ENOENT') {
    //             // 	throw e;
    //             // }
    //             // deleted = true;
    //             // file does not exis - drop message in inlang project
    //           }

    //           const messageId = getMessageIdFromPath(event.filename)

    //           if (!fileContent) {
    //             messagesQuery.delete({ where: { id: messageId } })
    //           } else {
    //             const message = parseMessage(fileContent)
    //             const currentMessage = messagesQuery.get({ where: { id: messageId } })
    //             if (currentMessage && encodeMessage(currentMessage) === fileContent) {
    //               continue
    //             }

    //             messagesQuery.upsert({ where: { id: messageId }, data: message })
    //           }
    //         }
    //       }
    //     } catch (err: any) {
    //       if (err.name === "AbortError") return
    //       // https://github.com/inlang/monorepo/issues/1647
    //       // the file does not exist (yet)
    //       // this is not testable beacause the fs.watch api differs
    //       // from node and lix. lenghty
    //       else if (err.code === "ENOENT") return
    //       throw err
    //     }
    //   })()
    // })

    // window.addEventListener('message', (event : MessageEvent) => {
    //   if (event.data.pluginMessage.target === 'TranslationKeyStore') {
    //     if (event.data.pluginMessage.type === 'cacheUpdate') {
    //       this.processCacheUpdate(event.data.pluginMessage.changedKeys);
    //     }
    //   }
    // });
  }

  public async updateMessageLinks(messageIds: string[]) {
    // TODO #22 CACHING rethink message links
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

    const event = new CustomEvent<any>(MessageStoreMemory.updateEventName, { detail: changes });
    this.dispatchEvent(event);
    */
  }

  static UPDATE_EVENT = 'updated';

  // private async processCacheUpdate(changedMessages: { deleted: string[], added: string[], updated: string[] }) {
  //   const changes = {
  //     deleted: [] as string[],
  //     updated: [] as string[],
  //     added: [] as string[],
  //     changedKeys: [] as string[],
  //   };

  //   for (const deltedMessageId of changedMessages.deleted) {
  //     this.inlangProject?.query.messages.delete({ where: { id: deltedMessageId } });
  //     changes.deleted.push(deltedMessageId);
  //     changes.changedKeys.push(deltedMessageId);
  //   }

  //   for (const updatedMessageId of changedMessages.updated) {
  //     const freshMessage = await this.parentKeyStore.getMessageAsync(updatedMessageId);
  //     if (!freshMessage) {
  //       throw new Error(`fresh message does not exist... [${updatedMessageId}]`);
  //     }

  //     this.inlangProject?.query.messages.upsert({ where: { id: freshMessage.id }, data: freshMessage });
  //     changes.updated.push(updatedMessageId);
  //     changes.changedKeys.push(updatedMessageId);
  //   }

  //   for (const addedMessageId of changedMessages.added) {
  //     const freshMessage = await this.parentKeyStore.getMessageAsync(addedMessageId);
  //     if (!freshMessage) {
  //       throw new Error(`fresh message does not exist... [${addedMessageId}]`);
  //     }
  //     this.inlangProject?.query.messages.upsert({ where: { id: freshMessage.id }, data: freshMessage });
  //     changes.added.push(addedMessageId);
  //     changes.changedKeys.push(addedMessageId);
  //   }

  //   const event = new CustomEvent<any>(MessageStoreMemory.UPDATE_EVENT, { detail: changes });
  //   this.dispatchEvent(event);
  // }

  getLanugages(): Locale[] | undefined {
    if (this.inlangProject) {
      return this.inlangProject.settings().languageTags as Locale[];
    }
    return this.config.enabledLanguages;
  }

  async setLanguages(languages: Locale[]) {
    this.config.enabledLanguages = languages;

    if (this.inlangProject === undefined) {
      if (this.config.enabledLanguages && this.config.refLanguage) {
        this.loadInlangProject();
      }
    } else {
      this.inlangProject.settings().languageTags = languages;
      // const { sourceLanguageTag } = this.inlangProject.settings();
      // // await this.parentKeyStore.setConfig(parentConfig);

      // // forwared languages to inlang project - if initialzied already
      // this.inlangProject.setSettings({
      //   sourceLanguageTag,
      //   languageTags: languages as string[],
      //   modules: [],
      // });
    }
  }

  getRefLanugage(): Locale | undefined {
    if (this.inlangProject) {
      const settings = this.inlangProject.settings();
      return settings.sourceLanguageTag as Locale;
    }
    return this.config!.refLanguage;
  }

  async setRefLanguage(language: Locale) {
    this.config.refLanguage = language;

    if (this.inlangProject === undefined) {
      if (this.config.enabledLanguages && this.config.refLanguage) {
        this.loadInlangProject();
      }
    } else {
      this.inlangProject.settings().sourceLanguageTag = language;
      // // TODO #28 check if we can set the single property as well
      // // TODO #28 check if we neeed the languages on load?
      // const { languageTags } = this.inlangProject.settings();
      // // await this.parentKeyStore.setConfig(parentConfig);

      // // forwared languages to inlang project - if initialzied already
      // this.inlangProject.setSettings({
      //   sourceLanguageTag: language,
      //   languageTags,
      //   modules: [],
      // });
    }
  }

  getMessage(id: string): Message | undefined {
    return this.inlangProject!.query.messages.get({ where: { id } });
  }

  getMessageByName(messageName: string): Message | undefined {
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
      withMissingVariantsPerLanguage: {} as {
        [language in Locale]?: Set<string>;
      },
      withMissingReview: new Set<string>(),
      matchingNames: new Set<string>(),
      referencedInFrame: new Set<string>(),
      referencedInLabels: new Set<string>(),
      matches: {} as {
        [name: string]: {
          messageNameMatch: { start: number; length: number } | undefined;
          textMatches: {
            [language: string]: { [matches: string]: { start: number; length: number } };
          };
        };
      },
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

    if (!this.inlangProject) {
      return results;
    }

    for (const message of Object.values(this.inlangProject!.query.messages.getAll())) {
      if (query.text === undefined || query.text === '') {
        results.matchingNames.add(message.id);
      } else {
        for (const messageVariant of message.variants) {
          const patternsLower = messageVariant.pattern
            .map((pattern) => {
              if (pattern.type === 'Text') {
                return pattern.value.toLowerCase();
              }
              if (pattern.type === 'VariableReference') {
                return pattern.name.toLowerCase();
              }
              return '';
            })
            .join('');

          const matchStartText = patternsLower.indexOf(query.text.toLowerCase());

          if (matchStartText !== -1) {
            if (!results.matches[message.id]) {
              results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
            }

            if (!results.matches[message.id].textMatches![messageVariant.languageTag]) {
              results.matches[message.id].textMatches![messageVariant.languageTag]! = {};
            }

            if (!results.matches[message.id].textMatches![messageVariant.languageTag]!['*']) {
              results.inText.add(message.id);
              results.matchingNames.add(message.id);
              results.matches[message.id].textMatches![messageVariant.languageTag]!['*'] = {
                start: matchStartText,
                length: query.text.length,
              };
            }
          }
        }
      }

      if (query.name) {
        if (query.name !== '*') {
          const mameMatchStart = message.id.toLowerCase().indexOf(query.name.toLowerCase());

          if (mameMatchStart === 0) {
            if (!results.matches[message.id]) {
              results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
            }
            results.matches[message.id].messageNameMatch = {
              start: mameMatchStart,
              length: query.name.length,
            };
            results.inNames.add(message.id);
          } else {
            // eslint-disable-next-line no-continue
            results.matchingNames.delete(message.id);
          }
        }
      } else if (query.text !== undefined && query.text !== '') {
        const nameMatchStart = message.id.toLowerCase().indexOf(query.text.toLowerCase());
        if (nameMatchStart !== -1) {
          if (!results.matches[message.id]) {
            results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
          }
          results.matches[message.id].messageNameMatch = {
            start: nameMatchStart,
            length: query.text.length,
          };
          results.inNames.add(message.id);
          results.matchingNames.add(message.id);
        }
      }
    }

    results.withMissingReview = new Set(
      [...results.withMissingReview].filter((x) => results.matchingNames.has(x)),
    );
    results.withMissingVariants = new Set(
      [...results.withMissingVariants].filter((x) => results.matchingNames.has(x)),
    );

    if (query.missingTranslation === true) {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => results.withMissingVariants.has(x)),
      );
    } else if (query.missingTranslation === false) {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => !results.withMissingVariants.has(x)),
      );
    }

    if (query.unverified === true) {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => results.withMissingReview.has(x)),
      );
    } else if (query.unverified === false) {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => !results.withMissingReview.has(x)),
      );
    }

    if (query.selected === 'FRAME') {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => results.referencedInFrame.has(x)),
      );
    } else if (query.selected === 'LABEL') {
      results.matchingNames = new Set(
        [...results.matchingNames].filter((x) => results.referencedInLabels.has(x)),
      );
    }

    // in case we have no specific we want to suggest specific like
    // - matches in messageNames (n)
    // - matches in text (n)
    // - with missing messages (n)
    // - with missing review (n)
    return results;
  }

  async createTag() {
    /* TODO #17 versioning we skip this in inlang for now
    // TODO #18 we update the messages here - shouldn't we wait for the messaage bus instead?
    const tagId = this.historyTags.length;
    for (const messageId of Object.keys(this.messages)) {
      this.messages[messageId].historyTags[tagId] = this.messages[messageId].latestVersion;
    }

    this.historyTags[tagId] = await this.parentKeyStore.createTag(tagId, title, description);
    return this.historyTags[tagId];
    */
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async upsertMessage(message: Message, _defaultParameters: MessageParameterValues) {
    // TODO #18 variables - store the default parameters for this message ( we no longer store them in the message it self )
    this.upsertedMessageIds.add(message.id);
    this.inlangProject?.query.messages.upsert({ where: { id: message.id }, data: message });

    const changes = {
      deleted: [] as string[],
      updated: [] as string[],
      added: [] as string[],
      changedKeys: [] as string[],
    };

    changes.changedKeys.push(message.id);

    // make sure the event is fired after the messages returned the updated message
    setTimeout(() => {
      const event = new CustomEvent<any>(MessageStoreMemory.UPDATE_EVENT, { detail: changes });
      this.dispatchEvent(event);
    }, 1);

    return this.getMessage(message.id!)!;
  }

  async deleteMessage(id: string) {
    // await this.parentKeyStore.deleteMessage(id);
    this.deletedMessageIds.add(id);
    this.inlangProject?.query.messages.delete({ where: { id } });
  }

  upsertedMessageIds = new Set<string>();

  deletedMessageIds = new Set<string>();

  private async loadInlangProject() {
    try {
      await this.fs.readFile(`${projectFolder}/settings.json`);
    } catch (e) {
      if (
        this.config.refLanguage &&
        this.config.enabledLanguages &&
        this.config.enabledLanguages.length > 0
      ) {
        // creating a project file
        const inlangConfig = {
          sourceLanguageTag: this.config!.refLanguage,
          modules: ['./plugin.js'],
          languageTags: this.config!.enabledLanguages,
          // languageTags: ['en', 'de'],
        };

        await this.fs.mkdir(projectFolder);
        // writing the project file to the virtual filesystem
        await this.fs.writeFile(`${projectFolder}/settings.json`, JSON.stringify(inlangConfig));
        return;
      }
      console.log('no inlang settings yet - not initialziing until ');
      return;
    }

    debugger;
    // opening the project file and loading the plugin
    this.inlangProject = await loadProject({
      nodeishFs: this.fs,
      projectPath: projectFolder,
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
            /* loadMessages: async () => {
              // load all messages
              const messages: Message[] = [];// await this.parentKeyStore.load();

              await this.fs.mkdir(messagePath);

              const messageFilePaths = await this.fs.readdir(messagePath);
              for (const messageFilePath of messageFilePaths) {
                const messageRaw = await this.fs.readFile(`${messagePath}${messageFilePath}`, { encoding: 'utf-8' });
                const message = JSON.parse(messageRaw) as Message;
                messages.push(message);
              }

              return messages;
            },
            saveMessages: async ({ messages, settings, nodeishFs }: { messages: Message[], settings: any, nodeishFs: any }) => {
              for (const message of messages) {
                if (this.upsertedMessageIds.has(message.id)) {
                  // await this.parentKeyStore.saveMessage(message);
                  await this.fs.writeFile(`${messagePath}${message.id}`, JSON.stringify(message));
                }
              }

              for (const deletedMessageId of [...this.deletedMessageIds]) {
                await this.fs.rm(`${messagePath}${deletedMessageId}`);
                // await this.parentKeyStore.deleteMessage(deletedMessageId);
              }
              this.upsertedMessageIds = new Set<string>();
            }, */
          },
        };
        // return import('./inlang/FigmaPlugin');
      },
    });

    // this.fs.watch(messagePath, { recursive: true });
  }

  async load(): Promise<boolean> {
    await this.loadInlangProject();
    if (this.inlangProject) {
      this.inlangProject!.query.messages.getAll();
      return true;
    }
    return false;
  }

  // wrapper methods to centralize the integration of inlang in case of api changes

  static hasVariant(message: Message, targetLanguage: Locale, match?: string[]) {
    return getVariant(message, { where: { languageTag: targetLanguage, match } }) !== undefined;
  }

  // static isVariantsTranslationOutdated(
  //   message: Message,
  //   sourceLanguage: Locale,
  //   targetLanguage: Locale,
  //   match?: string[],
  // ) {
  //   const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(message, sourceLanguage, match);
  //   const currentVariant = getVariant(message, { where: { languageTag: targetLanguage, match } });

  //   if (!currentVariant || blake.blake2sHex(sourceVariantPatternHTML) !== (currentVariant as any).translationSrcHash) {
  //     return true;
  //   }

  //   return false;
  // }

  static upsertVariantPatternHtml(
    message: Message,
    sourceLanguage: Locale | undefined,
    language: Locale,
    match: string[],
    patternHtml: string,
  ) {
    // const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(message, sourceLanguage, match);
    const currentVariantClone = getVariant(message, { where: { languageTag: language, match } });
    // let variantPatternHTMLHash = '';
    let messageClone: Message;

    if (currentVariantClone) {
      // variantPatternHTMLHash = (blake.blake2sHex(sourceVariantPatternHTML));
      // XXX find the variant using language an pattern to be able to mutate it in place
      messageClone = updateVariantPattern(message, {
        where: { languageTag: language, match },
        data: MessageStoreMemory.patternHtmlToPattern(patternHtml),
      }).data!;
    } else {
      const tranlatedVariant = {
        languageTag: language,
        match,
        pattern: MessageStoreMemory.patternHtmlToPattern(patternHtml),
      };
      // add properties to variant
      // (tranlatedVariant as any).translationSrcHash = (blake.blake2sHex(sourceVariantPatternHTML));
      messageClone = createVariant(message, { data: tranlatedVariant }).data!;
    }

    // const updatedVariantClone = getVariant(message, { where: { languageTag: language, selectors: match } });
    // XXX this is uses json stringify on the variant to check if equal - sdk will change anyway and we change this
    // const mutableVariant = message.variants.find((variant) => variant.languageTag === updatedVariantClone?.languageTag && JSON.stringify(variant.match) === JSON.stringify(updatedVariantClone.match));
    // (mutableVariant as any).translationSrcHash = variantPatternHTMLHash;

    return messageClone;
  }

  static async upsertUsingAutoTranslateMessage(
    translationProvider: (
      input: string,
      sourceLanguage: string,
      targetLanguage: string,
    ) => Promise<string | null>,
    message: Message,
    sourceLanguage: Locale,
    targetLanguage: Locale,
    match: string[],
  ) {
    //
    const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(
      message,
      sourceLanguage,
      match,
    );
    if (sourceVariantPatternHTML === undefined) {
      throw new Error(`Pattern did not exist for source language: ${sourceLanguage}`);
    }

    const translatedPattern = await translationProvider(
      sourceVariantPatternHTML,
      sourceLanguage as string,
      targetLanguage,
    );

    return this.upsertVariantPatternHtml(
      message,
      sourceLanguage,
      targetLanguage,
      match,
      translatedPattern!,
    );
  }

  static patternHtmlToPattern(patternHtml: string): Pattern {
    const result = [] as Pattern;

    const placeholders = PlaceholderHelper.extractPlaceholdersFromPatterHTML(patternHtml);

    let lastExtractionEnd = 0;

    for (const placeholder of placeholders) {
      if (placeholder.start > lastExtractionEnd) {
        result.push({
          type: 'Text',
          value: patternHtml.substring(lastExtractionEnd, placeholder.start),
        });
      }
      result.push({
        type: 'VariableReference',
        name: placeholder.placeholder.name,
      });
      lastExtractionEnd = placeholder.start + placeholder.length;
    }

    if (patternHtml.length > lastExtractionEnd) {
      result.push({
        type: 'Text',
        value: patternHtml.substring(lastExtractionEnd, patternHtml.length),
      });
    }

    return result;
  }

  static patternToHtml(patterns: Pattern) {
    let html = '';
    // 8 inlang rich text - support other patterns or get rid of html representation
    for (const pattern of patterns) {
      if (pattern.type === 'Text') {
        html += pattern.value;
      } else if (pattern.type === 'VariableReference') {
        html += `<ph>${pattern.name}</ph>`;
      }
    }

    return html;
  }

  static htmlInLangugage(message: Message, language: string) {
    let html = undefined as string | undefined;

    const variantInLanguage = message.variants.find((variant) => variant.languageTag === language);
    if (variantInLanguage) {
      // TODO #18 inlang rich text - support other patterns or get rid of html representation
      for (const pattern of variantInLanguage.pattern) {
        if (pattern.type === 'Text') {
          if (html === undefined) {
            html = '';
          }
          html += pattern.value;
        }
      }
    }

    return html;
  }

  static htmlForPattern(message: Message, languageTag: string, match?: string[]) {
    const variant = getVariant(message, { where: { languageTag, match } });
    if (!variant) {
      return undefined;
    }
    return this.patternToHtml(variant!.pattern);
  }

  static getBestExistingVariant(
    message: Message,
    languageTag: string,
    fallbackLanguageTags: string[],
    match?: string[],
  ) {
    const variant = getVariant(message, { where: { languageTag, match } });
    if (!variant) {
      for (const fallbackLanguageTag of fallbackLanguageTags) {
        const fallbackVariant = getVariant(message, {
          where: { languageTag: fallbackLanguageTag, match },
        });
        if (fallbackVariant !== undefined) {
          return fallbackVariant;
        }
      }
    }
    return variant;
  }

  static refLanguageHash(message: Message, language: string, match?: string[]) {
    const variant = getVariant(message, { where: { languageTag: language, match } });
    if (variant) {
      return (variant as any).refLanguageHash as string;
    }

    return undefined;
  }
}
