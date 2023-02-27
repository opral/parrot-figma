import { Plural } from "../base/Plural";
import { LocalizedLabel as LocalizedLabel } from "../localizedlabels/LocalizedLabel";
import { Language } from "../base/Language";

export class FigmaLocaliziationHelper {



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

