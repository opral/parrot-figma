/* eslint-disable no-await-in-loop */
/* eslint-disable class-methods-use-this */
import { text } from 'stream/consumers';
import FigmaUtil from '../../shared/FigmaUtil';
import { Language } from '../base/Language';
import { KeyState, LocalizedLabel } from './LocalizedLabel';
import { Plural } from '../base/Plural';
import ChangeEvent from './ChangeEvent';
import { FigmaFileTranslationKeyStore } from '../keystore/FigmaFileTranslationKeyStore';
import { Fillins } from '../keystore/TranslationKey';
import VirtualTree, { VirtualTreeNode } from './VirtualTree';
import LinksLoadedEvent from './LinksLoadedEvent';

export default class LocalizedLabelManager {
  translationKeyStore?: FigmaFileTranslationKeyStore;

  private containerSizeThreashold = 3000;

  public proxClassName = 'LocalizedLabelManager';

  public samplesPrefix = 'sample_values';

  public linkStyleDataKey = 'linkstyle';

  public separator = '__';

  public filledTemplateHashDataKey = 'fth';

  public sampleValuesDataKey = 'sv';

  public fillinsKey = 'fi';

  public languageDataKey = 'l';

  public keyTypeDataKey = 'kt';

  public keyVersionDataKey = 'kv';

  public keyPluralDataKey = 'kp';

  public keyDataKey = 'key';

  public labelIdDataKey = 'olid'; // we store the orginal label id (the id of the node when the plugin changed properties the first time) to detect a copy

  private virtualTree = new VirtualTree();

  private labelToKey = {} as {
    [nodeId: string]: string
  };

  private refreshLabelKeyLinkCache(textNodeId: string, key: string | undefined) {
    const currentKey = this.labelToKey[textNodeId];
    if (key === undefined || key === '') {
      if (currentKey) {
        this.translationKeyStore!.keyToLabels[currentKey]!.delete(textNodeId);
        return currentKey;
      }
      return undefined;
    }

    if (!this.translationKeyStore!.keyToLabels[key]) {
      this.translationKeyStore!.keyToLabels[key] = new Set<string>();
    }
    if (this.translationKeyStore!.keyToLabels[key].has(textNodeId)) {
      return undefined;
    }
    this.translationKeyStore!.keyToLabels[key].add(textNodeId);
    this.labelToKey[textNodeId] = key;

    if (currentKey) {
      if (currentKey !== key) {
        this.translationKeyStore!.keyToLabels[currentKey]!.delete(textNodeId);
      }
      return currentKey;
    }
    return undefined;
  }

  constructor(translationKeyStore: FigmaFileTranslationKeyStore | undefined) {
    this.translationKeyStore = translationKeyStore;

    if (translationKeyStore === undefined) {
      return;
    }

    figma.on('documentchange', this.forwardDocumentChanges.bind(this));
  }

  forwardDocumentChanges(event: any) {
    console.log('changes');
    console.log(event);
    const deletedIds = new Set<string>();
    const changedLabels = [] as LocalizedLabel[];
    const createdLabels = [] as LocalizedLabel[];
    const keysChanged = new Set<string>();
    for (const change of event.documentChanges) {
      // eslint-disable-next-line default-case
      switch (change.type) {
        case 'CREATE': {
          if (change.node.removed) {
            // we skip changes of removed nodes
            break;
          }
          const createdNode = figma.getNodeById(change.id)!;
          if (createdNode.type === 'TEXT') {
            const localizedLabel = this.toLocalizedLabelOrUndefined(createdNode as TextNode);
            if (localizedLabel) {
              this.virtualTree.addNode(createdNode, createdNode.id);
              if (localizedLabel.keyType === KeyState.Linked) {
                const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, localizedLabel.key!);
                if (previousKey !== localizedLabel.key!) {
                  if (previousKey) {
                    keysChanged.add(previousKey);
                  }
                  keysChanged.add(localizedLabel.key!);
                }
              } else {
                const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, undefined);
                if (previousKey) {
                  keysChanged.add(previousKey);
                }
              }
              createdLabels.push(localizedLabel);
            }
          } else if ((createdNode as FrameNode).children) {
            console.log(`Node created - with children ${change.id}`);
            const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
            figma.skipInvisibleInstanceChildren = true;
            const createdTextNodes = (createdNode as FrameNode).findAllWithCriteria({ types: ['TEXT'] });
            for (const createdTextNode of createdTextNodes) {
              const localizedLabel = this.toLocalizedLabelOrUndefined(createdTextNode);
              if (localizedLabel) {
                this.virtualTree.addNode(createdNode, createdNode.id);
                if (localizedLabel.keyType === KeyState.Linked) {
                  const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, localizedLabel.key!);
                  if (previousKey !== localizedLabel.key!) {
                    if (previousKey) {
                      keysChanged.add(previousKey);
                    }
                    keysChanged.add(localizedLabel.key!);
                  }
                } else {
                  const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, undefined);
                  if (previousKey) {
                    keysChanged.add(previousKey);
                  }
                }
                createdLabels.push(localizedLabel);
                // lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
              }
            }
            figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;
          }
          break;
        }
        case 'DELETE': {
          // in case of a deletion we propagate the deleted node id - we don't have more information
          // about this node from figma :-/ The ui layer will know what this change affects
          const deletedLeafs = this.virtualTree.removeBranch(change.id).filter((node) => node.cacheRelevant);
          deletedLeafs.forEach((node) => {
            this.refreshLabelKeyLinkCache(node.id, undefined);
            deletedIds.add(node.id);
          });
          console.log(`Node deleted ${change.id} leafs: ${JSON.stringify(deletedIds)}`);
          break;
        }
        case 'PROPERTY_CHANGE': {
          if (change.node.removed) {
            // we skip changes of removed nodes
            break;
          }
          const changedNode = figma.getNodeById(change.id);

          if (changedNode?.type === 'DOCUMENT') {
            break;
          }

          if (changedNode?.type === 'PAGE') {
            break;
          }

          if (changedNode?.type === 'TEXT') {
            console.log(`Node changed - text ${changedNode.id}`);

            if (!this.virtualTree.hasNode(changedNode.id)) {
              console.log(`Node changed - text ${changedNode.id} added to vt`);
              this.virtualTree.addNode(changedNode, changedNode.id);
            } else if (change.properties.includes('parent')) {
              console.log(`Node changed - text ${changedNode.id} moved...`);
              this.virtualTree.moveNode(changedNode!.id, changedNode!.parent!);
            }

            const localizedLabel = this.toLocalizedLabelOrUndefined(changedNode as TextNode);
            if (localizedLabel) {
              if (localizedLabel.keyType === KeyState.Linked) {
                const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, localizedLabel.key!);
                if (previousKey !== localizedLabel.key!) {
                  if (previousKey) {
                    keysChanged.add(previousKey);
                  }
                  keysChanged.add(localizedLabel.key!);
                }
              } else {
                const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, undefined);
                if (previousKey) {
                  keysChanged.add(previousKey);
                }
              }
              changedLabels.push(localizedLabel);
            }
          } else if ((changedNode as FrameNode).children) {
            let changedVirtualNodes = [] as VirtualTreeNode[];
            if (change.properties.includes('parent')) {
              changedVirtualNodes = this.virtualTree.moveNode(changedNode!.id, changedNode!.parent!);
              console.log(`Node changed - parent ${change.id} moved in vt affacted: ${JSON.stringify(changedVirtualNodes.length)}`);
            } else if (change.properties.includes('name')) {
              // if the name changed we have to update all childs since naming changes the key abrivation
              changedVirtualNodes = this.virtualTree.getAllNodesInBranchByRootId(changedNode!.id);
              console.log(`Node changed - ${change.id} name in vt affacted: ${JSON.stringify(changedVirtualNodes.length)}`);
            }
            // eslint-disable-next-line @typescript-eslint/no-loop-func
            changedVirtualNodes.forEach((changedVNode) => {
              if (changedVNode.cacheRelevant) {
                const movedFigmaNode = figma.getNodeById(changedVNode.id);
                if (movedFigmaNode && movedFigmaNode.type === 'TEXT') {
                  const localizedLabel = this.toLocalizedLabelOrUndefined(movedFigmaNode as TextNode);
                  if (localizedLabel) {
                    if (localizedLabel.keyType === KeyState.Linked) {
                      const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, localizedLabel.key!);
                      if (previousKey !== localizedLabel.key!) {
                        if (previousKey) {
                          keysChanged.add(previousKey);
                        }
                        keysChanged.add(localizedLabel.key!);
                      }
                    } else {
                      const previousKey = this.refreshLabelKeyLinkCache(localizedLabel.nodeId, undefined);
                      if (previousKey) {
                        keysChanged.add(previousKey);
                      }
                    }
                    changedLabels.push(localizedLabel);
                    // lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
                  }
                }
              }
            });
          }

          break;
        }
        case 'STYLE_CREATE':
        case 'STYLE_DELETE':
        case 'STYLE_PROPERTY_CHANGE':
          break;
      }
    }

    const message = {
      target: 'LocalizedLabelManager',
      type: 'cacheUpdate',
      deletedNodeIds: [...deletedIds],
      changedLabels: changedLabels.filter((node) => !createdLabels.some((createdNode) => createdNode.nodeId === node.nodeId)),
      createdLabels,
      changedKeys: [...keysChanged],
    } as ChangeEvent;

    console.log('keys changed');
    console.log(keysChanged);
    figma.ui.postMessage(message);
  }

  async startFillupCache() {
    // we start the async process here - this will load frame by frame and intercept each load with a tick
    this.fillUpCache().catch((e) => console.log(e));
  }

  async fillUpCache() {
    let start = Date.now();
    const containers = [];
    let textNodesToPrcoess = [] as TextNode[];
    console.log(`fillUpCache - enter ${Date.now() - start}`);
    await new Promise((resolve) => setTimeout(resolve, 2));

    const pages = figma.root.children;
    for (const page of pages) {
      // console.log('fillUpCache - page...' + page.name);
      for (const pageChild of page.children) {
        // console.log('fillUpCache - pageChilde...' + pageChild.name);
        if (pageChild.type === 'TEXT') {
          textNodesToPrcoess.push(pageChild);
        } else if (pageChild.type === 'COMPONENT'
          || pageChild.type === 'COMPONENT_SET'
          || pageChild.type === 'INSTANCE') {
          // we add it as container to collect
          containers.push(pageChild);
        } else if (pageChild.type === 'SECTION'
          || pageChild.type === 'GROUP'
          || pageChild.type === 'FRAME') {
          if (pageChild.width < this.containerSizeThreashold) {
            containers.push(pageChild);
          } else {
            for (const sectionChild of pageChild.children) {
              // console.log('fillUpCache - sectionChild...' + sectionChild.name);
              if (sectionChild.type === 'TEXT') {
                textNodesToPrcoess.push(sectionChild);
              } else if (sectionChild.type === 'COMPONENT'
                || sectionChild.type === 'COMPONENT_SET'
                || sectionChild.type === 'FRAME'
                || sectionChild.type === 'GROUP'
                || sectionChild.type === 'SECTION'
                || sectionChild.type === 'INSTANCE') {
                // we add it as container to collect
                containers.push(sectionChild);
              }
            }
          }
        }
      }
    }

    console.log(`fillUpCache - containers ${containers.length} collected ${Date.now() - start}`);
    await new Promise((resolve) => setTimeout(resolve, 2));
    let lastInterception = Date.now();

    const outerStart = Date.now();

    const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
    figma.skipInvisibleInstanceChildren = true;
    // collect missing textNodesToProcess
    for (const container of containers) {
      start = Date.now();
      // find all textNodes in the container

      // const foundtextNodes = container.findAllWithCriteria({ types: ['TEXT'] });
      const foundtextNodes = container.findAll().filter((node) => node.type === 'TEXT');

      if (foundtextNodes.filter((node) => node.id.indexOf(';') !== -1).length > 0) {
      // debugger;
      }
      textNodesToPrcoess = textNodesToPrcoess.concat(foundtextNodes as TextNode[]);

      const blockedExecutionTime = Date.now() - lastInterception;
      if (blockedExecutionTime > 30) {
        // console.log(`fillUpCache - ${container.name} textNodes ${foundtextNodes.length} collected ${Date.now() - start}`);
        // console.log(`fillUpCache - break because of blockage of ${blockedExecutionTime}`);
        lastInterception = Date.now();
        // eslint-disable-next-line no-promise-executor-return
        // await new Promise((resolve) => setTimeout(resolve, 2));
      }
    }
    figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

    console.log(`fillUpCache - collection of textNodes took ${Date.now() - outerStart}`);
    const localizedLabels = [];
    await new Promise((resolve) => setTimeout(resolve, 1));
    const innerStart = Date.now();

    const keysLoaded = new Set<string>();

    for (const textNode of textNodesToPrcoess) {
      const keyType = textNode.getPluginData(this.keyTypeDataKey);
      if (keyType !== '' && (keyType as KeyState) === KeyState.Linked) {
        const key = textNode.getPluginData(this.keyDataKey);
        if (key !== '') {
          const textNodeId = textNode.id;
          this.virtualTree.addNode(textNode, textNodeId);
          const previousKey = this.refreshLabelKeyLinkCache(textNodeId, key);
          if (previousKey) {
            keysLoaded.add(previousKey);
            this.virtualTree.addNode(textNode, textNodeId);
          }
          keysLoaded.add(key);
        }
      }
    }

    console.log(`fillUpCache - creating localizedLabels took ${Date.now() - innerStart}ms for ${localizedLabels.length} labels`);

    const message = {
      target: 'LocalizedLabelManager',
      type: 'linksLoaded',
      keys: [...keysLoaded],
    } as LinksLoadedEvent;

    // console.log(JSON.stringify(event));
    // console.log(message);
    figma.ui.postMessage(message);
  }

  async getSelection() {
    const selectionEnhanced = {} as {
      [keyId: string]: {
        rootFrameId: string | undefined;
        selectedNodeId: string,
        parentSelected: boolean,
        isLabel: boolean,
        key: string | undefined
      }
    };

    for (const selectedNode of figma.currentPage.selection) {
      const rootFrame = this.getRootFrame(selectedNode);

      if (selectedNode.type === 'TEXT') {
        const textNode = this.toLocalizedLabelOrUndefined(selectedNode as TextNode);
        // the node within the selection is a label
        selectionEnhanced[selectedNode.id] = {
          rootFrameId: rootFrame?.id,
          parentSelected: false,
          isLabel: selectedNode.type === 'TEXT',
          selectedNodeId: selectedNode.id,
          key: textNode?.keyType === KeyState.Linked ? textNode?.key : undefined,
        };
      } else {
        selectionEnhanced[selectedNode.id] = {
          parentSelected: false,
          isLabel: false,
          rootFrameId: rootFrame?.id,
          selectedNodeId: selectedNode.id,
          key: undefined,
        };

        const virtualSelectedNode = this.virtualTree.getVirtualNode(selectedNode.id);
        if (virtualSelectedNode) {
          // eslint-disable-next-line @typescript-eslint/no-loop-func
          this.virtualTree.getAllNodesInBranchByRootId(virtualSelectedNode.id).forEach((virtualNode) => {
            if (virtualNode.type === 'TEXT' && selectionEnhanced[virtualNode.id] === undefined) {
              const textNode = this.toLocalizedLabelOrUndefined(figma.getNodeById(virtualNode.id) as TextNode);
              selectionEnhanced[virtualNode.id] = {
                parentSelected: true,
                isLabel: true,
                rootFrameId: rootFrame?.id,
                selectedNodeId: virtualNode.id,
                key: textNode?.keyType === KeyState.Linked ? textNode?.key : undefined,
              };
            }
          });
        }
      }
    }

    return selectionEnhanced;
  }

  /**
   * Walks up the tree and returns the frame closest to the root node
   *
   * @param node the node to extract the root frame from
   * @returns the root frame (The last parent of type frame)
   */
  // eslint-disable-next-line class-methods-use-this
  getRootFrame(node: any): FrameNode | undefined {
    if (!node.parent) {
      throw new Error('given node has no parent');
    }
    let parent = node;

    let rootFrame: FrameNode | undefined;

    while (parent) {
      const parentType = parent.type;
      if ((parentType === 'COMPONENT'
        || parentType === 'COMPONENT_SET'
        || parentType === 'FRAME'
        || parentType === 'GROUP'
        || parentType === 'INSTANCE') && parent.width < this.containerSizeThreashold) {
        rootFrame = parent;
      }
      parent = parent.parent;
    }

    return rootFrame;
  }

  async getById(textNodeId: string) {
    const textNode = figma.getNodeById(textNodeId) as TextNode;
    const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
    if (lokalizedLabel) {
      if (!this.virtualTree.hasNode(textNode.id)) {
        this.virtualTree.addNode(textNode, textNode.id);
      }
    }
    return lokalizedLabel;
  }

  async getWithKey(key: string) {
    const labels = [] as LocalizedLabel[];
    if (this.translationKeyStore!.keyToLabels[key]) {
      for (const textNodeId of this.translationKeyStore!.keyToLabels[key]) {
        const textNode = figma.getNodeById(textNodeId) as TextNode;
        const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
        if (lokalizedLabel) {
          if (!this.virtualTree.hasNode(textNode.id)) {
            this.virtualTree.addNode(textNode, textNode.id);
          }
          labels.push(lokalizedLabel);
        }
      }
    }
    return labels;
  }

  async getFrameById(frameId: string): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[]
  }> {
    const frame = figma.getNodeById(frameId) as FrameNode;
    return this.getFrame(frame);
  }

  private async getFrame(frame: FrameNode): Promise<{
    id: string,
    name: string,
    localizedLabelsInFrame: LocalizedLabel[]
  }> {
    const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
    figma.skipInvisibleInstanceChildren = true;

    const frameData = {
      id: frame.id,
      name: frame.name,
      localizedLabelsInFrame: [] as LocalizedLabel[],
    };

    const textNodes = frame.findAllWithCriteria({ types: ['TEXT'] });

    for (const textNode of textNodes) {
      const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
      if (lokalizedLabel) {
        if (!this.virtualTree.hasNode(textNode.id)) {
          this.virtualTree.addNode(textNode, textNode.id);
        }
        frameData.localizedLabelsInFrame.push(lokalizedLabel);
        // lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
      }
    }

    figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

    return frameData;
  }

  async setLinkStyle(linkStyle: string) {
    figma.root.setPluginData(this.linkStyleDataKey, linkStyle);
  }

  async getLinkStyle() {
    const linkStyleRaw = figma.root.getPluginData(this.linkStyleDataKey);
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

  async updateLabelProperties(nodeId: string, changedProperties:
  {
    labelName?: string,
    keyType?: KeyState,
    key?: string,
    language?: Language,
    plural?: Plural,
    keyVersion?: number,
    filledTemplateHash?: string,
    translation?: string,
    fillins?: Fillins,
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

    if (changedProperties.fillins !== undefined) {
      textNode.setPluginData(this.fillinsKey, JSON.stringify(changedProperties.fillins));
    }

    if (changedProperties.translation !== undefined) {
      const linkStyle = await this.getLinkStyle();

      await this.loadFontsForTextNodes([textNode]);

      const textWithDecorators = this.toTextRangeObject(changedProperties.translation);

      textNode.setPluginData(this.filledTemplateHashDataKey, changedProperties.filledTemplateHash ? changedProperties.filledTemplateHash : '');
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

    return this.toLocalizedLabelOrUndefined(textNode)!;
  }

  async commitUndo() {
    return figma.commitUndo();
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

  private toLocalizedLabelOrUndefined(node: TextNode): LocalizedLabel | undefined {
    let derivable = true;

    if (node.autoRename) {
      derivable = false;
    }

    // we skip nodes that are not visible
    if (!node.visible) {
      return;
    }

    let derivedName = this.extractKeyName(node.name);
    derivable = false;

    if (derivable && derivedName === '') {
      derivable = false;
    }

    let page: PageNode | null = null;
    let rootFrame: FrameNode | null = null;
    const parentIds = [] as string[];

    let { x } = node;
    let { y } = node;
    let parent = node.parent as any;
    while (parent) {
      // we skip nodes where one of the parent nodes is invisible
      if (parent.visible === false) {
        return;
      }

      const parentType = parent.type;

      if ((parentType === 'COMPONENT'
                || parentType === 'COMPONENT_SET'
                || parentType === 'FRAME'
                || parentType === 'GROUP'
                || parentType === 'INSTANCE') && parent.width < this.containerSizeThreashold) {
        rootFrame = parent as FrameNode;
      } else if (parentType === 'PAGE') {
        page = parent as PageNode;
      }

      if (parentType !== 'GROUP'
        && parentType !== 'PAGE'
        && parent.parent && parent.parent.type !== 'PAGE') {
        x += parent.x;
        y += parent.y;
      }

      // 1/4 of the time...
      parentIds.push(parent.id);

      parent = parent.parent;
    }

    if (!page || !rootFrame) {
      return;
    }

    derivedName = this.extractKeyName(rootFrame.name) + this.separator + derivedName;

    // 1562ms -> 1071ms ~ 1/4
    const text = this.toTokenizedText(node);

    if (text.length === 1 && !/[0-9a-zA-Z\n\s]/.test(text)) {
      return;
    }

    // get plugin 1192ms -> 938ms

    // if no plural id is specified than we fall back to "other" - the default plural
    const pluralId = node.getPluginData(this.keyPluralDataKey) === '' ? Plural.OTHER : node.getPluginData(this.keyPluralDataKey);
    const language = node.getPluginData(this.languageDataKey) === '' ? this.translationKeyStore!.getConfigSync().baseLanguage! : node.getPluginData(this.languageDataKey) as Language;
    const keyVersion = node.getPluginData(this.keyVersionDataKey) === '' ? -1 : parseInt(node.getPluginData(this.keyVersionDataKey), 10);
    const fillins = node.getPluginData(this.fillinsKey) === '' ? {} : JSON.parse(node.getPluginData(this.fillinsKey));

    const keyType = node.getPluginData(this.keyTypeDataKey) === '' || node.getPluginData(this.keyTypeDataKey) === undefined ? KeyState.Unset : node.getPluginData(this.keyTypeDataKey) as KeyState;
    const key = node.getPluginData(this.keyDataKey) === '' ? undefined : node.getPluginData(this.keyDataKey);
    const rootFrameLanguage = rootFrame.getPluginData(this.languageDataKey) === '' ? this.translationKeyStore!.getConfigSync().baseLanguage! : rootFrame.getPluginData(this.languageDataKey) as Language;
    const rootFrameUseSampleValues = rootFrame.getPluginData(this.sampleValuesDataKey) !== '';
    const useSampleValues = node.getPluginData(this.sampleValuesDataKey) !== '';

    const filledTemplateHash = node.getPluginData(this.filledTemplateHashDataKey) !== '' ? node.getPluginData(this.filledTemplateHashDataKey) : undefined;

    // eslint-disable-next-line consistent-return
    return {
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
      fillins,
      derivedKey: derivable ? derivedName : undefined,
      pluralId: pluralId as Plural,
      text,
    };
  }

  getPluginData(key: string) {
    return '';
  }
}
