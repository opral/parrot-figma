/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
import FigmaUtil from '../../shared/FigmaUtil';
import Language from '../base/Language';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import Plural from '../base/Plural';
import { BaseTranslationKeyStore } from '../keystore/BaseTranslationKeyStore';

export default class LocalizedLabelManager {
  translationKeyStore?: BaseTranslationKeyStore;

  public proxClassName = 'LocalizedLabelManager';

  public samplesPrefix = 'sample_values';

  public linkStilyDataKey = 'linkstyle';

  public separator = '__';

  public filledTemplateHashDataKey = 'fth';

  public sampleValuesDataKey = 'sv';

  public languageDataKey = 'l';

  public keyTypeDataKey = 'kt';

  public keyVersionDataKey = 'kv';

  public keyPluralDataKey = 'kp';

  public keyDataKey = 'key';

  public labelIdDataKey = 'olid'; // we store the orginal label id (the id of the node when the plugin changed properties the first time) to detect a copy

  constructor(translationKeyStore: BaseTranslationKeyStore | undefined) {
    this.translationKeyStore = translationKeyStore;

    if (translationKeyStore === undefined) {
      return;
    }

    figma.on('documentchange', this.forwardDocumentChanges.bind(this));
  }

  forwardDocumentChanges(event: any) {
    const figmaUtil = new FigmaUtil();

    const changedNodesById = [] as string[];
    const rootFrameIdsToReload = [] as string[];
    const deletedNodeIds = [] as string[];
    const changedLabels = [] as LocalizedLabel[];
    for (const change of event.documentChanges) {
      // eslint-disable-next-line default-case
      switch (change.type) {
        case 'CREATE': {
          const rootFrame = figmaUtil.getRootFrame(figma.getNodeById(change.id));
          if (rootFrame && rootFrameIdsToReload.indexOf(rootFrame?.id) === -1) {
            rootFrameIdsToReload.push(rootFrame.id);
          }
          break;
        }
        case 'DELETE': {
          if (deletedNodeIds.indexOf(change.id) === -1) {
            deletedNodeIds.push(change.id);
          }
          break;
        }
        case 'PROPERTY_CHANGE': {
          const changedNode = figma.getNodeById(change.id);

          if (change.properties.indexOf('parent') !== -1) {
            // ask to invalidate current and new frame
            const rootFrame = figmaUtil.getRootFrame(figma.getNodeById(change.id));
            if (rootFrame && rootFrameIdsToReload.indexOf(rootFrame?.id) === -1) {
              rootFrameIdsToReload.push(rootFrame.id);
            }
          } else {
            // refresh single node
            // check if change did appear on a localized label
            // TODO what about a localized label that turns into a normal label again? is this possible?
            // eslint-disable-next-line no-lonely-if
            if (changedNode?.type === 'TEXT') {
              const localizedLabel = this.toLocalizedLabelOrUndefined(changedNode as TextNode);
              if (localizedLabel) {
                changedLabels.push(localizedLabel.localizedLabel);
              }
            } else if (changedNodesById.indexOf(change.id) === -1) {
              changedNodesById.push(change.id);
            }
          }
          break;
        }
        case 'STYLE_CREATE':
        case 'STYLE_DELETE':
        case 'STYLE_PROPERTY_CHANGE':
          break;
      }
    }

    figma.ui.postMessage({
      target: 'LocalizedLabelManager',
      type: 'cacheUpdate',
      changedNodesById,
      rootFrameIdsToReload,
      deletedNodeIds,
      changedLabels,
    });
  }

  async getFrameById(frameId: string): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[],
    refreshTriggerIds: Set<string>
  }> {
    const frame = figma.getNodeById(frameId) as FrameNode;
    return this.getFrame(frame);
  }

  private async getFrame(frame: FrameNode): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[],
    refreshTriggerIds: Set<string>
  }> {
    const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
    figma.skipInvisibleInstanceChildren = true;

    const frameData = {
      id: frame.id,
      name: frame.name,
      refreshTriggerIds: new Set<string>(),
      localizedLabelsInFrame: [] as LocalizedLabel[],
    };

    const textNodes = frame.findAllWithCriteria({ types: ['TEXT'] });

    for (const textNode of textNodes) {
      const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
      if (lokalizedLabel) {
        frameData.localizedLabelsInFrame.push(lokalizedLabel.localizedLabel);
        lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
      }
    }

    figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

    return frameData;
  }

  async setBaseLanguage(baseLanguage: Language) {
    figma.root.setPluginData(this.languageDataKey, baseLanguage);
  }

  async getBaseLanguage() {
    return this.getBaseLanguageSync();
  }

  getBaseLanguageSync() {
    return figma.root.getPluginData(this.languageDataKey) === '' ? Language.En : figma.root.getPluginData(this.languageDataKey) as Language;
  }

  async setLinkStyle(linkStyle: string) {
    figma.root.setPluginData(this.linkStilyDataKey, linkStyle);
  }

  async getLinkStyle() {
    const linkStyleRaw = figma.root.getPluginData(this.linkStilyDataKey);
    try {
      JSON.parse(linkStyleRaw);
      return linkStyleRaw;
    } catch (e) {
      return '';
    }
  }

  async updateFrameProperties(frameNodeId: string, properties: { language?: Language, sampleValues?: boolean }) {
    const frame = figma.getNodeById(frameNodeId) as FrameNode;
    if (!frame) {
      return;
    }

    if (properties.language !== undefined) {
      frame.setPluginData(this.languageDataKey, properties.language);
    }

    if (properties.sampleValues !== undefined) {
      if (properties.sampleValues) {
        frame.setPluginData(this.sampleValuesDataKey, `${true}`);
      } else {
        frame.setPluginData(this.sampleValuesDataKey, '');
      }
    }

    // console.log((new Date()).getTime() + 'execution finished - puting result into message');
  }

  private getUseSampleValues(node: FrameNode | TextNode) {
    const useSampleValues = node.getPluginData(this.sampleValuesDataKey);
    if (useSampleValues === undefined || useSampleValues !== '') {
      return false;
    }

    return true;
  }

  async updateLocalisedLabelProperties(nodeId: string, changedProperties:
  {
    labelName?: string,
    keyType?: KeyState,
    key?: string,
    language?: Language,
    plural?: Plural,
    keyVersion?: number,
    filledTemplateHash?: string,
    text?: string,
    showSampleValues?: boolean,
  }) {
    const textNode = figma.getNodeById(nodeId)! as TextNode;

    if (changedProperties.labelName !== undefined) {
      // console.log('setting name');
      textNode.name = changedProperties.labelName;
      textNode.autoRename = false;
    }

    if (changedProperties.key !== undefined) {
      textNode.setPluginData(this.keyDataKey, changedProperties.key);
    }

    if (changedProperties.keyType !== undefined) {
      textNode.setPluginData(this.keyTypeDataKey, changedProperties.keyType);
    }

    if (changedProperties.keyVersion !== undefined) {
      textNode.setPluginData(this.keyVersionDataKey, `${changedProperties.keyVersion}`);
    }

    if (changedProperties.showSampleValues !== undefined) {
      textNode.setPluginData(this.sampleValuesDataKey, changedProperties.showSampleValues ? `${true}` : '');
    }

    if (changedProperties.text !== undefined) {
      const linkStyle = await this.getLinkStyle();

      await this.loadFontsForTextNodes([textNode]);

      const textWithDecorators = this.toTextRangeObject(changedProperties.text);

      const useSampleValues = textNode.getPluginData(this.sampleValuesDataKey) !== '';

      if (useSampleValues) {
        textNode.setPluginData(this.filledTemplateHashDataKey, changedProperties.filledTemplateHash ? changedProperties.filledTemplateHash : '');
      } else {
        textNode.setPluginData(this.filledTemplateHashDataKey, '');
      }

      textNode.characters = textWithDecorators.text;

      for (const rangeStyle of textWithDecorators.textDecorations) {
        if (rangeStyle.type === 'href') {
          textNode.setRangeHyperlink(rangeStyle.from, rangeStyle.to, { type: 'URL', value: rangeStyle.url });
          if (linkStyle) {
            textNode.setRangeFills(rangeStyle.from, rangeStyle.to, [
              JSON.parse(linkStyle),
            ]);
          }
        }
      }
    }

    if (changedProperties.plural !== undefined) {
      textNode.setPluginData(this.keyPluralDataKey, changedProperties.plural ? changedProperties.plural : '');
    }

    if (changedProperties.language !== undefined) {
      textNode.setPluginData(this.languageDataKey, changedProperties.language ? changedProperties.language : '');
    }

    return this.toLocalizedLabelOrUndefined(textNode)!.localizedLabel;
  }

  private async loadFontsForTextNodes(textNodes: TextNode[]) {
    const fontsToLoad = [] as FontName[];
    for (const textNode of textNodes) {
      this.getFonts(textNode, fontsToLoad);
    }
    await this.loadFonts(fontsToLoad);
  }

  private async loadFonts(fontArray = [] as FontName[]) {
    await Promise.all(fontArray.map(figma.loadFontAsync));
  }

  private getFonts(textNode: TextNode, fontArray = [] as FontName[]) {
    if (textNode.characters.length === 0) {
      if (!fontArray.find((font) => font.family === (textNode.fontName as FontName).family && font.style === (textNode.fontName as FontName).style)) {
        fontArray.push(textNode.fontName as FontName);
      }
    } else {
      const fontsToLoad = textNode.getRangeAllFontNames(0, textNode.characters.length);
      for (const fontToLoad of fontsToLoad) {
        if (!fontArray.find((font) => font.family === (fontToLoad as FontName).family && font.style === (fontToLoad as FontName).style)) {
          fontArray.push(fontToLoad as FontName);
        }
      }
    }
  }

  private extractKeyName(name: string) {
    // regex extracts the first word starting with at least three characters
    const nameParts = name.match(/[a-zA-Z]{3}[a-zA-Z0-9\-_]*/);
    if (nameParts) {
      return nameParts[0].toLowerCase();
    }
    return '';
  }

  private toTextRangeObject(tokenizedText: string) {
    const splitRegex = /(<a[^>]*>.*?<\/a>)/;
    const parts = tokenizedText.split(splitRegex);
    const textDecoration = [];
    let cleanedUpText = '';

    let currentPosition = 0;

    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (part.match(splitRegex)) {
        const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g;
        const linkParts = linkRegex.exec(part);
        if (linkParts) {
          cleanedUpText += linkParts![2];
          textDecoration.push({
            type: 'href',
            from: currentPosition,
            to: currentPosition + linkParts![2].length,
            url: linkParts![1],
          });

          currentPosition += linkParts![2].length;
        } else {
          cleanedUpText += part;
          currentPosition += part.length;
        }
      } else {
        cleanedUpText += part;
        currentPosition += part.length;
      }
    }

    return { text: cleanedUpText, textDecorations: textDecoration };
  }

  private toTokenizedText(node: TextNode) {
    const textnode = node as TextNode;

    if (textnode.characters.length === 0) {
      return '';
    }

    const hyperLinks = textnode.getStyledTextSegments(['hyperlink'], 0, textnode.characters.length);

    const originalText = textnode.characters;

    if (hyperLinks.length === 0) {
      return textnode.characters;
    }

    let carret = 0;
    const textChunks = [];

    for (const hyperLink of hyperLinks) {
      if (hyperLink.start !== carret) {
        textChunks.push(originalText.substring(carret, hyperLink.start));
      }

      if (hyperLink.hyperlink) {
        textChunks.push(`<a href="${hyperLink.hyperlink?.value}">${originalText.substring(hyperLink.start, hyperLink.end)}</a>`);
      } else {
        textChunks.push(originalText.substring(hyperLink.start, hyperLink.end));
      }

      carret = hyperLink.end;
    }

    if (carret !== originalText.length) {
      textChunks.push(originalText.substring(carret, originalText.length));
    }

    return textChunks.join('');
  }

  private toLocalizedLabelOrUndefined(node: TextNode): { parentIds: Set<string>, localizedLabel: LocalizedLabel } | undefined {
    let derivable = true;

    // we only take labels with "autoRename" active into account
    if (node.autoRename) {
      derivable = false;
    }

    // we skip nodes that are not visible
    if (!node.visible) {
      return;
    }

    let derivedName = this.extractKeyName(node.name);

    if (derivable && derivedName === '') {
      derivable = false;
    }

    let page: PageNode | null = null;
    let rootFrame: FrameNode | null = null;
    const parentIds = new Set<string>();

    let { x } = node;
    let { y } = node;
    let parent = node.parent as any;
    while (parent) {
      // we skip nodes where one of the parent nodes is invisible
      if (parent.visible === false) {
        return;
      }

      if (parent.type === 'FRAME') {
        rootFrame = parent as FrameNode;
      } else if (parent.type === 'PAGE') {
        page = parent as PageNode;
      }

      if (parent.type !== 'GROUP'
        && parent.type !== 'PAGE'
        && parent.parent && parent.parent.type !== 'PAGE') {
        x += parent.x;
        y += parent.y;
      }

      parentIds.add(parent.id);

      parent = parent.parent;
    }

    if (!page || !rootFrame) {
      return;
    }

    derivedName = this.extractKeyName(rootFrame.name) + this.separator + derivedName;

    const text = this.toTokenizedText(node);

    // if no plural id is specified than we fall back to "other" - the default plural
    const pluralId = node.getPluginData(this.keyPluralDataKey) === '' ? Plural.Other : node.getPluginData(this.keyPluralDataKey);
    const language = node.getPluginData(this.languageDataKey) === '' ? this.getBaseLanguageSync() : node.getPluginData(this.languageDataKey) as Language;
    const keyVersion = node.getPluginData(this.keyVersionDataKey) === '' ? -1 : parseInt(node.getPluginData(this.keyVersionDataKey), 10);

    const keyType = node.getPluginData(this.keyTypeDataKey) === '' || node.getPluginData(this.keyTypeDataKey) === undefined ? KeyState.Unset : node.getPluginData(this.keyTypeDataKey) as KeyState;
    const key = node.getPluginData(this.keyDataKey) === '' ? undefined : node.getPluginData(this.keyDataKey);
    const rootFrameLanguage = rootFrame.getPluginData(this.languageDataKey) === '' ? this.getBaseLanguageSync() : rootFrame.getPluginData(this.languageDataKey) as Language;
    const rootFrameUseSampleValues = rootFrame.getPluginData(this.sampleValuesDataKey) !== '';
    const useSampleValues = node.getPluginData(this.sampleValuesDataKey) !== '';

    const filledTemplateHash = node.getPluginData(this.filledTemplateHashDataKey) !== '' ? node.getPluginData(this.filledTemplateHashDataKey) : undefined;

    // eslint-disable-next-line consistent-return
    return {
      parentIds,
      localizedLabel: {
        pageId: page.id,
        pageName: page.name,
        rootFrameId: rootFrame.id,
        rootFrameName: rootFrame.name,
        rootFrameLanguage,
        language,
        rootFrameUseSampleValues,
        textChangedAfterGeneration: false,
        filledTemplateHash,
        useSampleValues,
        nodeId: node.id,
        name: node.name,
        height: node.height,
        width: node.width,
        x,
        y,
        keyType,
        key,
        keyVersion,
        derivedKey: derivable ? derivedName : undefined,
        pluralId: pluralId as Plural,
        text,
      },

    };
  }
}
