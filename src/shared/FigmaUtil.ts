
/**
 * Figma api wrapper that simplifies varios task. 
 * All public async functions only accept and return primitives and can be proxied between sandbox and iframe
 */
export class FigmaUtil {

    async setClientStorage(key: string, value: any): Promise<void> {
        await figma.clientStorage.setAsync(key, value);
    }

    async getClientStorage(key: string): Promise<any | undefined> {
        return await figma.clientStorage.getAsync(key);
    }

    async setFileData(key: string, value: string): Promise<void> {
        await figma.root.setPluginData(key, value);
    }

    async getFileData(key: string): Promise<string> {
        return figma.root.getPluginData(key);
    }

    async scrollIntoViewIfNeeded(nodeId: string) {
        console.log('scrollIntoViewIfNeeded');
        let nodeScrollAndZoomIntoView = figma.getNodeById(nodeId) as SceneNode;
        const nodeRect = nodeScrollAndZoomIntoView.absoluteBoundingBox;
        const viewportRect = figma.viewport.bounds

        console.log(nodeRect);
        console.log(viewportRect);

        if (nodeRect && (nodeRect.x < viewportRect.x || 
            nodeRect.x + nodeRect.width > viewportRect.x + viewportRect.width ||
            nodeRect.y < viewportRect.y || 
            nodeRect.y + nodeRect.height > viewportRect.y + viewportRect.height)) {
            figma.viewport.scrollAndZoomIntoView([nodeScrollAndZoomIntoView]);
        } 
    }

    async scrollAndZoomIntoView(nodeId: string) {
        let nodeScrollAndZoomIntoView = figma.getNodeById(nodeId) as SceneNode;

        if (nodeScrollAndZoomIntoView) {
            figma.viewport.scrollAndZoomIntoView([nodeScrollAndZoomIntoView]);
        }
    }

    async selectNode(nodeId: string) {
        console.log('selectNode')
        let nodeToSelect = figma.getNodeById(nodeId) as SceneNode;

        if (nodeToSelect) {
            figma.currentPage.selection = [nodeToSelect!];
        }
    }

    async loadFontsForNodesWithId(textNodeIds: string[]) {
        await this.loadFontForTextNodes(textNodeIds.map(textNodeId => figma.getNodeById(textNodeId)! as TextNode))
    }

    private async loadFontForTextNodes(textNodes: TextNode[]) {
        

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
            if (!fontArray.find((font) => { return font.family == (textNode.fontName as FontName).family && font.style == (textNode.fontName as FontName).style})) {
                fontArray.push(textNode.fontName as FontName)
            }
        } else {
            const fontsToLoad = textNode.getRangeAllFontNames(0, textNode.characters.length);
            for (let fontToLoad of fontsToLoad) {
                if (!fontArray.find((font) => { return font.family == (fontToLoad as FontName).family && font.style == (fontToLoad as FontName).style})) {
                    fontArray.push(fontToLoad as FontName)
                }
            }
        }
    }
}
