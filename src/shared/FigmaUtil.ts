/* eslint-disable class-methods-use-this -- this class gets proxied using the async proxy - this doesn't work with static methods for now :-/ */
/**
 * Figma api wrapper that simplifies varios task.
 * All public async functions only accept and return primitives and can be proxied between sandbox and iframe
 */
export default class FigmaUtil {
  public proxClassName = 'FigmaUtil';

  async getSelection() {
    const selections = [];
    for (const node of figma.currentPage.selection) {
      const rootFrame = this.getRootFrame(node);
      if (rootFrame) {
        selections.push({ rootFrameId: rootFrame.id, selectedNodeId: node.id });
      }
    }
    return selections;
  }

  async scrollIntoViewIfNeeded(nodeId: string) {
    // console.log('scrollIntoViewIfNeeded');
    const nodeScrollAndZoomIntoView = figma.getNodeById(nodeId) as SceneNode;
    const nodeRect = nodeScrollAndZoomIntoView.absoluteBoundingBox;
    const viewportRect = figma.viewport.bounds;

    // console.log(nodeRect);
    // console.log(viewportRect);

    if (nodeRect && (nodeRect.x < viewportRect.x
            || nodeRect.x + nodeRect.width > viewportRect.x + viewportRect.width
            || nodeRect.y < viewportRect.y
            || nodeRect.y + nodeRect.height > viewportRect.y + viewportRect.height)) {
      figma.viewport.scrollAndZoomIntoView([nodeScrollAndZoomIntoView]);
    }
  }

  async scrollAndZoomIntoView(nodeId: string) {
    const nodeScrollAndZoomIntoView = figma.getNodeById(nodeId) as SceneNode;

    if (nodeScrollAndZoomIntoView) {
      figma.viewport.scrollAndZoomIntoView([nodeScrollAndZoomIntoView]);
    }
  }

  async selectNode(nodeId: string) {
    const nodeToSelect = figma.getNodeById(nodeId) as SceneNode;

    if (nodeToSelect) {
      figma.currentPage.selection = [nodeToSelect!];
    }
  }

  async loadFontsForNodesWithId(textNodeIds: string[]) {
    await this.loadFontForTextNodes(textNodeIds.map((textNodeId) => figma.getNodeById(textNodeId)! as TextNode));
  }

  /**
     * Walks up the tree and returns the frame closest to the root node
     *
     * @param node the node to extract the root frame from
     * @returns the root frame (The last parent of type frame)
     */
  // eslint-disable-next-line class-methods-use-this
  public getRootFrame(node: any): FrameNode | undefined {
    if (!node.parent) {
      console.log(node);
      throw new Error('given node has no parent');
    }
    let { parent } = node;

    let rootFrame: FrameNode | undefined;

    if (node.type === 'FRAME') {
      rootFrame = node;
    }

    while (parent) {
      if (parent.type === 'FRAME') {
        rootFrame = parent as FrameNode;
      }

      parent = parent.parent;
    }

    return rootFrame;
  }

  private async loadFontForTextNodes(textNodes: TextNode[]) {
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
}
