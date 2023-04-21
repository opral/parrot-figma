/* eslint-disable class-methods-use-this -- this class gets proxied using the async proxy - this doesn't work with static methods for now :-/ */
/**
 * Figma api wrapper that simplifies varios task.
 * All public async functions only accept and return primitives and can be proxied between sandbox and iframe
 */
export default class FigmaUtil {
  public proxClassName = 'FigmaUtil';

  private getFileKey(): string {
    let fileKey = figma.root.getPluginData('uniqFileKey');
    if (!fileKey) {
      fileKey = `${Math.floor(Math.random() * 100)}`;
      figma.root.setPluginData('uniqFileKey', fileKey);
    }

    return fileKey;
  }

  async getLocalFileConfig(key: string) {
    const fileKey = this.getFileKey();
    const value = await figma.clientStorage.getAsync(`${fileKey}__${key}`);

    console.log(`${fileKey}__${key} - ${value} GET LOCALFILE`);
    return value !== '' ? value : undefined;
  }

  async setLocalFileConfig(key: string, value: any) {
    const fileKey = this.getFileKey();
    console.log(`${fileKey}__${key} - ${value} SET LOCALFILE`);
    return figma.clientStorage.setAsync(`${fileKey}__${key}`, value);
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

  async getSelectedNodeIds() {
    return figma.currentPage.selection.map(node => node.id)
  }

  async selectNodes(nodeIds: string[]) {
    const nodesToSelect = [] as SceneNode[];

    for (const nodeId of nodeIds) {
      const node = figma.getNodeById(nodeId) as SceneNode;
      if (!node) {
        console.log(`WARNING: node with id ${nodeId} not found in select nodes`);
        continue;
      }
      nodesToSelect.push(node);
    }

    if (nodesToSelect.length > 0) {
      figma.currentPage.selection = nodesToSelect;
    }
  }

  async scrollAndZoomNodesIntoView(nodeIds: string[]) {
    const nodesToSelect = [] as SceneNode[];

    for (const nodeId of nodeIds) {
      const node = figma.getNodeById(nodeId) as SceneNode;
      if (!node) {
        console.log(`WARNING: node with id ${nodeId} not found in select nodes`);
        continue;
      }
      nodesToSelect.push(node);
    }

    if (nodesToSelect.length > 0) {
      figma.viewport.scrollAndZoomIntoView(nodesToSelect);
    }
  }

  async loadFontsForNodesWithId(textNodeIds: string[]) {
    await this.loadFontForTextNodes(textNodeIds.map((textNodeId) => figma.getNodeById(textNodeId)! as TextNode));
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
