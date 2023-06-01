/* eslint-disable class-methods-use-this -- this class gets proxied using the async proxy - this doesn't work with static methods for now :-/ */

import { KeyState, LocalizedLabel } from '../lib/localizedlabels/LocalizedLabel';


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

  async drawKeyFrame(frameNodeId: string, name: string, localizedLabelsInFrame: LocalizedLabel[]) {
    const frame = figma.getNodeById(frameNodeId);
    const MARGIN = 50;


    let keyFrame: FrameNode | null = null;
    /* if (frame.getPluginData('keyFrameId')) {
        let oldFrame = figma.getNodeById(frame.getPluginData('keyFrameId')) as FrameNode | null
        if (oldFrame) {
            oldFrame.remove()
        }
    } */

    keyFrame = figma.createFrame();
    keyFrame.name = 'Localized Keys';

    // frame.setPluginData('keyFrameId', keyFrame.id);

    const frameFrame = frame as FrameNode;

    keyFrame.x = frameFrame.x - MARGIN;
    keyFrame.y = frameFrame.y - MARGIN;

    keyFrame.fills = [{
      type: 'SOLID',
      visible: false,
      color: { r: 200 / 255, g: 200 / 255, b: 200 / 255 },
    }];

    let fontToLoad = null;

    let maxRight = 0;
    let maxBottom = (frame as FrameNode).height;
    let i = 0;
    for (const nodeWithKey of localizedLabelsInFrame) {
      if (nodeWithKey.keyType !== KeyState.Linked) {
        // eslint-disable-next-line no-continue
        continue;
      }

      const textNode = figma.createText();

      textNode.y = MARGIN + (40 * i);
      textNode.x = frameFrame.width + MARGIN + MARGIN;

      if (!fontToLoad) {
        fontToLoad = textNode.fontName as FontName;

        // Load the font in the text node before setting the characters
        // eslint-disable-next-line no-await-in-loop
        await figma.loadFontAsync(fontToLoad);
      }

      // Set bigger font size and red color
      textNode.fontSize = 18;
      textNode.fills = [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }];
      textNode.characters = nodeWithKey.key!;

      maxRight = Math.max(textNode.x + textNode.width, maxRight);
      maxBottom = Math.max(textNode.y + textNode.height, maxBottom);

      keyFrame.appendChild(textNode);

      // Move to (50, 50)
      const x1 = nodeWithKey.x + (nodeWithKey.width / 2) + MARGIN;
      const y1 = nodeWithKey.y + MARGIN;

      const x2 = textNode.x - 5;
      const y2 = textNode.y + (textNode.height / 2);

      const leftTop = {
        x: x1 < x2 ? x1 : x2,
        y: y1 < y2 ? y1 : y2,
      };

      const rightBottom = {
        x: x1 > x2 ? x1 : x2,
        y: y1 > y2 ? y1 : y2,
      };

      const width = rightBottom.x - leftTop.x;
      const height = rightBottom.y - leftTop.y;

      const length = Math.sqrt(width ** 2 + height ** 2);

      const line = figma.createLine();
      line.x = x1;
      line.y = y1;
      line.name = nodeWithKey.key!;

      // Make line 200px long
      line.resize(length, 0);

      // 4px thick red line with arrows at each end
      line.strokeWeight = 1;
      line.strokes = [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }];
      line.dashPattern = [2, 2];

      const width2 = x2 - x1;
      const height2 = y2 - y1;

      line.rotation = -Math.atan2(height2, width2) * 180 / Math.PI;

      keyFrame.appendChild(line);

      i++;
    }

    keyFrame.resize(maxRight + MARGIN, maxBottom + MARGIN);

    const fills: Paint[] = [{
      type: 'SOLID',
      color: { r: 200 / 255, g: 200 / 255, b: 200 / 255 },
      opacity: 0.28,
    }];

    // draw a semi transparent box around the original frame
    const rectLeft = figma.createRectangle();
    rectLeft.x = 0;
    rectLeft.y = 0;
    rectLeft.resize(MARGIN, maxBottom + MARGIN);
    rectLeft.fills = fills;

    keyFrame.insertChild(0, rectLeft);

    const rectRight = figma.createRectangle();
    rectRight.x = frameFrame.width + MARGIN;
    rectRight.y = 0;
    rectRight.resize(maxRight - MARGIN - frameFrame.width, maxBottom + MARGIN);
    rectRight.fills = fills;
    keyFrame.insertChild(0, rectRight);

    const rectTop = figma.createRectangle();
    rectTop.x = MARGIN;
    rectTop.y = 0;
    rectTop.resize(frameFrame.width, MARGIN - 30);
    rectTop.fills = fills;
    keyFrame.insertChild(0, rectTop);

    const rectBottom = figma.createRectangle();
    rectBottom.x = MARGIN;
    rectBottom.y = frameFrame.height + MARGIN;
    rectBottom.resize(frameFrame.width, maxBottom - frameFrame.height + MARGIN);
    rectBottom.fills = fills;
    keyFrame.insertChild(0, rectBottom);
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
    return figma.currentPage.selection.map((node) => node.id);
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
