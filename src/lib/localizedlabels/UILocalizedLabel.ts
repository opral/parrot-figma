import Quill, { Delta as DeltaType, DeltaOperation } from 'quill';
import blake from 'blakejs';
import { Message } from '@inlang/message';
import { Locale } from '../message/variants/Locale';
import { Plural } from '../message/variants/Plural';
import { MessageLinkState, LabelStyle, LocalizedLabel } from './LocalizedLabel';

import {
  Fillins, PlaceholdersByName,
} from '../message/Message';
import LocalizedLabelManager, { DeltaOp, MARKER_CHARACTER } from './LocalizedLabelManager';
import { Gender } from '../message/variants/Gender';
import MessageStoreMemory from '../message/store/MessageStoreMemory';

const Delta = Quill.import('delta') as typeof DeltaType;

export interface ILocalizedLabelManagerUI {
  messageStore: any; // TODO make this UITranslationKeyStore and add all methods to the interface needed
  updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    messageLinkState?: MessageLinkState,
    messageId?: string,
    messageVersion?: number,
    language?: Locale,
    gender?: Gender,
    plural?: Plural,
    variantHTML?: string,
    filledTemplateHash?: string,
  }): Promise<void>;
}

export class UILocalizedLabel implements LocalizedLabel {
  pageId: string;

  pageName: string;

  rootFrameId: string;

  rootFrameName: string;

  nodeId: string;

  name: string;

  x: number;

  y: number;

  width: number;

  height: number;

  rootFrameLanguage: Locale;

  language: Locale;

  rootFrameUseSampleValues: boolean;

  useSampleValues: boolean;

  messageLinkState: MessageLinkState;

  messageId?: string | undefined;

  messageVersion: number;

  genderId: Gender;

  pluralId: Plural;

  characters: string;

  state?: { behind: number; orginalTranslationHTML?: string | undefined; modified: boolean; } | undefined;

  textChangedAfterGeneration: boolean;

  /**
   * contains the translation representation with placeholders and later formation tags
   */
  // translation: string;

  fillins: Fillins;

  derivedKey?: string | undefined;

  matchingLabelLints: string[];

  labelStyle: LabelStyle;

  unlinkedMessage: Message; // | undefined;

  // utils
  // to manage the label within the UI keep a reference of the Label manager
  manager: ILocalizedLabelManagerUI;

  constructor(manager: ILocalizedLabelManagerUI, localizedLabel: LocalizedLabel) {
    this.manager = manager;

    this.pageId = localizedLabel.pageId;
    this.pageName = localizedLabel.pageName;
    this.rootFrameId = localizedLabel.rootFrameId;
    this.rootFrameName = localizedLabel.rootFrameName;
    this.nodeId = localizedLabel.nodeId;
    this.name = localizedLabel.name;
    this.x = localizedLabel.x;
    this.y = localizedLabel.y;
    this.width = localizedLabel.width;
    this.height = localizedLabel.height;
    this.rootFrameLanguage = localizedLabel.rootFrameLanguage;
    this.language = localizedLabel.language;
    this.rootFrameUseSampleValues = localizedLabel.rootFrameUseSampleValues;
    this.useSampleValues = localizedLabel.useSampleValues;
    this.messageLinkState = localizedLabel.messageLinkState;
    this.messageId = localizedLabel.messageId;
    this.messageVersion = localizedLabel.messageVersion;
    this.genderId = localizedLabel.genderId;
    this.pluralId = localizedLabel.pluralId;
    this.characters = localizedLabel.characters;
    this.textChangedAfterGeneration = localizedLabel.textChangedAfterGeneration;
    this.derivedKey = localizedLabel.derivedKey;
    this.fillins = localizedLabel.fillins;
    this.ops = localizedLabel.ops;
    this.matchingLabelLints = localizedLabel.matchingLabelLints;
    this.labelStyle = localizedLabel.labelStyle;
    this.variantHTML = UILocalizedLabel.toHtml(localizedLabel.characters, localizedLabel.ops, this.fillins, true);
    this.unlinkedMessage = localizedLabel.unlinkedMessage;
    this.state = this.getState();
  }

  variantHTML: string;

  ops: DeltaOp[];

  filledTemplateHash?: string | undefined;

  getMessageName(): string | undefined {
    if (this.messageId === undefined) return undefined;
    const message = this.manager.messageStore.getMessage(this.messageId);
    if (message) {
      return message.name;
    }

    return undefined;
  }

  static toHtml(text: string, ops: DeltaOp[], fillins: Fillins, trimLabelStyles: boolean) {
    if (text === '') {
      return '';
    }

    const deltaOps = [] as DeltaOperation[];
    const lastTwoCharsBreaks = text.length > 1 && text[text.length - 1] === '\n' && text[text.length - 2] === '\n';

    // allways add an additional line break at the end
    if (ops.length > 0) {
      ops[ops.length - 1].end += 1;
    }
    const rawtext = `${text}\n`;

    // s
    // <p>s</p>
    // s\n
    // <p>s</p>
    // s\n\n
    // <p>s</p><p><br></p>
    // s\n\n\n
    // <p>s</p><p><br></p><p><br></p>

    // --> adding a helper new line (\n)
    // s(\n)
    // <p>s</p>
    // s\n(\n)
    // <p>s</p><p><br></p>
    // s\n\n(\n)
    // <p>s</p><p><br></p><p><br></p>
    // s\n\n\n(\n)
    // <p>s</p><p><br></p><p><br></p><p><br></p>

    // --> replacing wrapper and introducing new lines by \n again
    // all <p><br></p> -> \n
    // <p>s</p><p><br></p><p><br></p><p><br></p> -> should become s\n\n\n
    // <p>s</p>\n\n\n
    // all </p> -> \n -> <p>s\n\n\n\n
    // remove all <p> -> s\n\n\n\n
    // remove last \n -> s\n\n\n CHECK

    // --> replacing wrapper and introducing new lines by \n again
    // all <p><br></p> -> \n
    // <p>s</p> -> should become "s"
    // <p>s</p>
    // all </p> -> \n -> <p>s\n
    // remove all <p> -> s\n
    // remove last \n -> s CHECK

    // placholder replacement
    for (const op of ops) {
      if (op.attributes.placeholder) {
        const insert = op.attributes.placeholder.name;
        const parameterOperation = {
          insert,
          attributes: {
            ...op.attributes,
          },
        };
        // enrich fillin
        (parameterOperation.attributes.placeholder! as any).fillin = fillins[insert].value;

        deltaOps.push(parameterOperation);
      } else {
        const insert = rawtext.substring(op.start, op.end);
        deltaOps.push({
          insert,
          attributes: op.attributes,
        });
      }
    }

    const delta = new Delta(deltaOps);

    const tempCont = document.createElement('pre');
    (new Quill(tempCont)).setContents(delta);
    let htmlContent = tempCont.getElementsByClassName('ql-editor')[0].innerHTML;
    // remove all quill helper attributes

    htmlContent = htmlContent.replace(/fillin="([^"])*" contenteditable="false">/g, '>');
    htmlContent = htmlContent.split('<p><br></p>').join('\n');
    htmlContent = htmlContent.split('</p>').join('\n');

    htmlContent = htmlContent.split('<p>').join('');
    htmlContent = htmlContent.slice(0, htmlContent.length - 1);
    return htmlContent;
  }

  static toTextAndOps(html: string, fillins: Fillins) {
    // TODO #12 quill from html -> text + ops

    const pattern = /(<ph type="([^"]*)")( format="([^"]*)")?( arg="([^"]*)")?( unnamed)?([^>])*(>([^<]*)<\/ph>)/g;

    const placeholderByFillin = LocalizedLabelManager.getPlaceholdersByFillins(fillins);
    // const wholeMatch = paramMatch[0];
    // const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    // const name = paramMatch[2];

    let htmlWithFilledPlaceholders = html.replace(pattern, (match, _helper1, type, _helper3, format, _helper5, argumentPosition, unnamed, _helper8, _helper9, name) => {
      const placeholderName = name;
      if (placeholderName && fillins[placeholderName]) {
        const extensionLength = placeholderByFillin.indexOf(placeholderName) + 1;
        return fillins[placeholderName].value + MARKER_CHARACTER.repeat(extensionLength);
      }

      return match;
    });

    const tempCont = document.createElement('pre');
    const quill = new Quill(tempCont);
    quill.disable();
    htmlWithFilledPlaceholders = htmlWithFilledPlaceholders.split('\n').join('<br>');

    // htmlWithFilledPlaceholders = htmlWithFilledPlaceholders.split(' ').join('&nbsp;');

    (quill.clipboard as any).matchers[0][1] = function matchText(node: any, delta: any) {
      const text = node.data;
      return delta.insert(text);
    };
    let removeLastCR = false;

    if (htmlWithFilledPlaceholders.endsWith('</ol>') || htmlWithFilledPlaceholders.endsWith('</ul>')) {
      removeLastCR = true;
    }

    htmlWithFilledPlaceholders += '<br>';

    const contents = (quill.clipboard as any).convert({ html: htmlWithFilledPlaceholders }) as any;
    let text = contents.filter((op: any) => typeof op.insert === 'string').map((op: any) => op.insert).join(''); // quill.getText();// tempCont.getElementsByClassName('ql-editor')[0].textContent ?? '';

    if (removeLastCR) {
      text = text.slice(0, -1);
    }

    const ops = [] as any[];
    let currentPositon = 0;
    contents.ops?.forEach((operation: any) => {
      if (currentPositon + operation.insert.length > text.length) {
        // eslint-disable-next-line no-param-reassign
        operation.insert = operation.insert.slice(0, -1);
      }

      ops.push({
        from: currentPositon,
        to: currentPositon + operation.insert.length,
        attributes: operation.attributes,
      });

      currentPositon += operation.insert.length;
    });
    // remove the /n at the end?
    return {
      text,
      ops,
    };
  }

  getFillins(messageIdToUse?: string, fillins?: Fillins) {
    const messageId = messageIdToUse ?? this.messageId;
    const message = messageId ? this.manager.messageStore.getMessage(messageId) : undefined;

    const defaultFillIns = message ? { ...message.defaultFillins } : {} as Fillins;
    const labelFillins = fillins ?? this.fillins;

    for (const parameterName of Object.keys(defaultFillIns)) {
      if (labelFillins[parameterName] && labelFillins[parameterName].default) {
        labelFillins[parameterName] = { default: true, value: defaultFillIns[parameterName].value };
      }
    }

    return labelFillins;
  }

  getPlaceholders() {
    const placeholders = {} as PlaceholdersByName;
    return placeholders; // TODO
    /*
    const labelTranslationPlaceholders = UITranslationKey.extractPlaceholdersInText(this.translation);

    if (this.messageLinkState === KeyState.Linked) {
      const key = this.manager.keyStore.getKey(this.key!)! as UITranslationKey;
      placeholders = { ...key.placeholders };
    }

    for (const labelTranslationPlaceholder of labelTranslationPlaceholders) {
      if (!placeholders[labelTranslationPlaceholder.name]) {
        placeholders[labelTranslationPlaceholder.name] = labelTranslationPlaceholder;
      }
    }

    return placeholders; */
  }

  static toText(text: string, fillins: Fillins) {
    const pattern = /\[\[([A-Za-z_]{2,})?(?:#(\d+))?(?::*([sdf])(?:\.(\d+))?)?\]\]/g;

    const placeholderByFillin = LocalizedLabelManager.getPlaceholdersByFillins(fillins);
    // const wholeMatch = paramMatch[0];
    // const argumentPosition = paramMatch[1] ? parseInt(paramMatch[1], 10) : undefined;
    // const name = paramMatch[2];

    return text.replace(pattern, (match, name, _argumentPosition) => {
      const placeholderName = name;
      if (placeholderName && fillins[placeholderName]) {
        const extensionLength = placeholderByFillin.indexOf(placeholderName) + 1;
        return fillins[placeholderName].value + MARKER_CHARACTER.repeat(extensionLength);
      }
      return match;
    });
  }

  /**
   * The state of a label is represented by two main properties:
   * modified: was the labels text changed in the design compared to the version of the key which the label is pointing to
   * behind: the number of changes that have been applied to the language relative to the version the label is currently pointing to
   *
   * Label state changes if:
   *  * the labels text changes and its text is different from the original text
   *  * the message variant language/gender/plural the label references changed
   *  *
   * @param localizedLabel the label to provide the state for
   * @returns
   */
  getState(): { behind: number, orginalTranslationHTML?: string, modified: boolean } {
    const state = {
      modified: false,
      variantDeleted: false,
      behind: 0,
      orginalVariantHTML: undefined as string | undefined,
    };

    const message = this.messageLinkState !== MessageLinkState.Unset ? this.manager.messageStore.getMessage(this.messageId!) : undefined;

    if (message) {
      // const currentVersion = message.getHistoryEntry(this.language, this.genderId, this.pluralId, this.messageVersion);

      // state.behind = message.getChangesSince(this.language, this.genderId, this.pluralId, this.messageVersion);
      // const variantHtml = currentVersion?.variants[this.language]?.[this.genderId]?.[this.pluralId]?.text;
      // // eslint-disable-next-line no-param-reassign
      // if (variantHtml !== this.variantHTML) {
      //   state.modified = true;
      //   state.orginalVariantHTML = variantHtml;
      // }
      state.modified = true;
      state.behind = 1;
    }

    return state;
  }

  async setLanguage(
    targetLanguage: Locale,
    version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | null>,
  ) {
    if (this.messageLinkState === MessageLinkState.Unset) {
      const refLanguage = this.manager.messageStore.getBaseLanugage()! as Locale;

      const refLanguagePattern = this.unlinkedMessage !== undefined ? MessageStoreMemory.htmlInLangugage(this.unlinkedMessage, refLanguage) : undefined;

      let patternToUpdateTo = undefined as string | undefined;
      if (targetLanguage === refLanguage) {
        // use the message language
        patternToUpdateTo = refLanguagePattern ?? this.variantHTML;
      } else {
        // TODO check if the target language is avaialable and up to date

        // TODO #15 use undefined for language if ref language

        const currentTranslationBaseLangHash = MessageStoreMemory.refLanguageHash(this.unlinkedMessage, targetLanguage);
        if (refLanguagePattern && blake.blake2sHex(refLanguagePattern) !== currentTranslationBaseLangHash) {
          patternToUpdateTo = await missingTranslationProvider(refLanguagePattern, refLanguage as string, targetLanguage) ?? 'no translation';
        } else {
          patternToUpdateTo = this.unlinkedMessage ? MessageStoreMemory.htmlInLangugage(this.unlinkedMessage, targetLanguage) : 'no translation in unlinked msg';
        }
      }

      await this.manager.updateLabelProperties(this.nodeId, {
        language: targetLanguage,
        gender: this.genderId,
        plural: this.pluralId,
        variantHTML: patternToUpdateTo,
      });
      return;
    }

    const messageId = this.messageId ?? this.derivedKey;
    const labelState = this.state!;
    let labelVersion = this.messageVersion;

    if (this.messageLinkState === MessageLinkState.NoKey // we don't update unlinked labels
      || messageId === undefined // or labels where we cant derive or get the message
      || labelState.modified) { // or that are modified
      // root language has changed - trigger cache update
      await this.manager.updateLabelProperties(this.nodeId, {});
      return;
    }

    let message = this.manager.messageStore.getMessage(messageId);
    // check if message exists
    if (message === undefined) {
      throw new Error('Message linked to label does not exist - not removed when Message was deleted?');
      /* const translation = await missingTranslationProvider(this.translationHTML!, this.language, targetLanguage);

      // ok we have a fresh message to create - no translation to expect
      message = await this.manager.keyStore.createKey(messageName, [{
        language: this.language,
        plural: this.pluralId,
        text: this.translationHTML,
        skip: false,
      }, {
        language: targetLanguage,
        plural: this.pluralId,
        text: translation,
        skip: false,
      }], this.pluralId !== Plural.OTHER);
      labelVersion = message.latestVersion; */
    } else {
      if (labelState.behind === 0) {
        // updating message
        if (message.variants[targetLanguage]?.[this.genderId]?.[this.pluralId]?.text === undefined) {
          if (message.variants[targetLanguage]?.[this.genderId]?.[this.pluralId]?.skip === true) {
            // TODO #3 think about fall back mechanism:
            // in case the variant for the given plural is skipped try to fall back to others
            // if this is skipped as well fall back to base language
            //  - for now we just don't change the label
            await this.manager.updateLabelProperties(this.nodeId, {});
            return;
          }

          // translation missing - generate it and update the message
          let originLanguage = this.manager.messageStore.getBaseLanugage();
          let originText = message.variants[this.manager.messageStore.getBaseLanugage()!]?.[this.genderId]?.[this.pluralId]?.text;

          if (originText === undefined) {
            originLanguage = this.language;
            originText = message.variants[this.language]![this.genderId]?.[this.pluralId]?.text!;
          }

          const translation = await missingTranslationProvider(originText, originLanguage as string, targetLanguage) ?? 'no translation';
          message = await this.manager.messageStore.updateMessage(messageId, [{
            language: targetLanguage,
            gender: this.genderId,
            plural: this.pluralId,
            text: translation,
            skip: false,
          }]);
        }
        labelVersion = message.latestVersion;
      }

      const versionToApply = message.getHistoryEntry(targetLanguage, this.genderId, this.pluralId, labelVersion);

      await this.manager.updateLabelProperties(this.nodeId, {
        messageId,
        messageLinkState: MessageLinkState.Linked,
        gender: this.genderId,
        language: targetLanguage,
        plural: this.pluralId,
        variantHTML: versionToApply?.messages?.[targetLanguage]?.[this.pluralId]?.text,
        messageVersion: labelVersion,
      });
    }
  }

  toJSON() {
    const localizedObject = {
      ...this,
    } as any;
    localizedObject.manager = undefined;
    return localizedObject as LocalizedLabel;
  }
}
