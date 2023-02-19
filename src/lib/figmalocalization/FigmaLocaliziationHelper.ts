import { Plural } from "../base/Plural";
import { LocalizedLabel as LocalizedLabel } from "../base/LocalizedLabel";

export class FigmaLocaliziationHelper {

  // used to separate key names in the tree (FrameName + "__" + TextNodeName)
  public static separator = '__'

  public static samplesPrefix = 'sample_values'

  public static languageDataKey = 'currentLanguage'

  public static sampleValuesDataKey = 'sampleValues'

  
  public static toLocalizedLabelOrUndef(node: any, selected: boolean): LocalizedLabel | undefined {
    if (node.type !== "TEXT") {
      return
    }

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

    let x = node.x;
    let y = node.y;
    let parent = node.parent;
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


    let pluralId = node.getPluginData('pluralId') === '' ? Plural.Other : node.getPluginData('pluralId');
    return {
      pageId: page.id,
      pageName: page.name,
      rootFrameId: rootFrame.id,
      rootFrameName: rootFrame.name,
      rootFrameLanguage: rootFrame.getPluginData(this.languageDataKey) === '' ? 'none' : rootFrame.getPluginData(this.languageDataKey),
      useSampleValues: rootFrame.getPluginData(this.sampleValuesDataKey) === '' ? false : true,
      nodeId: node.id,
      height: node.height,
      width: node.width,
      x: x,
      y: y,
      key: namePrefix,
      selected: selected,
      keyExists: false,
      plurals: [pluralId],
      pluralId: pluralId,
      figmaText: this.toTokenizedText(node),
    }

  }

  static toTokenizedText(node: TextNode) {

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
          textChunks.push('<a href="'+hyperLink.hyperlink?.value+'">' + originalText.substring(hyperLink.start, hyperLink.end) + '</a>');
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

  static toTextRangeObject(tokenizedText: string) {
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
            to:  currentPosition + linkParts![2].length,
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

  static extractAllKeysFromChildMixin(container: ChildrenMixin, selection: readonly SceneNode[]) {
    let selectedTextNodes: LocalizedLabel[] = [];
    container.findAll().forEach(node => {
      let selected = selection.find(selectedNode => selectedNode.id == node.id) !== undefined
      let textNode = this.toLocalizedLabelOrUndef(node, selected);
      if (textNode) {
        selectedTextNodes.push(textNode);
      }
    })

    let containerRatio = (container as FrameNode).height / (container as FrameNode).width

    return selectedTextNodes.sort((a: any, b: any) => {
      return Math.hypot(a.x, a.y*containerRatio) - Math.hypot(b.x, b.y*containerRatio)
    })

  }



  private static lastSelecedPageId = null as string | null
  private static lastSelecedRootFrameIds = [] as string[]

  public static extractKeys(document: DocumentNode, currentPage: PageNode, selection: readonly SceneNode[]) : LocalizedLabel[] {
    let selectedTextNodes: LocalizedLabel[] = [];

    // if a page are selected and selection is empty show all text fields within the page - if it is connected
    if (selection.length == 0) {

      if (this.lastSelecedPageId != currentPage.id) {
        return selectedTextNodes;
      }

      let rootFrameIds: string[] = []

      this.lastSelecedRootFrameIds.forEach(nodeId => {
        let rootFrame = figma.getNodeById(nodeId) as ChildrenMixin
        if (rootFrame && rootFrameIds.indexOf(nodeId) === -1) {
          rootFrameIds.push(nodeId);
          selectedTextNodes.push(...this.extractAllKeysFromChildMixin(rootFrame, selection));
          this.lastSelecedPageId = currentPage.id;
          this.lastSelecedRootFrameIds = rootFrameIds;
        } 

      })
      return selectedTextNodes;

    } else {
      // only frames are selected!
      let rootFrameIds: string[] = []

      // filter text nodes
      currentPage.selection.forEach(node => {

        let rootFrame = this.getRootFrame(node);
        if (rootFrame && rootFrameIds.indexOf(rootFrame.id) === -1) {
          rootFrameIds.push(rootFrame.id);
          selectedTextNodes.push(...this.extractAllKeysFromChildMixin(rootFrame, selection));
          this.lastSelecedPageId = currentPage.id;
          this.lastSelecedRootFrameIds = rootFrameIds;
        } 

      })
      return selectedTextNodes
    }

    
  }


  private static extractKeyName(name: string) {
    // regex extracts the first word starting with at least three characters
    let nameParts = name.match(/[a-zA-Z]{3}[a-zA-Z0-9\-_]*/);
    if (nameParts) {
      return nameParts[0].toLocaleLowerCase();
    }
    return '';
  }

  /**
   * Walks up the tree and returns the frame closest to the root node
   * 
   * @param node the node to extract the root frame from 
   * @returns the root frame (The last parent of type frame)
   */
   private static getRootFrame(node: any): FrameNode | undefined {
    let parent = node.parent;

    let rootFrame: FrameNode | undefined

    if (node.type === "FRAME") {
      rootFrame = node
    }

    while (parent) {

      if (parent.type == "FRAME") {
        rootFrame = parent as FrameNode
      }

      parent = parent.parent;
    }

    return rootFrame
  }

}

