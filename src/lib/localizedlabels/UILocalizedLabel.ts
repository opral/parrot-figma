import Quill, { Delta as DeltaType, DeltaOperation } from 'quill';
import blake from 'blakejs';
import { Locale } from '../message/variants/Locale';
import { Plural } from '../message/variants/Plural';
import { MessageLinkState, LabelStyle, LocalizedLabel } from './LocalizedLabel';

import {
  Fillins, PlaceholdersByName, MessageEntry,
} from '../message/Message';
import LocalizedLabelManager, { DeltaOp, MARKER_CHARACTER } from './LocalizedLabelManager';

const Delta = Quill.import('delta') as typeof DeltaType;

export interface ILocalizedLabelManagerUI {
  messageStore: any; // TODO make this UITranslationKeyStore and add all methods to the interface needed
  updateLabelProperties(nodeId: string, changedProperties: {
    labelName?: string,
    messageLinkState?: MessageLinkState,
    messageId?: string,
    messageVersion?: number,
    language?: Locale,
    plural?: Plural,
    variantHTML?: string,
    filledTemplateHash?: string,
    showSampleValues?: boolean,
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

  warnings: string[];

  labelStyle: LabelStyle;

  unlinkedMessage: MessageEntry; // | undefined;

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
    this.pluralId = localizedLabel.pluralId;
    this.characters = localizedLabel.characters;
    this.textChangedAfterGeneration = localizedLabel.textChangedAfterGeneration;
    this.derivedKey = localizedLabel.derivedKey;
    this.fillins = localizedLabel.fillins;
    this.ops = localizedLabel.ops;
    this.warnings = localizedLabel.warnings;
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
    const key = this.manager.messageStore.getKey(this.messageId);
    if (key) {
      return key.keyName;
    }

    return undefined;
  }

  static toHtml(text: string, ops: DeltaOp[], fillins: Fillins, trimLabelStyles: boolean) {
    const deltaOps = [] as DeltaOperation[];
    const lastTwoCharsBreaks = text.length > 1 && text[text.length - 1] === '\n' && text[text.length - 2] === '\n';

    // allways add an additional line break at the end
    ops[ops.length - 1].end += 1;
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

    htmlWithFilledPlaceholders += '<br>';
    const contents = (quill.clipboard as any).convert({ html: htmlWithFilledPlaceholders }) as any;
    const text = contents.filter((op: any) => typeof op.insert === 'string').map((op: any) => op.insert).join(''); // quill.getText();// tempCont.getElementsByClassName('ql-editor')[0].textContent ?? '';

    const ops = [] as any[];
    let currentPositon = 0;
    contents.ops?.forEach((operation: any) => {
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
    const message = messageId ? this.manager.messageStore.getKey(messageId) : undefined;

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
   *  * the keys language/plural the label references changed
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

    // debugger;
    const translatedKey = this.messageLinkState !== MessageLinkState.Unset ? this.manager.messageStore.getKey(this.messageId!) : undefined;

    if (translatedKey) {
      const currentVersion = translatedKey.getHistoryEntry(this.language, this.pluralId, this.messageVersion);

      if (currentVersion === undefined) {
        state.variantDeleted = true;
      } else {
        state.behind = translatedKey.getChangesSince(this.language, this.pluralId, this.messageVersion);

        const variantHtml = currentVersion.messages[this.language]?.[this.pluralId]?.text!;

        // eslint-disable-next-line no-param-reassign
        if (variantHtml !== this.variantHTML) {
          state.modified = true;
          state.orginalVariantHTML = variantHtml;
        }
      }
    }

    return state;
  }

  async setUseSampleValues(showSampleValues: boolean) {
    if (this.messageLinkState !== MessageLinkState.Linked) {
      return;
    }

    const message = this.manager.messageStore.getKey(this.messageId!);

    if (this.messageLinkState !== MessageLinkState.Linked
      || this.state!.modified
      || message === undefined) {
      // we don't change any property also not on the parent - no need to update the label at all
      return;
    }

    const versionToApply = message.getHistoryEntry(this.language, this.pluralId, this.messageVersion);

    const text = versionToApply?.messages?.[this.language]?.[this.pluralId]?.text;
    if (text) {
      await this.manager.updateLabelProperties(this.nodeId, {
        showSampleValues,
        variantHTML: text,
      });
    }
  }

  async setLanguage(
    targetLanguage: Locale,
    version: number | undefined,
    missingTranslationProvider: (input: string, sourceLanguage: string, targetLanguage: string) => Promise<string | undefined>,
  ) {
    if (this.messageLinkState === MessageLinkState.Unset) {
      const baseLanguage = this.manager.messageStore.getBaseLanugage()! as Locale;
      // TODO check if the target language is avaialable and up to date
      let variantUpToDate = false;
      const baseLanguageHTML = this.language === baseLanguage ? this.variantHTML : this.unlinkedMessage.variants?.[baseLanguage]?.[this.pluralId]?.text!;

      if (this.unlinkedMessage
        && this.unlinkedMessage.variants?.[targetLanguage]?.[this.pluralId]?.text) {
        const currentTranslationBaseLangHash = this.unlinkedMessage.variants?.[targetLanguage]?.[this.pluralId]?.baseLangHash;
        if (baseLanguageHTML && blake.blake2sHex(baseLanguageHTML) === currentTranslationBaseLangHash) {
          variantUpToDate = true;
        }
      }
      let variantHTML = undefined as string | undefined;
      if (!variantUpToDate) {
        variantHTML = await missingTranslationProvider(baseLanguageHTML, baseLanguage as string, targetLanguage);
      }

      await this.manager.updateLabelProperties(this.nodeId, {
        language: targetLanguage,
        plural: this.pluralId,
        variantHTML,
      });
      return;
    }

    const messageName = this.messageId ?? this.derivedKey;
    const labelState = this.state!;
    let labelVersion = this.messageVersion;

    if (this.messageLinkState === MessageLinkState.NoKey // we don't update unlinked labels
      || messageName === undefined // or labels where we cant derive or get the key
      || labelState.modified) { // or that are modified
      // root language has changed - trigger cache update
      await this.manager.updateLabelProperties(this.nodeId, {});
      return;
    }

    let message = this.manager.messageStore.getKey(messageName);
    // check if key exists
    if (message === undefined) {
      throw new Error('Key linked to label does not exist - not removed when key was deleted?');
      /* const translation = await missingTranslationProvider(this.translationHTML!, this.language, targetLanguage);

      // ok we have a fresh key to create - no translation to expect
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
        // updating key
        if (message.messages[targetLanguage]?.[this.pluralId]?.text === undefined) {
          if (message.messages[targetLanguage]?.[this.pluralId]?.skip === true) {
            // TODO #3 think about fall back mechanism:
            // in case the key for the given plural is skipped try to fall back to others
            // if this is skipped as well fall back to base language
            //  - for now we just don't change the label
            await this.manager.updateLabelProperties(this.nodeId, {});
            return;
          }

          // translation missing - generate it and update the translation key
          let originLanguage = this.manager.messageStore.getBaseLanugage();
          let originText = message.messages[this.manager.messageStore.getBaseLanugage()!]?.[this.pluralId]?.text;

          if (originText === undefined) {
            originLanguage = this.language;
            originText = message.messages[this.language]![this.pluralId]?.text!;
          }

          const translation = await missingTranslationProvider(originText, originLanguage as string, targetLanguage);
          message = await this.manager.messageStore.updateKey(messageName, [{
            language: targetLanguage,
            plural: this.pluralId,
            text: translation,
            skip: false,
          }]);
        }
        labelVersion = message.latestVersion;
      }

      const versionToApply = message.getHistoryEntry(targetLanguage, this.pluralId, labelVersion);

      await this.manager.updateLabelProperties(this.nodeId, {
        messageId: messageName,
        messageLinkState: MessageLinkState.Linked,
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
