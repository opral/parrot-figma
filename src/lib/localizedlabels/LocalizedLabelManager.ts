import { formDataToBlob } from "formdata-polyfill/esm.min";
import { text } from "stream/consumers";
import { FigmaUtil } from "../../shared/FigmaUtil";
import { Language } from "../base/Language";
import { LocalizedLabel } from "../base/LocalizedLabel";
import { Plural } from "../base/Plural";
import { BaseTranslationKeyStore } from "../keystore/BaseTranslationKeyStore";


export class LocalizedLabelManager {

  translationKeyStore?: BaseTranslationKeyStore

  constructor(translationKeyStore: BaseTranslationKeyStore | undefined) {
    this.translationKeyStore = translationKeyStore

    if (translationKeyStore === undefined) {
      return
    }



    figma.on("documentchange", (event) => {

      let figmaUtil = new FigmaUtil();

      let changedNodesById = [] as string[]
      let rootFrameIdsToReload = [] as string[]
      let deletedNodeIds = [] as string[]
      let changedLabels = [] as LocalizedLabel[]
      console.log(JSON.stringify(event))
      for (const change of event.documentChanges) {
        switch (change.type) {
          case "CREATE":
            let rootFrame = figmaUtil.getRootFrame(figma.getNodeById(change.id));
            if (rootFrame && rootFrameIdsToReload.indexOf(rootFrame?.id) === -1) {
              rootFrameIdsToReload.push(rootFrame.id);
            }
            break;

          case "DELETE":
            console.log('deletion detected')
            if (deletedNodeIds.indexOf(change.id) === -1) {
              deletedNodeIds.push(change.id);
            }
            break;

          case "PROPERTY_CHANGE":

            let changedNode = figma.getNodeById(change.id);

            if (change.properties.indexOf('parent') !== -1) {
              // ask to invalidate current and new frame
              let rootFrame = figmaUtil.getRootFrame(figma.getNodeById(change.id));
              if (rootFrame && rootFrameIdsToReload.indexOf(rootFrame?.id) === -1) {
                rootFrameIdsToReload.push(rootFrame.id);
              }
            } else {
              // refresh single node
              // check if change did appear on a localized label
              // TODO what about a localized label that turns into a normal label again? is this possible?
              if (changedNode?.type == 'TEXT') {
                let localizedLabel = this.toLocalizedLabelOrUndefined(changedNode as TextNode)
                if (localizedLabel) {
                  changedLabels.push(localizedLabel.localizedLabel)
                }
              } else {
                if (changedNodesById.indexOf(change.id) === -1) {
                  changedNodesById.push(change.id);
                }
              }

            }
            break;

          case "STYLE_CREATE":
          case "STYLE_DELETE":
          case "STYLE_PROPERTY_CHANGE":
            break;
        }
      }


      figma.ui.postMessage({
        target: 'LocalizedLabelManager',
        type: 'cacheUpdate',
        changedNodesById: changedNodesById,
        rootFrameIdsToReload: rootFrameIdsToReload,
        deletedNodeIds: deletedNodeIds,
        changedLabels: changedLabels
      })
    });

  }


  public samplesPrefix = 'sample_values'
  public separator = '__'
  public sampleValuesDataKey = 'sampleValues'
  public languageDataKey = 'lang';
  public linkStilyDataKey = 'linkstyle'

  async getFrameById(frameId: string): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[],
    refreshTriggerIds: Set<string>
  }> {
    let frame = figma.getNodeById(frameId) as FrameNode
    return this.getFrame(frame);
  }

  async getFrame(frame: FrameNode): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[],
    refreshTriggerIds: Set<string>
  }> {


    let skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
    figma.skipInvisibleInstanceChildren = true

    let frameData = {
      id: frame.id,
      name: frame.name,
      refreshTriggerIds: new Set<string>(),
      localizedLabelsInFrame: [] as LocalizedLabel[]
    }

    let textNodes = frame.findAllWithCriteria({ types: ['TEXT'] });

    const start = Date.now();
    for (let textNode of textNodes) {
      let lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
      if (lokalizedLabel) {
        frameData.localizedLabelsInFrame.push(lokalizedLabel.localizedLabel)
        lokalizedLabel.parentIds.forEach(parentId => frameData.refreshTriggerIds.add(parentId));
      }
    }
    const end = Date.now();
    console.log(`findAllWithCriteria - Execution time: ${end - start} ms`);

    figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

    return frameData
  }

  async setLinkStyle(linkStyle: string) {
    figma.root.setPluginData(this.linkStilyDataKey, linkStyle);
  }

  async getLinkStyle() {
    let linkStyleRaw = figma.root.getPluginData(this.linkStilyDataKey);
    try {
      let _parsable = JSON.parse(linkStyleRaw);
      return linkStyleRaw
    } catch (e) {
      return ''
    }
  }

  async updateFrameProperties(frameNodeId: string, properties: { language: Language, sampleValues: boolean }) {

    let frame = figma.getNodeById(frameNodeId) as FrameNode
    if (!frame) {
      return
    }

    frame.setPluginData(this.languageDataKey, properties.language);

    if (properties.sampleValues) {
      frame.setPluginData(this.sampleValuesDataKey, true + '')
    } else {
      frame.setPluginData(this.sampleValuesDataKey, '')
    }

    await this.updateFrame(frame);

    console.log((new Date()).getTime() + 'execution finished - puting result into message');
  }

  private getFrameLanguage(frame: FrameNode) {
    let language = frame.getPluginData(this.languageDataKey)
    if (language === undefined || language !== '') {
      return Language.De // TODO return baselanguage instead
    }

    return language as Language
  }

  private getUseSampleValues(node: FrameNode | TextNode) {
    let useSampleValues = node.getPluginData(this.sampleValuesDataKey)
    if (useSampleValues === undefined || useSampleValues !== '') {
      return false
    }

    return true
  }


  async updateFrame(frame: FrameNode) {

    console.log('updateFrame extractAllKeysFromChildMixin')

    let lokalisedLabels = (await this.getFrame(frame)).localizedLabelsInFrame;
    // todo trigger update since the properties of the container frame changes the state of the localized labels

    await this.loadFontsForTextNodes(lokalisedLabels.map(lokalisedLabel => figma.getNodeById(lokalisedLabel.nodeId) as TextNode));

    let language = this.getFrameLanguage(frame);

    for (let localisedLabel of lokalisedLabels) {
      let textNodeId = localisedLabel.nodeId;

      let localizedText = this.translationKeyStore!.getKey(localisedLabel.key)?.translations[localisedLabel.rootFrameLanguage]?.[localisedLabel.pluralId]?.text

      if (localizedText !== undefined && localisedLabel.rootFrameUseSampleValues || localisedLabel.useSampleValues) {
        localizedText = this.translationKeyStore!.fillPlaceholdersWithSampleData(localizedText!, localisedLabel.rootFrameLanguage, localisedLabel.pluralId)
      }

      if (localizedText === undefined) {
        localizedText = localisedLabel.text
      }


      this.updateLocalisedLabelProperties(localisedLabel.nodeId, {
        plural: localisedLabel.pluralId,
        text: localizedText,
        showSampleValues: localisedLabel.useSampleValues
      })

    }
    console.log((new Date()).getTime() + ' updateFrame done')
  }

  async updateLocalisedLabelProperties(nodeId: string, changedProperties: { plural: Plural, text: string, showSampleValues: boolean }) {
    let textNode = figma.getNodeById(nodeId)! as TextNode;
    let linkStyle = await this.getLinkStyle();

    await this.loadFontsForTextNodes([textNode]);

    let textWithDecorators = this.toTextRangeObject(changedProperties.text);

    textNode.characters = textWithDecorators.text;

    for (let rangeStyle of textWithDecorators.textDecorations) {
      if (rangeStyle.type = 'href') {
        console.log(rangeStyle.url);
        textNode.setRangeHyperlink(rangeStyle.from, rangeStyle.to, { type: 'URL', value: rangeStyle.url });
        if (linkStyle) {
          textNode.setRangeFills(rangeStyle.from, rangeStyle.to, [
            JSON.parse(linkStyle)
          ])
        }

      }
    }

    if (changedProperties.plural) {
      textNode.setPluginData('plural', changedProperties.plural);
    } else {
      textNode.setPluginData('plural', '');
    }

    if (changedProperties.showSampleValues) {
      textNode.setPluginData('showSampleValues', changedProperties.showSampleValues + '');
    } else {
      textNode.setPluginData('showSampleValues', '');
    }

    return this.toLocalizedLabelOrUndefined(textNode)!.localizedLabel

  }

  private async loadFontsForTextNodes(textNodes: TextNode[]) {

    let fontsToLoad = [] as FontName[];
    for (let textNode of textNodes) {
      this.getFonts(textNode, fontsToLoad);
    }
    await this.loadFonts(fontsToLoad);

  }

  private async loadFonts(fontArray = [] as FontName[]) {
    await Promise.all(fontArray.map(figma.loadFontAsync));
  }

  private getFonts(textNode: TextNode, fontArray = [] as FontName[]) {
    if (textNode.characters.length == 0) {
      if (!fontArray.find((font) => { return font.family == (textNode.fontName as FontName).family && font.style == (textNode.fontName as FontName).style })) {
        fontArray.push(textNode.fontName as FontName)
      }
    } else {
      const fontsToLoad = textNode.getRangeAllFontNames(0, textNode.characters.length);
      for (let fontToLoad of fontsToLoad) {
        if (!fontArray.find((font) => { return font.family == (fontToLoad as FontName).family && font.style == (fontToLoad as FontName).style })) {
          fontArray.push(fontToLoad as FontName)
        }
      }
    }
  }

  private extractKeyName(name: string) {
    // regex extracts the first word starting with at least three characters
    let nameParts = name.match(/[a-zA-Z]{3}[a-zA-Z0-9\-_]*/);
    if (nameParts) {
      return nameParts[0].toLocaleLowerCase();
    }
    return '';
  }

  private toTextRangeObject(tokenizedText: string) {
    const splitRegex = /(<a[^>]*>.*?<\/a>)/;
    const parts = tokenizedText.split(splitRegex);
    const textDecoration = [];
    let cleanedUpText = ""

    let currentPosition = 0;

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      if (part.match(splitRegex)) {
        const linkRegex = /<a[^>]*href=["']([^"']*)["'][^>]*>(.*?)<\/a>/g;
        const linkParts = linkRegex.exec(part);
        if (linkParts) {
          cleanedUpText += linkParts![2]
          textDecoration.push({
            type: 'href',
            from: currentPosition,
            to: currentPosition + linkParts![2].length,
            url: linkParts![1]
          });

          currentPosition = currentPosition + linkParts![2].length
        } else {
          cleanedUpText += part
          currentPosition = currentPosition + part.length
        }
      } else {

        cleanedUpText += part
        currentPosition = currentPosition + part.length

      }
    }

    return { text: cleanedUpText, textDecorations: textDecoration };
  }

  private toTokenizedText(node: TextNode) {


    let textnode = node as TextNode

    let hyperLinks = textnode.getStyledTextSegments(['hyperlink'], 0, textnode.characters.length);

    let firstLinkStart = 0;
    let originalText = textnode.characters;

    if (hyperLinks.length == 0) {
      return textnode.characters;
    }

    let carret = 0;
    let textChunks = [];

    for (let hyperLink of hyperLinks) {

      if (hyperLink.start != carret) {
        textChunks.push(originalText.substring(carret, hyperLink.start));
      }

      if (hyperLink.hyperlink) {
        textChunks.push('<a href="' + hyperLink.hyperlink?.value + '">' + originalText.substring(hyperLink.start, hyperLink.end) + '</a>');
      } else {
        textChunks.push(originalText.substring(hyperLink.start, hyperLink.end));
      }

      carret = hyperLink.end;
    }

    if (carret != originalText.length) {
      textChunks.push(originalText.substring(carret, originalText.length));
    }

    return textChunks.join('');
  }

  private toLocalizedLabelOrUndefined(node: TextNode): { parentIds: Set<string>, localizedLabel: LocalizedLabel } | undefined {

    // we only take nodes with id into account
    if (node.autoRename) {
      return
    }

    // we skip nodes that are not visible
    if (!node.visible) {
      return
    }

    let namePrefix = this.extractKeyName(node.name);

    if (namePrefix == '') {
      return;
    }

    let page: PageNode | null = null
    let rootFrame: FrameNode | null = null
    let parentIds = new Set<string>();

    let x = node.x;
    let y = node.y;
    let parent = node.parent as any;
    while (parent) {

      // we skip nodes where one of the parent nodes is invisible
      if (parent.visible === false) {
        return;
      }

      if (parent.type == "FRAME") {
        rootFrame = parent as FrameNode
      } else if (parent.type == 'PAGE') {
        page = parent as PageNode
      }

      if (parent.type != 'GROUP' &&
        parent.type != 'PAGE' &&
        parent.parent && parent.parent.type != 'PAGE') {
        x = x + parent.x;
        y = y + parent.y;
      }

      parentIds.add(parent.id);

      parent = parent.parent;
    }

    if (!page || !rootFrame) {
      return
    }

    // if the node name starts with a $ the node references a key directly (used to show mapped values in samples)
    if (node.name.indexOf('$') === 0) {
      if (node.name.match(/\$[a-zA-Z]{3,}/g)) {
        // nothing to do we just use the exact name to resolve the key
        namePrefix = namePrefix;
      } else {
        namePrefix = this.samplesPrefix + this.separator + node.name.slice(1);
      }

    } else if (rootFrame.name === this.samplesPrefix) {
      namePrefix = this.samplesPrefix + this.separator + node.name
    } else {
      namePrefix = this.extractKeyName(rootFrame.name) + this.separator + namePrefix
    }

    let text = this.toTokenizedText(node)

    let pluralId = node.getPluginData('pluralId') === '' ? Plural.Other : node.getPluginData('pluralId');
    return {
      parentIds: parentIds,
      localizedLabel: {
        pageId: page.id,
        pageName: page.name,
        rootFrameId: rootFrame.id,
        rootFrameName: rootFrame.name,
        rootFrameLanguage: rootFrame.getPluginData(this.languageDataKey) === '' ? Language.De : rootFrame.getPluginData(this.languageDataKey) as Language,
        rootFrameUseSampleValues: rootFrame.getPluginData(this.sampleValuesDataKey) === '' ? false : true,
        useSampleValues: node.getPluginData(this.sampleValuesDataKey) === '' ? false : true,
        nodeId: node.id,
        name: node.name,
        height: node.height,
        width: node.width,
        x: x,
        y: y,
        key: namePrefix,
        pluralId: pluralId as Plural,
        text: text,
      }

    }

  }


}
