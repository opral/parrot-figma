import { documentChanges } from "../../shared/DocumentChanges";
import type { Message } from "../message/LegacyMessage";
import { Locale } from "../message/variants/Locale";
import { LabelStyle, LocalizedLabel } from "./LocalizedLabel";
import ChangeEvent from "./ChangeEvent";
import VirtualTree, { VirtualTreeNode } from "./VirtualTree";
import LinksLoadedEvent from "./LinksLoadedEvent";
import TextNodeLinter from "./lint/TextNodeLinter";
import FontHelper from "./FontUtil";
import { InlangMessageStore } from "../message/store/InlangMessageStoreFigmaRoot";
import { FillinToPlaceholder as FillinsToPlaceholder } from "../message/MessageExtnesions";
import { MessageParameterValues } from "../message/MessageParameterValues";
import {
	restoreTextFillRanges,
	rangeMatches,
	setTextFillRange,
	type TextFillRange,
} from "./RichTextFormatting";
import { normalizeText } from "./LinkSuggestions";

export interface NodeSelection {
	[nodeId: string]: {
		rootFrameId: string | undefined;
		selectedNodeId: string;
		directSelection: boolean;
		isLabel: boolean;
		messageId: string | undefined;
	};
}

export interface SandboxUpdateLabelProperties {
	labelName?: string;
	messageState:
		| { type: "linked"; messageId: string; parameterValues: MessageParameterValues }
		| { type: "unlinked"; unlinkedMessage: Message; parameterValues: MessageParameterValues }
		| { type: "unmanaged"; unmanaged: boolean }
		| { type: "unset" }
		| undefined;
	language?: Locale;
	messageVersion?: number;
	variantPatternHTMLHash?: string;
	characters?: string;
	ops?: any;
	// TODO #18 selectors replace with variables
	fillinsToPlaceholder?: FillinsToPlaceholder | null;
}

export interface DeltaOp {
	start: number;
	end: number;
	attributes: {
		placeholder?: {
			name: string;
			unnamed: boolean;
			argumentPosition?: number;
			formatFn?: string;
			options?: any;
			invisibleMarkers: number;
		};
		link?: string;
		textDecoration?: TextDecoration;
		bold?: boolean;
		italic?: boolean;
		fontFamily?: string;
		indentation?: number;
		list?: string;
	};
	processed?: boolean;
	ignoreForLabelStyle?: boolean;
}

interface CachedTextNode extends TextNode {
	_cachedNode?: TextNode;
}

export const MARKER_CHARACTER = "​";
// eslint-disable-next-line no-irregular-whitespace -- this is on purpose to have a zero width space in figma
// export const MARKER_CHARACTER = 'X​';
export default class LocalizedLabelManager {
	private containerSizeThreashold = 3000;

	public proxyClassName = "LocalizedLabelManager";

	public samplesPrefix = "sample_values";

	public linkStyleDataKey = "linkstyle";

	public separator = "__";

	public variantPatternHTMLHashDataKey = "fth";

	public sampleValuesDataKey = "sv";

	public anonymMessageDataKey = "aim";

	public fillinsToPlaceholderKey = "fitp";

	public parameterValuesKey = "pv";

	public languageDataKey = "l";

	public messageUnmanagedKey = "mum";

	//  public messageVersionDataKey = 'mv';

	public messageNameDataKey = "mn";

	public messageNamePrefixKey = "mn_";

	// hash that allows detection of autorename
	public autoRenameHashKey = "arh";

	public labelIdDataKey = "olid"; // we store the orginal label id (the id of the node when the plugin changed properties the first time) to detect a copy

	private virtualTree = new VirtualTree();

	private readonly labelLinter = new TextNodeLinter();

	private labelToMessage = new Map<string, string>();

	firstTextnodeInViewport: undefined | string;

	private refreshLabelMessageLinkCache(textNodeId: string, messageId: string | undefined) {
		const links = this.messageStore!.messageIdToLabels;
		const currentKey = this.labelToMessage.get(textNodeId);
		if (!messageId) {
			if (currentKey) links.get(currentKey)?.delete(textNodeId);
			this.labelToMessage.delete(textNodeId);
			const virtualNode = this.virtualTree.getVirtualNode(textNodeId);
			if (virtualNode) virtualNode.messageId = undefined;
			return currentKey;
		}
		let labels = links.get(messageId);
		if (!labels) {
			labels = new Set<string>();
			links.set(messageId, labels);
		}
		if (labels.has(textNodeId)) return undefined;
		labels.add(textNodeId);
		this.labelToMessage.set(textNodeId, messageId);
		const virtualNode = this.virtualTree.getVirtualNode(textNodeId);
		if (virtualNode) virtualNode.messageId = messageId;
		if (currentKey && currentKey !== messageId) links.get(currentKey)?.delete(textNodeId);
		return currentKey;
	}

	private async getNode(nodeId: string) {
		const cached = this.virtualTree.getVirtualNode(nodeId)?.sourceNode;
		if (cached && !cached.removed) return cached;
		const node = await figma.getNodeByIdAsync(nodeId);
		if (node && !node.removed) this.virtualTree.addNode(node, node.id);
		return node;
	}

	private rememberChangedNodes(changes: readonly any[]) {
		for (const change of changes) {
			if (change.type !== "DELETE" && change.node && !change.node.removed) {
				this.virtualTree.addNode(change.node, change.id);
			}
		}
	}

	private observedPages = new Map<
		string,
		{ page: PageNode; listener: (event: NodeChangeEvent) => void }
	>();
	private changesQueue = Promise.resolve();
	private activeBulkUpdates = 0;
	private bulkUpdateWaiters: (() => void)[] = [];

	private queueDocumentChanges(event: { documentChanges: readonly any[] }) {
		this.rememberChangedNodes(event.documentChanges);
		this.changesQueue = this.changesQueue
			.then(async () => {
				// A yielded mutation batch is still in progress. Read its final state once it finishes.
				while (this.activeBulkUpdates) {
					await new Promise<void>((resolve) => this.bulkUpdateWaiters.push(resolve));
				}
				await this.forwardDocumentChanges(event);
			})
			.catch((error) => console.error("Parrot document change failed", error));
	}

	private observePage(page: PageNode) {
		if (this.observedPages.has(page.id)) return;
		const listener = (event: NodeChangeEvent) => {
			if (documentChanges.active) return;
			this.queueDocumentChanges({ documentChanges: event.nodeChanges });
		};
		this.observedPages.set(page.id, { page, listener });
		page.on("nodechange", listener);
	}

	private disposePageObservers() {
		for (const { page, listener } of this.observedPages.values()) {
			if (!page.removed) page.off("nodechange", listener);
		}
		this.observedPages.clear();
	}

	messageStore: InlangMessageStore | undefined;

	constructor(messageStore?: InlangMessageStore) {
		if (!messageStore) {
			return;
		}

		this.messageStore = messageStore;

		this.observePage(figma.currentPage);
		documentChanges.on("documentchange", (event) => {
			this.queueDocumentChanges(event);
		});
		figma.on("currentpagechange", () => {
			this.observePage(figma.currentPage);
			figma.ui.postMessage({ type: "event", name: "selectionchange" });
		});

		const selectedNodeStateByUser = {} as any;
		// eslint-disable-next-line @typescript-eslint/no-this-alias -- we need to access this in the interval
		const that = this;
		setInterval(() => {
			const changeEvent = {
				documentChanges: [] as any[],
			};
			// for (const user of [figma.currentUser]) { // NOTE: activeUsers is only available in figJam :/
			// if (user?.id && user?.selection.length === 1) {
			if (figma.currentPage.selection.length === 1) {
				const activeNode = figma.currentPage.selection[0]; // await this.getNode(user.selection[0]);
				const user = { id: "singleUser" };
				const currentState = {
					nodeId: "",
					textSegments: [] as any[],
				};
				if (activeNode !== undefined && activeNode?.type === "TEXT") {
					currentState.nodeId = activeNode?.id;
					const unpropagatedTextSegments = activeNode.getStyledTextSegments([
						"indentation",
						"listOptions",
					]);
					for (const textSegment of unpropagatedTextSegments) {
						currentState.textSegments.push({
							indentation: textSegment.indentation,
							listOptions: textSegment.listOptions,
						});
					}

					if (
						!selectedNodeStateByUser[user.id] ||
						selectedNodeStateByUser[user.id].nodeId !== currentState.nodeId
					) {
						selectedNodeStateByUser[user.id] = currentState;
						// console.log('no change');
					} else if (
						selectedNodeStateByUser[user.id].textSegments.length !==
						currentState.textSegments.length
					) {
						// TODO change detected
						selectedNodeStateByUser[user.id] = currentState;
						changeEvent.documentChanges.push({
							id: activeNode.id,
							origin: figma.currentUser?.id === user.id ? "LOCAL" : "REMOTE",
							type: "PROPERTY_CHANGE",
							properties: ["listOptions"],

							node: activeNode,
						});
					} else {
						checkStateLoop: for (let i = 0; i < currentState.textSegments.length; i++) {
							if (
								selectedNodeStateByUser[user.id].textSegments[i].indentation !==
									currentState.textSegments[i].indentation ||
								selectedNodeStateByUser[user.id].textSegments[i].listOptions.type !==
									currentState.textSegments[i].listOptions.type
							) {
								// TODO indentation change detected
								selectedNodeStateByUser[user.id] = currentState;
								changeEvent.documentChanges.push({
									id: activeNode.id,
									origin: figma.currentUser?.id === user.id ? "LOCAL" : "REMOTE",
									type: "PROPERTY_CHANGE",
									properties: ["listOptions"],

									node: activeNode,
								});

								break checkStateLoop;
							}
						}
					}
				} else {
					// node has changed no need to keep the old ones state in memory
					delete selectedNodeStateByUser[user.id];
				}
			}
			// }

			if (changeEvent.documentChanges.length > 0) {
				// console.log('emulating event');
				that.forwardDocumentChanges(changeEvent);
			}
		}, 100);
	}

	async forwardDocumentChanges(event: any) {
		const deletedIds = new Set<string>();
		const changedLabels = [] as LocalizedLabel[];
		const createdLabels = [] as LocalizedLabel[];
		const keysChanged = new Set<string>();
		for (const change of event.documentChanges) {
			switch (change.type) {
				case "CREATE": {
					if (change.node.removed) {
						// we skip changes of removed nodes
						break;
					}
					const createdNode = change.node as BaseNode;
					if (createdNode.type === "PAGE") await createdNode.loadAsync();
					if (createdNode.type === "TEXT") {
						const localizedLabel = this.toLocalizedLabelOrUndefined(createdNode as TextNode);
						if (localizedLabel) {
							this.virtualTree.addNode(createdNode, createdNode.id);
							if (localizedLabel.messageId) {
								const previousKey = this.refreshLabelMessageLinkCache(
									localizedLabel.nodeId,
									localizedLabel.messageId,
								);
								if (previousKey !== localizedLabel.messageId) {
									if (previousKey) {
										keysChanged.add(previousKey);
									}
									keysChanged.add(localizedLabel.messageId);
								}
							} else {
								const previousKey = this.refreshLabelMessageLinkCache(
									localizedLabel.nodeId,
									undefined,
								);
								if (previousKey) {
									keysChanged.add(previousKey);
								}
							}
							createdLabels.push(localizedLabel);
						}
					} else if ((createdNode as FrameNode).children) {
						// console.log(`Node created - with children ${change.id}`);
						const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
						figma.skipInvisibleInstanceChildren = true;
						const createdTextNodes = (createdNode as FrameNode).findAllWithCriteria({
							types: ["TEXT"],
						});
						for (const createdTextNode of createdTextNodes) {
							const localizedLabel = this.toLocalizedLabelOrUndefined(createdTextNode);
							if (localizedLabel) {
								this.virtualTree.addNode(createdTextNode, createdTextNode.id);
								if (localizedLabel.messageId) {
									const previousKey = this.refreshLabelMessageLinkCache(
										localizedLabel.nodeId,
										localizedLabel.messageId,
									);
									if (previousKey !== localizedLabel.messageId) {
										if (previousKey) {
											keysChanged.add(previousKey);
										}
										keysChanged.add(localizedLabel.messageId);
									}
								} else {
									const previousKey = this.refreshLabelMessageLinkCache(
										localizedLabel.nodeId,
										undefined,
									);
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
				case "DELETE": {
					// in case of a deletion we propagate the deleted node id - we don't have more information
					// about this node from figma :-/ The ui layer will know what this change affects
					const deletedLeafs = this.virtualTree
						.removeBranch(change.id)
						.filter((node) => node.cacheRelevant);
					deletedLeafs.forEach((node) => {
						const previousKey = this.refreshLabelMessageLinkCache(node.id, undefined);
						if (previousKey) keysChanged.add(previousKey);
						deletedIds.add(node.id);
					});
					// console.log(`Node deleted ${change.id} leafs: ${JSON.stringify(deletedIds)}`);
					break;
				}
				case "PROPERTY_CHANGE": {
					if (change.node.removed) {
						// we skip changes of removed nodes
						break;
					}
					const changedNode = change.node as BaseNode;

					if (changedNode?.type === "DOCUMENT") {
						break;
					}

					if (changedNode?.type === "PAGE") {
						break;
					}

					if (changedNode?.type === "TEXT") {
						// console.log(`Node changed - text ${changedNode.id}`);

						if (!this.virtualTree.hasNode(changedNode.id)) {
							// console.log(`Node changed - text ${changedNode.id} added to vt`);
							this.virtualTree.addNode(changedNode, changedNode.id);
						} else if (change.properties.includes("parent")) {
							// console.log(`Node changed - text ${changedNode.id} moved...`);
							this.virtualTree.moveNode(changedNode!.id, changedNode!.parent!);
						}

						const localizedLabel = this.toLocalizedLabelOrUndefined(changedNode as TextNode);
						if (localizedLabel) {
							if (localizedLabel.messageId) {
								const previousKey = this.refreshLabelMessageLinkCache(
									localizedLabel.nodeId,
									localizedLabel.messageId,
								);
								if (previousKey !== localizedLabel.messageId!) {
									if (previousKey) {
										keysChanged.add(previousKey);
									}
									keysChanged.add(localizedLabel.messageId!);
								}
							} else {
								const previousKey = this.refreshLabelMessageLinkCache(
									localizedLabel.nodeId,
									undefined,
								);
								if (previousKey) {
									keysChanged.add(previousKey);
								}
							}
							changedLabels.push(localizedLabel);
						} else {
							deletedIds.add(changedNode.id);
							this.refreshLabelMessageLinkCache(changedNode.id, undefined);
						}
					} else if ((changedNode as FrameNode).children) {
						let changedVirtualNodes = [] as VirtualTreeNode[];
						if (change.properties.includes("parent")) {
							changedVirtualNodes = this.virtualTree.moveNode(
								changedNode!.id,
								changedNode!.parent!,
							);
							// console.log(`Node changed - parent ${change.id} moved in vt affacted: ${JSON.stringify(changedVirtualNodes.length)}`);
						} else if (
							change.properties.includes("name") ||
							change.properties.includes("pluginData") ||
							change.properties.includes("visible")
						) {
							// if the name changed we have to update all childs since naming changes the key abrivation
							changedVirtualNodes = this.virtualTree.getAllNodesInBranchByRootId(changedNode!.id);
							// console.log(`Node changed - ${change.id} name in vt affacted: ${JSON.stringify(changedVirtualNodes.length)}`);
						}

						const resolvedChangedNodes = new Map(
							await Promise.all(
								changedVirtualNodes
									.filter((node) => node.cacheRelevant)
									.map(async (node) => [node.id, await this.getNode(node.id)] as const),
							),
						);
						for (const changedVNode of changedVirtualNodes) {
							if (changedVNode.cacheRelevant) {
								const movedFigmaNode = resolvedChangedNodes.get(changedVNode.id);
								if (movedFigmaNode && movedFigmaNode.type === "TEXT") {
									const localizedLabel = this.toLocalizedLabelOrUndefined(
										movedFigmaNode as TextNode,
									);
									if (localizedLabel) {
										if (localizedLabel.messageId) {
											const previousKey = this.refreshLabelMessageLinkCache(
												localizedLabel.nodeId,
												localizedLabel.messageId,
											);
											if (previousKey !== localizedLabel.messageId) {
												if (previousKey) {
													keysChanged.add(previousKey);
												}
												keysChanged.add(localizedLabel.messageId);
											}
										} else {
											const previousKey = this.refreshLabelMessageLinkCache(
												localizedLabel.nodeId,
												undefined,
											);
											if (previousKey) {
												keysChanged.add(previousKey);
											}
										}
										changedLabels.push(localizedLabel);
										// lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
									} else {
										deletedIds.add(movedFigmaNode.id);
										this.refreshLabelMessageLinkCache(movedFigmaNode.id, undefined);
									}
								}
							}
						}
					}

					break;
				}
				case "STYLE_CREATE":
				case "STYLE_DELETE":
				case "STYLE_PROPERTY_CHANGE":
					break;
			}
		}

		const message = {
			target: "LocalizedLabelManager",
			type: "cacheUpdate",
			deletedNodeIds: [...deletedIds],
			changedLabels: changedLabels.filter(
				(node) => !createdLabels.some((createdNode) => createdNode.nodeId === node.nodeId),
			),
			createdLabels,
			changedKeys: [...keysChanged],
		} as ChangeEvent;

		// console.log('keys changed');
		// console.log(keysChanged);
		figma.ui.postMessage(message);
	}

	async prepare() {
		await FontHelper.initialize();
	}

	async startFillupCache() {
		// we start the async process here - this will load frame by frame and intercept each load with a tick
		void this.ensureLinksIndexed().catch((e) => console.error(e));
	}

	private indexPromise?: Promise<void>;

	private ensureLinksIndexed() {
		return (this.indexPromise ??= this.fillUpCache().catch((error) => {
			this.indexPromise = undefined;
			throw error;
		}));
	}

	private nodeCount = 0;

	private textNodeCount = 0;

	private linkedTextNodeCount = 0;

	private numberOfAnonymousTextNodes = 0;

	private parrotTextNodesCount = 0;

	private frameCount = 0;

	async fillUpCache() {
		const start = Date.now();
		this.nodeCount =
			this.textNodeCount =
			this.linkedTextNodeCount =
			this.numberOfAnonymousTextNodes =
			this.parrotTextNodesCount =
			this.frameCount =
				0;
		const keysLoaded = new Set<string>();
		let totalNodesProcessed = 0;

		try {
			// Start by processing the current page first
			const { currentPage } = figma;
			this.virtualTree.addNode(figma.root, figma.root.id);
			this.virtualTree.addNode(currentPage, currentPage.id, figma.root);
			const { nodesProcessed: nodesProcessedInCurrentPage, maxDepth: maxDepthInCurrentPage } =
				await this.processNodeRecursively(currentPage, figma.root, keysLoaded, 0);
			totalNodesProcessed += nodesProcessedInCurrentPage;
			console.log(
				`fillUpCache - Current page processed, processed ${nodesProcessedInCurrentPage} nodes, max depth ${maxDepthInCurrentPage}, took ${Date.now() - start}ms`,
			);

			// Now process the other pages
			const otherPages = figma.root.children.filter((page) => page.id !== currentPage.id);
			for (const page of otherPages) {
				if (page.removed) continue;
				await page.loadAsync();
				if (page.removed) continue;
				this.observePage(page);
				this.virtualTree.addNode(page, page.id);
				const startPage = Date.now();
				const { nodesProcessed: nodesProcessedInPage, maxDepth: maxDepthInPage } =
					await this.processNodeRecursively(page, figma.root, keysLoaded, 0);
				totalNodesProcessed += nodesProcessedInPage;
				figma.ui.postMessage({
					target: "LocalizedLabelManager",
					type: "cacheUpdate",
					deletedNodeIds: [],
					changedLabels: [],
					createdLabels: [],
					changedKeys: [...keysLoaded],
				});
				const endPage = Date.now();
				console.log(
					`fillUpCache - Page ${page.name} processed, processed ${nodesProcessedInPage} nodes, max depth ${maxDepthInPage}, took ${endPage - startPage}ms`,
				);
			}
			console.log(
				`fillUpCache - All pages processed, total nodes processed: ${totalNodesProcessed}, total time: ${Date.now() - start}ms`,
			);

			await this.changesQueue;
			keysLoaded.clear();
			this.linkedTextNodeCount = 0;
			for (const [messageId, labels] of this.messageStore!.messageIdToLabels) {
				if (labels.size) keysLoaded.add(messageId);
				this.linkedTextNodeCount += labels.size;
			}
			figma.root.setPluginData("numberOfLinkedMessages", keysLoaded.size.toString());

			figma.root.setPluginData("numberOfTextNodes", this.textNodeCount.toString());
			figma.root.setPluginData("numberOfLinkedTextNodes", this.linkedTextNodeCount.toString());
			figma.root.setPluginData(
				"numberOfAnonymousTextNodes",
				this.numberOfAnonymousTextNodes.toString(),
			);
			figma.root.setPluginData("numberOfParrotTextNodes", this.parrotTextNodesCount.toString());

			figma.root.setPluginData("loadingTime", (Date.now() - start).toString());
			figma.root.setPluginData("numberOfFrames", this.frameCount.toString());

			this.postLinksLoadedMessage(keysLoaded);
			await documentChanges.activate();
		} catch (error) {
			console.error("fillUpCache - Error:", error);
			throw error;
		}
	}

	async processNodeRecursively(
		node: BaseNode,
		parentNode: BaseNode,
		keysLoaded: Set<string>,
		depth: number,
	): Promise<{ nodesProcessed: number; maxDepth: number }> {
		let nodesProcessed = 0;
		let maxDepth = depth;
		let sliceStart = Date.now();
		const stack = [{ node, parentNode, depth }];
		while (stack.length) {
			const item = stack.pop()!;
			const current = item.node;
			// Read live nodes after each yield: an edit/deletion during a scan must not revive stale data.
			if (current.removed) continue;
			maxDepth = Math.max(maxDepth, item.depth);
			if (current.type === "TEXT") {
				this.processTextNode(current, keysLoaded, item.parentNode);
				nodesProcessed++;
			} else {
				if (current.type === "FRAME") this.frameCount++;
				this.virtualTree.addNode(current, current.id, item.parentNode);
				if ("children" in current) {
					const children = current.children;
					for (let i = children.length - 1; i >= 0; i--) {
						stack.push({ node: children[i], parentNode: current, depth: item.depth + 1 });
					}
				}
			}
			if (Date.now() - sliceStart >= 8) {
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				sliceStart = Date.now();
			}
		}
		return { nodesProcessed, maxDepth };
	}

	processTextNode(textNode: CachedTextNode, keysLoaded: Set<string>, parentNode?: BaseNode) {
		const textNodeId = textNode.id;

		this.virtualTree.addNode(textNode, textNodeId, parentNode);

		const messageId = textNode.getPluginData(this.messageNameDataKey);
		if (messageId) {
			this.linkedTextNodeCount += 1;
			const previousMessage = this.refreshLabelMessageLinkCache(textNodeId, messageId);
			if (previousMessage) {
				keysLoaded.add(previousMessage);
				this.virtualTree.addNode(textNode, textNodeId);
			}
			keysLoaded.add(messageId);
		}

		this.textNodeCount += 1;
		if (textNode.getPluginData(this.messageUnmanagedKey) === "false") {
			this.parrotTextNodesCount += 1;
			if (textNode.getPluginData(this.anonymMessageDataKey)) {
				this.numberOfAnonymousTextNodes += 1;
			}
		}

		this.nodeCount += 1;
	}

	postLinksLoadedMessage(keysLoaded: Set<string>) {
		const message = {
			target: "LocalizedLabelManager",
			type: "linksLoaded",
			keys: [...keysLoaded],
		} as LinksLoadedEvent;

		figma.ui.postMessage(message);
	}

	async getSelection() {
		const selectionEnhanced = {} as NodeSelection;

		for (const selectedNode of figma.currentPage.selection) {
			const rootFrame = this.getRootFrame(selectedNode);

			if (selectedNode.type === "TEXT") {
				const textNode = this.toLocalizedLabelOrUndefined(selectedNode as TextNode);
				// the node within the selection is a label
				selectionEnhanced[selectedNode.id] = {
					rootFrameId: rootFrame?.id,
					directSelection: true,
					isLabel: selectedNode.type === "TEXT",
					selectedNodeId: selectedNode.id,
					messageId: textNode?.messageId,
				};
			} else {
				selectionEnhanced[selectedNode.id] = {
					directSelection: true,
					isLabel: false,
					rootFrameId: rootFrame?.id,
					selectedNodeId: selectedNode.id,
					messageId: undefined,
				};

				// Selection must work before the background cross-page index is ready.
				const textNodes =
					"findAllWithCriteria" in selectedNode
						? selectedNode.findAllWithCriteria({ types: ["TEXT"] })
						: [];
				for (const node of textNodes) {
					const label = this.toLocalizedLabelOrUndefined(node);
					selectionEnhanced[node.id] = {
						directSelection: false,
						isLabel: true,
						rootFrameId: rootFrame?.id,
						selectedNodeId: node.id,
						messageId: label?.messageId,
					};
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

	getRootFrame(node: any): FrameNode | undefined {
		if (!node.parent) {
			throw new Error("given node has no parent");
		}
		let parent = node;

		let rootFrame: FrameNode | undefined;

		while (parent) {
			const parentType = parent.type;
			if (
				(parentType === "COMPONENT" ||
					parentType === "COMPONENT_SET" ||
					parentType === "FRAME" ||
					parentType === "GROUP" ||
					parentType === "INSTANCE") &&
				parent.width < this.containerSizeThreashold
			) {
				rootFrame = parent;
			}
			parent = parent.parent;
		}

		return rootFrame;
	}

	async getById(textNodeId: string) {
		const textNode = (await this.getNode(textNodeId)) as TextNode;
		const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode);
		if (lokalizedLabel) {
			if (!this.virtualTree.hasNode(textNode.id)) {
				this.virtualTree.addNode(textNode, textNode.id);
			}
		}
		return lokalizedLabel;
	}

	/** The labels of these nodes as they are now - nodes that are gone or no labels are left out. */
	async getByIds(textNodeIds: string[]) {
		const nodes = await Promise.all(textNodeIds.map((id) => this.getNode(id)));
		return this.labelsFromNodes(nodes);
	}

	private async labelsFromNodes(nodes: (BaseNode | null)[]) {
		const labels: LocalizedLabel[] = [];
		let context = this.createLabelReadContext();
		let sliceStart = Date.now();
		for (const node of nodes) {
			if (Date.now() - sliceStart >= 32) {
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				context = this.createLabelReadContext();
				sliceStart = Date.now();
			}
			if (!node || node.removed || node.type !== "TEXT") continue;
			const label = this.toLocalizedLabelOrUndefined(node, context);
			if (!label) continue;
			this.virtualTree.addNode(node, node.id);
			labels.push(label);
		}
		return labels;
	}

	async getWithMessage(messageId: string) {
		return this.getWithMessages([messageId]);
	}

	/** All labels linked to one of the messages - a single traversal of the tree for any number of messages. */
	async getWithMessages(messageIds: string[]) {
		await this.ensureLinksIndexed();
		await this.changesQueue;
		const labels = [] as LocalizedLabel[];
		const foundNodes = [] as VirtualTreeNode[];
		const wantedMessageIds = new Set(messageIds);

		// Define the callback function for the traversal
		const findNodesWithMessage = (node: VirtualTreeNode) => {
			if (node.cacheRelevant && node.messageId && wantedMessageIds.has(node.messageId)) {
				foundNodes.push(node);
			}
		};

		// Start traversal from the root node
		this.virtualTree.traverseNode(figma.root.id, findNodesWithMessage);
		// console.log({ foundNodes });

		const nodes = await Promise.all(foundNodes.map((node) => this.getNode(node.id)));
		return this.labelsFromNodes(nodes);
	}

	/**
	 * The root frames of the current page that contain text - the frames the Layers tab lists when they
	 * are selected (outermost frame, group, component or instance below the size threshold).
	 */
	async getPageRootFrames() {
		const frames = [] as { id: string; name: string; language: Locale; textCount: number }[];
		const refLanguage = this.messageStore?.getConfigSync()?.refLanguage;
		const isContainer = (node: SceneNode) =>
			(node.type === "COMPONENT" ||
				node.type === "COMPONENT_SET" ||
				node.type === "FRAME" ||
				node.type === "GROUP" ||
				node.type === "INSTANCE") &&
			node.width < this.containerSizeThreashold;

		const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
		figma.skipInvisibleInstanceChildren = true;
		const collect = (nodes: readonly SceneNode[]) => {
			for (const node of nodes) {
				if (!node.visible) continue;
				if (isContainer(node)) {
					const textCount = (node as FrameNode).findAllWithCriteria({ types: ["TEXT"] }).length;
					if (textCount > 0) {
						frames.push({
							id: node.id,
							name: node.name,
							language: (node.getPluginData(this.languageDataKey) || refLanguage) as Locale,
							textCount,
						});
					}
				} else if ("children" in node) {
					// sections and frames above the size threshold are no root frames - their children can be
					collect(node.children);
				}
			}
		};
		collect(figma.currentPage.children);
		figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;
		return { pageName: figma.currentPage.name, frames };
	}

	/**
	 * Labels on the current page (text layers inside root frames). Building a label is expensive (plugin
	 * data, styles, lints), so `filter` skips layers cheaply first: linked or "not translated" layers and
	 * layers whose text (whitespace collapsed) is not one of `texts`.
	 */
	async getPageLabels(filter?: { unlinkedOnly?: boolean; texts?: string[] }) {
		const page = figma.currentPage;
		const labels = [] as LocalizedLabel[];
		const wantedTexts = filter?.texts ? new Set(filter.texts) : undefined;
		const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
		figma.skipInvisibleInstanceChildren = true;
		const textNodes = page.findAllWithCriteria({ types: ["TEXT"] });
		figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

		let context = this.createLabelReadContext();
		let sliceStart = Date.now();
		for (const textNode of textNodes) {
			if (Date.now() - sliceStart >= 32) {
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				if (page.id !== figma.currentPage.id) return [];
				context = this.createLabelReadContext();
				sliceStart = Date.now();
			}
			if (textNode.removed) continue;
			if (wantedTexts && !wantedTexts.has(normalizeText(textNode.characters))) continue;
			if (
				filter?.unlinkedOnly &&
				(textNode.getPluginData(this.messageNameDataKey) !== "" ||
					textNode.getPluginData(this.messageUnmanagedKey) === "true")
			) {
				continue;
			}
			const label = this.toLocalizedLabelOrUndefined(textNode, context);
			if (label) {
				if (!this.virtualTree.hasNode(textNode.id)) {
					this.virtualTree.addNode(textNode, textNode.id);
				}
				labels.push(label);
			}
		}
		return labels;
	}

	/** Labels on the current page whose text is exactly `characters` (e.g. to link them to the same message). */
	async findLabelsWithText(characters: string, excludeNodeIds: string[]) {
		const excluded = new Set(excludeNodeIds);
		const labels = [] as LocalizedLabel[];
		const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
		figma.skipInvisibleInstanceChildren = true;
		const textNodes = figma.currentPage.findAllWithCriteria({ types: ["TEXT"] });
		figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

		for (const textNode of textNodes) {
			if (excluded.has(textNode.id) || textNode.characters !== characters) continue;
			const label = this.toLocalizedLabelOrUndefined(textNode);
			if (label) {
				if (!this.virtualTree.hasNode(textNode.id)) {
					this.virtualTree.addNode(textNode, textNode.id);
				}
				labels.push(label);
			}
		}
		return labels;
	}

	async getFrameById(frameId: string): Promise<{
		id: string;
		name: string;
		localizedLabelsInFrame: LocalizedLabel[];
	}> {
		const frame = (await this.getNode(frameId)) as FrameNode;
		if (!frame || frame.removed || !("findAllWithCriteria" in frame))
			throw new Error(`Frame ${frameId} no longer exists`);
		return this.getFrame(frame);
	}

	private async getFrame(frame: FrameNode): Promise<{
		id: string;
		name: string;
		localizedLabelsInFrame: LocalizedLabel[];
	}> {
		const skipInvisibleInstanceChildrenBefore = figma.skipInvisibleInstanceChildren;
		figma.skipInvisibleInstanceChildren = true;

		const frameData = {
			id: frame.id,
			name: frame.name,
			localizedLabelsInFrame: [] as LocalizedLabel[],
		};

		const textNodes = frame.findAllWithCriteria({ types: ["TEXT"] });
		figma.skipInvisibleInstanceChildren = skipInvisibleInstanceChildrenBefore;

		let context = this.createLabelReadContext();
		let sliceStart = Date.now();
		for (const textNode of textNodes) {
			if (Date.now() - sliceStart >= 256) {
				await new Promise<void>((resolve) => setTimeout(resolve, 0));
				context = this.createLabelReadContext();
				sliceStart = Date.now();
			}
			const lokalizedLabel = this.toLocalizedLabelOrUndefined(textNode, context);
			if (lokalizedLabel) {
				if (!this.virtualTree.hasNode(textNode.id)) {
					this.virtualTree.addNode(textNode, textNode.id);
				}
				frameData.localizedLabelsInFrame.push(lokalizedLabel);
				// lokalizedLabel.parentIds.forEach((parentId) => frameData.refreshTriggerIds.add(parentId));
			}
		}

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
			return "";
		}
	}

	async updateFrameProperties(
		frameNodeId: string,
		properties: { language?: Locale; sampleValues?: boolean },
	) {
		const frame = (await this.getNode(frameNodeId)) as FrameNode;
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
				frame.setPluginData(this.sampleValuesDataKey, "");
			}
		}

		// console.log((new Date()).getTime() + 'execution finished - puting result into message');
	}

	labelUpdateQueue = {} as any;

	private updateMessageReference(textNode: TextNode, messageId: string | null) {
		for (const dataKey of textNode.getPluginDataKeys()) {
			if (dataKey.startsWith(`${this.messageNamePrefixKey}_`)) {
				if (messageId === null || dataKey !== `${this.messageNamePrefixKey}_${messageId}`) {
					textNode.setPluginData(dataKey, "");
				}
			}
		}
		if (textNode.getPluginData(this.messageNameDataKey) !== messageId) {
			textNode.setPluginData(this.messageNameDataKey, "");
		}
	}

	/**
	 * Applies many label updates in one call from the UI - one message round trip instead of one per
	 * label. Fonts of all labels are loaded up front once. A failing label does not stop the others.
	 */
	async updateLabelsProperties(
		updates: { nodeId: string; properties: SandboxUpdateLabelProperties }[],
	) {
		this.activeBulkUpdates++;
		try {
			const nodes = await Promise.all(
				updates.map(
					({ nodeId }) =>
						this.virtualTree.getVirtualNode(nodeId)?.sourceNode ?? this.getNode(nodeId),
				),
			);
			const textNodes = nodes.filter(
				(node, i): node is TextNode =>
					updates[i].properties.characters !== undefined && node?.type === "TEXT",
			);
			await this.loadFontsForTextNodes(textNodes).catch(() => {
				// a missing font is reported per label below
			});

			const results = [] as { label?: LocalizedLabel; error?: string }[];
			let sliceStart = Date.now();
			let context = this.createLabelReadContext();
			// Yielding metadata writes also renders the canvas. Keep normal link batches in one turn;
			// character changes retain the shorter budget, and very large batches remain interruptible.
			const sliceBudget = textNodes.length ? 256 : 1000;
			for (let i = 0; i < updates.length; i++) {
				if (Date.now() - sliceStart >= sliceBudget) {
					await new Promise<void>((resolve) => setTimeout(resolve, 0));
					sliceStart = Date.now();
					context = this.createLabelReadContext();
				}
				const { nodeId, properties } = updates[i];
				try {
					results.push({
						label: await this.updateLabelPropertiesWithNode(nodeId, properties, nodes[i], context),
					});
				} catch (e: any) {
					results.push({ error: e?.message ?? String(e) });
				}
			}
			return results;
		} finally {
			this.activeBulkUpdates--;
			// Return the batch result before processing canvas event snapshots.
			setTimeout(() => {
				if (this.activeBulkUpdates) return;
				const waiters = this.bulkUpdateWaiters.splice(0);
				for (const resolve of waiters) resolve();
			}, 0);
		}
	}

	async updateLabelProperties(nodeId: string, changedProperties: SandboxUpdateLabelProperties) {
		return this.updateLabelPropertiesWithNode(nodeId, changedProperties);
	}

	private async updateLabelPropertiesWithNode(
		nodeId: string,
		changedProperties: SandboxUpdateLabelProperties,
		resolvedNode?: BaseNode | null,
		context?: ReturnType<LocalizedLabelManager["createLabelReadContext"]>,
	) {
		// setup queue for atomic label update processing
		// - if no execution is ongoing hop right in and create a queue
		// - if an execution is ongoing await the previous call
		if (this.labelUpdateQueue[nodeId]) {
			// console.log('queing update');
			await new Promise((resolver: any) => {
				// we don't resolve this promise - this is done by the excution of the current function
				this.labelUpdateQueue[nodeId].push(resolver);
			});
			// console.log('dequied');
		} else {
			// console.log('queing not needed - prepare queue for next call');
			// start a new queue
			this.labelUpdateQueue[nodeId] = [];
		}

		let textNode: TextNode;
		try {
			const node = resolvedNode === undefined ? await this.getNode(nodeId) : resolvedNode;
			if (node?.type !== "TEXT" || node.removed)
				throw new Error(`Text layer ${nodeId} no longer exists`);
			textNode = node;
			if (changedProperties.labelName !== undefined) {
				// console.log('setting name');
				textNode.name = changedProperties.labelName;
				textNode.autoRename = false;
				textNode.setPluginData(this.autoRenameHashKey, "");
			}

			if (changedProperties.messageState?.type === "unset") {
				this.updateMessageReference(textNode, null);
				textNode.setPluginData(this.parameterValuesKey, "");
				textNode.setPluginData(this.messageUnmanagedKey, "");
				textNode.setPluginData(this.anonymMessageDataKey, "");
				textNode.setPluginData(this.messageNameDataKey, "");
			} else if (changedProperties.messageState?.type === "unmanaged") {
				this.updateMessageReference(textNode, null);
				textNode.setPluginData(this.parameterValuesKey, "");
				textNode.setPluginData(this.messageUnmanagedKey, JSON.stringify(true));
				textNode.setPluginData(this.messageNameDataKey, "");
				textNode.setPluginData(this.anonymMessageDataKey, "");
			} else if (changedProperties.messageState?.type === "unlinked") {
				this.updateMessageReference(textNode, null);
				textNode.setPluginData(
					this.parameterValuesKey,
					JSON.stringify(changedProperties.messageState.parameterValues),
				);
				textNode.setPluginData(
					this.anonymMessageDataKey,
					JSON.stringify(changedProperties.messageState.unlinkedMessage),
				);
				textNode.setPluginData(this.messageUnmanagedKey, JSON.stringify(false));
				textNode.setPluginData(this.messageNameDataKey, "");
			} else if (changedProperties.messageState?.type === "linked") {
				this.updateMessageReference(textNode, changedProperties.messageState.messageId);
				textNode.setPluginData(
					this.parameterValuesKey,
					JSON.stringify(changedProperties.messageState.parameterValues),
				);
				textNode.setPluginData(this.messageUnmanagedKey, JSON.stringify(false));
				textNode.setPluginData(this.messageNameDataKey, changedProperties.messageState.messageId);
				textNode.setPluginData(this.anonymMessageDataKey, "");
				textNode.setPluginData(
					`${this.messageNamePrefixKey}_${changedProperties.messageState.messageId}`,
					changedProperties.messageState.messageId,
				);
			}

			// if (changedProperties.messageVersion !== undefined) {
			//   textNode.setPluginData(this.messageVersionDataKey, `${changedProperties.messageVersion}`);
			// }

			// TODO #18 selectors set variables instead
			// if (changedProperties.gender !== undefined) {
			//   textNode.setPluginData(this.messageGenderDataKey, changedProperties.gender ? changedProperties.gender : '');
			// }
			// if (changedProperties.plural !== undefined) {
			//   textNode.setPluginData(this.messagePluralDataKey, changedProperties.plural ? changedProperties.plural : '');
			// }

			if (changedProperties.language !== undefined) {
				if (
					changedProperties.language !==
					(context ? context.refLanguage : this.messageStore?.getConfigSync().refLanguage)
				) {
					if (textNode.autoRename) {
						textNode.setPluginData(this.autoRenameHashKey, textNode.characters);
						textNode.autoRename = false;
					}
				} else if (textNode.getPluginData(this.autoRenameHashKey) === textNode.name) {
					textNode.autoRename = true;
				}
				textNode.setPluginData(
					this.languageDataKey,
					changedProperties.language ? changedProperties.language : "",
				);
			}

			if (changedProperties.fillinsToPlaceholder !== undefined) {
				textNode.setPluginData(
					this.fillinsToPlaceholderKey,
					JSON.stringify(changedProperties.fillinsToPlaceholder),
				);
			}

			// TODO think about the order - at the moment a lables characters might not get updated after fillins got set
			// NOTE: we also send the characters even if only styling has changed
			if (changedProperties.characters !== undefined) {
				const sourceTextLength = textNode.characters.length;
				const originalFillRanges = textNode
					.getStyledTextSegments(["fills", "fillStyleId"])
					.map(({ start, end, fills, fillStyleId }) => ({
						start,
						end,
						fills: [...fills],
						fillStyleId,
					})) as TextFillRange[];

				try {
					await this.loadFontsForTextNodes([textNode]);
				} catch (e: any) {
					// rethrow with better error message
					throw this.toFontLoadError(`Can't update label - not all Fonts could get loaded`, e);
				}

				// const textWithDecorators = this.toTextRangeObject(changedProperties.translation);

				// console.log(`setting characters from ${textNode.characters} to ${changedProperties.characters}`);

				// NOTE: when we are here and we have mixed font family we **should** have warned the user already - we go for the first one
				// TODO warn user about problematic labels
				const textNodeFontFamily =
					(textNode.fontName as FontName).family ??
					(textNode.getRangeFontName(0, 1) as FontName).family;
				const fontFamilyVariants = await this.getFontFamilyVariants(textNodeFontFamily);

				// check what inline style variants we find (bold, italic, bold&italic, regular)
				const fontStyleVariants = new Set<"bold" | "italic" | "bold italic" | "regular">();
				for (const rangeStyle of changedProperties.ops!) {
					if (rangeStyle.attributes?.italic && rangeStyle.attributes?.bold) {
						fontStyleVariants.add("bold italic");
					} else if (rangeStyle.attributes?.italic) {
						fontStyleVariants.add("italic");
					} else if (rangeStyle.attributes?.bold) {
						fontStyleVariants.add("bold");
					} else {
						fontStyleVariants.add("regular");
					}
				}

				// TODO check style segments when creating localized labels and warn for incompatibility
				// TODO also check for available fonts when creating the labels to disable bold/italic options for those labels that don't support it
				// TODO only load thos font variants that are needed and fail if one tries to apply them

				// find font names for style variants
				let regularFontName: FontName | undefined;
				let boldFontName: FontName | undefined;
				let italicFontName: FontName | undefined;
				let boldItalicFontName: FontName | undefined;

				if (fontStyleVariants.size > 0) {
					fontFamilyVariants.forEach((fontFamilyVariant) => {
						const styleLowerCase = fontFamilyVariant.style.toLowerCase();
						if (styleLowerCase === "regular") {
							regularFontName = fontFamilyVariant;
						}
						if (!regularFontName && styleLowerCase === "medium") {
							regularFontName = fontFamilyVariant;
						}

						if (styleLowerCase === "bold") {
							boldFontName = fontFamilyVariant;
						}

						if (styleLowerCase === "italic") {
							italicFontName = fontFamilyVariant;
						}

						// exact match - "semi bold italic" or "extra bold italic" must not win over "bold italic"
						if (styleLowerCase === "bold italic") {
							boldItalicFontName = fontFamilyVariant;
						}
						if (
							!boldItalicFontName &&
							styleLowerCase.includes("italic") &&
							styleLowerCase.includes("bold")
						) {
							boldItalicFontName = fontFamilyVariant;
						}
					});

					if (fontStyleVariants.has("regular")) {
						if (!regularFontName) {
							throw new Error(`No regular font variant for ${textNodeFontFamily}  found `);
						}
						try {
							await this.loadFont(regularFontName);
						} catch (e: any) {
							throw this.toFontLoadError(
								`Could not load regular font for ${textNodeFontFamily}`,
								e,
							);
						}
					}

					if (fontStyleVariants.has("bold")) {
						if (!boldFontName) {
							throw new Error(`No bold font variant for ${textNodeFontFamily}  found `);
						}
						try {
							await this.loadFont(boldFontName);
						} catch (e: any) {
							throw this.toFontLoadError(`Could not load bold font for ${textNodeFontFamily}`, e);
						}
					}

					if (fontStyleVariants.has("italic")) {
						if (!italicFontName) {
							throw new Error(`No italic font variant for ${textNodeFontFamily}  found `);
						}
						try {
							await this.loadFont(italicFontName);
						} catch (e: any) {
							throw this.toFontLoadError(`Could not load italic font for ${textNodeFontFamily}`, e);
						}
					}

					if (fontStyleVariants.has("bold italic")) {
						if (!boldItalicFontName) {
							throw new Error(`No italic font variant for ${textNodeFontFamily}  found `);
						}
						try {
							await this.loadFont(boldItalicFontName);
						} catch (e: any) {
							throw this.toFontLoadError(
								`Could not load italic+bold font for ${textNodeFontFamily}`,
								e,
							);
						}
					}
				}

				textNode.characters = changedProperties.characters;
				await restoreTextFillRanges(
					originalFillRanges,
					sourceTextLength,
					textNode.characters.length,
					(start, end, _fills, range) => {
						const current = textNode.getStyledTextSegments(["fills", "fillStyleId"], start, end);
						const same = rangeMatches(current, start, end, (segment) =>
							range.fillStyleId
								? segment.fillStyleId === range.fillStyleId
								: !segment.fillStyleId &&
									JSON.stringify(segment.fills) === JSON.stringify(range.fills),
						);
						if (!same) return setTextFillRange(textNode, start, end, range);
					},
				);

				for (const rangeStyle of changedProperties.ops!) {
					// debugger;

					const current = textNode.getStyledTextSegments(
						["listOptions", "hyperlink", "textDecoration"],
						rangeStyle.from,
						rangeStyle.to,
					);
					const list = rangeStyle.attributes?.list;
					const listType =
						list === "ordered" ? "ORDERED" : list === "bullet" ? "UNORDERED" : "NONE";
					if (
						!rangeMatches(
							current,
							rangeStyle.from,
							rangeStyle.to,
							(segment) => segment.listOptions.type === listType,
						)
					) {
						textNode.setRangeListOptions(rangeStyle.from, rangeStyle.to, { type: listType });
					}
					let linkUrl = rangeStyle.attributes?.link;
					if (linkUrl && linkUrl.startsWith("/")) linkUrl = this.helperDomain + linkUrl;
					const sameLink = rangeMatches(current, rangeStyle.from, rangeStyle.to, (segment) =>
						linkUrl
							? segment.hyperlink?.type === "URL" && segment.hyperlink.value === linkUrl
							: segment.hyperlink === null,
					);
					if (!sameLink)
						textNode.setRangeHyperlink(
							rangeStyle.from,
							rangeStyle.to,
							linkUrl ? { type: "URL", value: linkUrl } : null,
						);
					const decoration = rangeStyle.attributes?.textDecoration ?? "NONE";
					const decorations = sameLink
						? current
						: textNode.getStyledTextSegments(["textDecoration"], rangeStyle.from, rangeStyle.to);
					if (
						!rangeMatches(
							decorations,
							rangeStyle.from,
							rangeStyle.to,
							(segment) => segment.textDecoration === decoration,
						)
					) {
						textNode.setRangeTextDecoration(rangeStyle.from, rangeStyle.to, decoration);
					}
					// console.log(`Processing: ${textNode.characters.length} ${rangeStyle.to} ${textNode.characters} ${changedProperties.characters}`);

					// check if we should apply styles at all... is bold/italic/regular swiched once? otherwise keep the orginal label
					if (!rangeStyle.attributes?.bold && !rangeStyle.attributes?.italic) {
						if (rangeStyle.from === 0 && rangeStyle.to === textNode.characters.length) {
							if (
								textNode.fontName === boldItalicFontName ||
								textNode.fontName === boldFontName ||
								textNode.fontName === italicFontName
							) {
								textNode.setRangeFontName(rangeStyle.from, rangeStyle.to, regularFontName!);
							}
						} else {
							textNode.setRangeFontName(rangeStyle.from, rangeStyle.to, regularFontName!);
						}
					} else if (!rangeStyle.attributes?.bold && rangeStyle.attributes?.italic) {
						textNode.setRangeFontName(rangeStyle.from, rangeStyle.to, italicFontName!);
					} else if (rangeStyle.attributes?.bold && !rangeStyle.attributes?.italic) {
						textNode.setRangeFontName(rangeStyle.from, rangeStyle.to, boldFontName!);
					} else if (rangeStyle.attributes?.bold && rangeStyle.attributes?.italic) {
						textNode.setRangeFontName(rangeStyle.from, rangeStyle.to, boldItalicFontName!);
					}
				}

				textNode.setPluginData(
					this.variantPatternHTMLHashDataKey,
					changedProperties.variantPatternHTMLHash ? changedProperties.variantPatternHTMLHash : "",
				);
			}
		} finally {
			// allow this function to return sucessfully before we start the next update in the queue
			setTimeout(() => {
				const nextUpdateResolver = this.labelUpdateQueue[nodeId].shift();
				if (nextUpdateResolver) {
					nextUpdateResolver();
				} else {
					delete this.labelUpdateQueue[nodeId];
				}
			}, 1);
		}

		// Metadata-only writes stay in the synchronous turn that validated the node above.
		const label = this.toLocalizedLabelOrUndefined(
			textNode,
			context,
			changedProperties.characters === undefined,
		);
		if (!this.virtualTree.hasNode(nodeId)) this.virtualTree.addNode(textNode, nodeId);
		if (changedProperties.messageState) {
			const messageId =
				label?.messageId ?? (textNode.getPluginData(this.messageNameDataKey) || undefined);
			this.refreshLabelMessageLinkCache(nodeId, messageId);
		}
		return label!;
	}

	async commitUndo() {
		if (this.messageStore) return this.messageStore.commitUndo();
		return figma.commitUndo();
	}

	async fixLabelLints(textNodeId: string, lintsToFix: string[]) {
		const textNode = (await this.getNode(textNodeId)!) as TextNode;
		await this.loadFontsForTextNodes([textNode]);
		const linter = this.labelLinter;
		linter.fix(textNode, lintsToFix);
	}

	private async loadFontsForTextNodes(textNodes: TextNode[]) {
		const fontsToLoad = [] as FontName[];
		for (const textNode of textNodes) {
			this.getFonts(textNode, fontsToLoad);
		}
		await this.loadFonts(fontsToLoad);
	}

	/**
	 * figma.loadFontAsync rejects with a plain string - not an Error - when a font can't be loaded
	 * (e.g. it is missing on this machine). Setting `message` on a string throws "not an object",
	 * so wrap whatever was thrown into a proper Error that keeps the original reason.
	 */
	private toFontLoadError(context: string, reason: any) {
		return new Error(`${context}: ${reason?.message ?? String(reason)}`);
	}

	private async loadFonts(fontArray = [] as FontName[]) {
		await Promise.all(fontArray.map((font) => this.loadFont(font)));
	}

	/** Fonts stay loaded for the session. Every figma.loadFontAsync call costs a round trip (~10 ms), even for a loaded font. */
	private loadedFonts = new Set<string>();

	private async loadFont(font: FontName) {
		const key = JSON.stringify([font.family, font.style]);
		if (this.loadedFonts.has(key)) {
			return;
		}
		await figma.loadFontAsync(font);
		this.loadedFonts.add(key);
	}

	/** The styles of a font family. Listing all installed fonts is expensive - the list loaded on startup is reused. */
	private async getFontFamilyVariants(family: string) {
		const variantsOf = (fonts: Font[]) =>
			fonts.filter((font) => font.fontName.family === family).map((font) => font.fontName);
		let variants = FontHelper.availableFonts ? variantsOf(FontHelper.availableFonts) : [];
		if (variants.length === 0) {
			// not listed yet (e.g. installed since startup)
			FontHelper.availableFonts = await figma.listAvailableFontsAsync();
			variants = variantsOf(FontHelper.availableFonts);
		}
		return variants;
	}

	private getFonts(textNode: TextNode, fontArray = [] as FontName[]) {
		if (textNode.characters.length === 0) {
			if (
				!fontArray.find(
					(font) =>
						font.family === (textNode.fontName as FontName).family &&
						font.style === (textNode.fontName as FontName).style,
				)
			) {
				fontArray.push(textNode.fontName as FontName);
			}
		} else {
			const fontsToLoad = textNode.getRangeAllFontNames(0, textNode.characters.length);
			for (const fontToLoad of fontsToLoad) {
				if (
					!fontArray.find(
						(font) =>
							font.family === (fontToLoad as FontName).family &&
							font.style === (fontToLoad as FontName).style,
					)
				) {
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
		return "";
	}

	helperDomain = "https://relativeUrl";

	private createLabelReadContext() {
		return {
			refLanguage: this.messageStore?.getConfigSync()?.refLanguage,
			frameLanguages: new Map<string, Locale | undefined>(),
			parents: new Map<
				string,
				{
					page: PageNode | null;
					rootFrame: FrameNode | null;
					x: number;
					y: number;
				}
			>(),
		};
	}

	private toLocalizedLabelOrUndefined(
		node: TextNode,
		context?: ReturnType<LocalizedLabelManager["createLabelReadContext"]>,
		verifiedTextNode = false,
	): LocalizedLabel | undefined {
		if (!node || (!verifiedTextNode && (node.removed || node.type !== "TEXT"))) return;
		// we skip nodes that are not visible
		if (!node.visible) {
			return;
		}

		let derivedName = this.extractKeyName(node.name);
		// Derived keys are intentionally disabled until their naming behavior is restored.
		const derivable = false;

		let page: PageNode | null = null;
		let rootFrame: FrameNode | null = null;

		let x = 0;
		let y = 0;
		let parent = node.parent as any;
		const parentId = parent?.id;
		const cachedParent = parentId ? context?.parents.get(parentId) : undefined;
		if (cachedParent) {
			({ page, rootFrame, x, y } = cachedParent);
		} else {
			while (parent) {
				// we skip nodes where one of the parent nodes is invisible
				if (parent.visible === false) {
					return;
				}

				const parentType = parent.type;

				if (
					(parentType === "COMPONENT" ||
						parentType === "COMPONENT_SET" ||
						parentType === "FRAME" ||
						parentType === "GROUP" ||
						parentType === "INSTANCE") &&
					parent.width < this.containerSizeThreashold
				) {
					rootFrame = parent as FrameNode;
				} else if (parentType === "PAGE") {
					page = parent as PageNode;
				}

				if (
					parentType !== "GROUP" &&
					parentType !== "PAGE" &&
					parent.parent &&
					parent.parent.type !== "PAGE"
				) {
					x += parent.x;
					y += parent.y;
				}

				parent = parent.parent;
			}

			if (parentId) context?.parents.set(parentId, { page, rootFrame, x, y });
		}
		x += node.x;
		y += node.y;

		if (!page || !rootFrame) {
			return;
		}

		derivedName = this.extractKeyName(rootFrame.name) + this.separator + derivedName;

		// 1562ms -> 1071ms ~ 1/4
		const labelText = node.characters;

		const fillinsRaw = node.getPluginData(this.fillinsToPlaceholderKey);
		const fillins = fillinsRaw ? JSON.parse(fillinsRaw) : {};
		const parameterValuesRaw = node.getPluginData(this.parameterValuesKey);
		const parameterValues = parameterValuesRaw ? JSON.parse(parameterValuesRaw) : {};
		const tokenizedTextResult = this.extractDeltaOpsAndLabelStyles(node, fillins);

		if (labelText.length === 1 && !/[0-9a-zA-Z\n\s]/.test(labelText)) {
			return;
		}

		// get plugin 1192ms -> 938ms

		const unmanaged = node.getPluginData(this.messageUnmanagedKey) === "true";
		const messageId = node.getPluginData(this.messageNameDataKey) || undefined;
		let rootFrameLanguage: Locale | undefined;
		if (context?.frameLanguages.has(rootFrame.id))
			rootFrameLanguage = context.frameLanguages.get(rootFrame.id);
		else {
			rootFrameLanguage = (rootFrame.getPluginData(this.languageDataKey) ||
				(context ? context.refLanguage : this.messageStore?.getConfigSync()?.refLanguage)) as
				Locale | undefined;
			context?.frameLanguages.set(rootFrame.id, rootFrameLanguage);
		}
		const language = (node.getPluginData(this.languageDataKey) || rootFrameLanguage) as Locale;
		const variantPatternHTMLHash =
			node.getPluginData(this.variantPatternHTMLHashDataKey) || undefined;
		const anonymousRaw = node.getPluginData(this.anonymMessageDataKey);
		const unlinkedMessage = anonymousRaw ? JSON.parse(anonymousRaw) : undefined;

		return {
			pageId: page.id,
			pageName: page.name,
			rootFrameId: rootFrame.id,
			rootFrameName: rootFrame.name,
			rootFrameLanguage: rootFrameLanguage as Locale,
			language,
			variantPatternHTMLHash,
			nodeId: node.id,
			name: node.name,
			height: node.height,
			width: node.width,
			x,
			y,
			messageId,
			unmanaged,
			parameterValues,
			fillinsToPlaceholder: fillins,
			derivedKey: derivable ? derivedName : undefined,
			characters: labelText,
			ops: tokenizedTextResult.deltaOps,
			matchingLabelLints: tokenizedTextResult.matchingLabelLints,
			labelStyle: tokenizedTextResult.labelStyle,
			unlinkedMessage,
		};
	}

	// tries to find the fillins in the characters set to map them to placeholders
	private getPlaceholderDeltaOps(characters: string, fillins: FillinsToPlaceholder) {
		const placeholderDeltaOps = [] as DeltaOp[];

		const fillinValues = Object.keys(fillins);

		for (let i = fillinValues.length - 1; i >= 0; i--) {
			const fillinValue = fillinValues[i];
			const placeholder = fillins[fillinValue]!;

			let matchIndex = 0;
			while (matchIndex !== -1) {
				matchIndex = characters.indexOf(fillinValue, matchIndex);

				if (matchIndex !== -1) {
					const start = matchIndex;
					const end = matchIndex + `${fillinValue}`.length;

					// ensure no conflict with previous match
					if (placeholderDeltaOps.find((op) => op.start < end && start < op.end) === undefined) {
						placeholderDeltaOps.push({
							start,
							end,
							attributes: {
								placeholder: {
									name: placeholder.name,
									unnamed: !placeholder.named,
									argumentPosition: placeholder.specifiedArgumentPosition,
									formatFn: placeholder.formatFunctionName,
									options: placeholder.options,
									invisibleMarkers: fillinValue.split(MARKER_CHARACTER).length,
								},
							},
						});
					}
					matchIndex += 1;
				}
			}
		}
		return placeholderDeltaOps.sort((op1, op2) => op1.start - op2.start);
	}

	private textSegmentFields = [
		"fontSize",
		"fontName",
		"fontWeight",
		"textDecoration",
		"textCase",
		"lineHeight",
		"letterSpacing",
		"fills",
		"textStyleId",
		"fillStyleId",
		"listOptions",
		"indentation",
		"hyperlink",
	];

	private supportedInlineFields = [
		"textDecoration",
		"hyperlink",
		"fontName", // 'listOptions', 'indentation',
	];

	private getTextStyleDeltaOps(node: TextNode) {
		// if (matchingRules.length > 0) {
		//   console.log(`MATCHING RULES: ${matchingRules.join(', ')}`);
		//   console.log('auto fixing...');

		//   this.loadFontsForTextNodes([node]).then(() => {
		//     linter.fix(node, matchingRules);
		//   })
		// } else {
		//   console.log('MATCHIGN RULES: NONE');
		// }

		const textStyleDeltaOps = [] as DeltaOp[];
		const textSegments = node.getStyledTextSegments([
			"indentation",
			"listOptions",
			"fontName",
			"textDecoration",
			"hyperlink",
		]);

		textSegments.forEach((textSegment) => {
			// if the node has one stile (non mixed) its not inline styling - ignore it
			const italic =
				node.fontName !== figma.mixed
					? undefined
					: textSegment.fontName.style.toLowerCase().includes("italic");
			const weightName = textSegment.fontName.style.replace("italic", "").replace(" ", "");
			const bold =
				node.fontName !== figma.mixed ? undefined : weightName.toLowerCase().includes("bold");
			const textDecoration =
				node.textDecoration !== figma.mixed || textSegment.textDecoration === "NONE"
					? undefined
					: textSegment.textDecoration;

			let linkUrl =
				textSegment.hyperlink?.type === "URL" ? textSegment.hyperlink?.value : undefined;
			if (linkUrl && textSegment.hyperlink?.value.startsWith(this.helperDomain)) {
				linkUrl = textSegment.hyperlink.value.substring(this.helperDomain.length);
			}

			const attributes = {
				textDecoration,
				bold: bold ? true : undefined,
				italic: italic ? true : undefined,
				link: linkUrl,
				indentation: textSegment.indentation,
			} as any;

			// let listType = undefined as undefined | 'bullet' | 'ordered';
			if (textSegment.listOptions.type === "ORDERED") {
				attributes.list = "ordered";
			}

			if (textSegment.listOptions.type === "UNORDERED") {
				attributes.list = "bullet";
			}

			textStyleDeltaOps.push({
				start: textSegment.start,
				end: textSegment.end,
				attributes,
			});
		});

		return textStyleDeltaOps;
	}

	private getDeltaOps(node: TextNode, fillins: FillinsToPlaceholder) {
		const deltaOps = [] as DeltaOp[];
		const textStyleDeltaOps = this.getTextStyleDeltaOps(node);
		const placehodlderDeltaOps = this.getPlaceholderDeltaOps(node.characters, fillins);

		// merge textsegments and placeholder segments
		for (const textStyleDeltaOp of textStyleDeltaOps) {
			// console.log('processing:');
			// console.log(textStyleDeltaOp);

			for (let i = 0; i < placehodlderDeltaOps.length; i++) {
				const placehodlderDeltaOp = placehodlderDeltaOps[i];
				if (!placehodlderDeltaOps[i].processed) {
					if (
						textStyleDeltaOp.start === placehodlderDeltaOp.start &&
						textStyleDeltaOp.end === placehodlderDeltaOp.end
					) {
						// style delta and placeholder match
						// - add placeholder to textStyleOp and push the whole textStyleOp
						textStyleDeltaOp.attributes.placeholder = placehodlderDeltaOp.attributes.placeholder;
						deltaOps.push(textStyleDeltaOp);
						placehodlderDeltaOp.processed = true;
						textStyleDeltaOp.processed = true;
					} else if (
						textStyleDeltaOp.start === placehodlderDeltaOp.start &&
						textStyleDeltaOp.end >
							placehodlderDeltaOp.end -
								placehodlderDeltaOp.attributes.placeholder!.invisibleMarkers &&
						textStyleDeltaOp.end < placehodlderDeltaOp.end
					) {
						// style delta only formats the placeholder - but its end sits within the invisible markers
						// - no split needed but set end to the end of the text marker
						textStyleDeltaOp.attributes.placeholder = placehodlderDeltaOp.attributes.placeholder;
						textStyleDeltaOp.end = placehodlderDeltaOp.end;
						textStyleDeltaOp.processed = true;
						placehodlderDeltaOp.processed = true;
						deltaOps.push(textStyleDeltaOp);
					} else if (
						textStyleDeltaOp.start >= placehodlderDeltaOp.start &&
						textStyleDeltaOp.end <= placehodlderDeltaOp.end
					) {
						// Segment starts and ends within the placeholder but don't cover it completly (previous cases)
						// - we ignore this style
						textStyleDeltaOp.processed = true;
					} else if (
						textStyleDeltaOp.start < placehodlderDeltaOp.start &&
						textStyleDeltaOp.end >=
							placehodlderDeltaOp.end - placehodlderDeltaOp.attributes.placeholder!.invisibleMarkers
					) {
						// start is before the placeholder and it covers it completly split it and move start
						// - push delta before the placeholder
						deltaOps.push({
							start: textStyleDeltaOp.start,
							end: placehodlderDeltaOp.start,
							attributes: {
								...textStyleDeltaOp.attributes,
							},
						});
						// push delta covering the placeholder
						deltaOps.push({
							start: placehodlderDeltaOp.start,
							end: placehodlderDeltaOp.end,
							attributes: {
								...textStyleDeltaOp.attributes,
								...placehodlderDeltaOp.attributes,
							},
						});
						// placeholder is processed
						placehodlderDeltaOp.processed = true;
						// textStyleDeltaOp only if it ends with the placeholder
						if (textStyleDeltaOp.end <= placehodlderDeltaOp.end) {
							textStyleDeltaOp.processed = true;
						} else {
							textStyleDeltaOp.start = placehodlderDeltaOp.end;
						}

						if (!(textStyleDeltaOp.start < textStyleDeltaOp.end)) {
							throw new Error("textStyleDeltaOp.start < textStyleDeltaOp.end");
						}
					} else if (
						textStyleDeltaOp.start < placehodlderDeltaOp.start &&
						textStyleDeltaOp.end >= placehodlderDeltaOp.start &&
						textStyleDeltaOp.end <
							placehodlderDeltaOp.end - placehodlderDeltaOp.attributes.placeholder!.invisibleMarkers
					) {
						// start falls before a placeholder but it ends within it -> move end to the beginng
						// - we cant process it yet since its bounds may be changed by later placeholder
						textStyleDeltaOp.end = placehodlderDeltaOp.start;
						deltaOps.push({
							start: textStyleDeltaOp.start,
							end: textStyleDeltaOp.end,
							attributes: {
								...textStyleDeltaOp.attributes,
							},
						});
						// placeholder is processed
						textStyleDeltaOp.processed = true;
					} else if (
						textStyleDeltaOp.start >= placehodlderDeltaOp.start &&
						textStyleDeltaOp.start <
							placehodlderDeltaOp.end - placehodlderDeltaOp.attributes.placeholder!.invisibleMarkers
					) {
						// start falls into a placeholder - move it to the end of the placeholder
						// - we cant process it yet since its bounds may be changed by later placeholder
						textStyleDeltaOp.start = placehodlderDeltaOp.end;
					} else if (
						textStyleDeltaOp.end > placehodlderDeltaOp.start &&
						textStyleDeltaOp.end <
							placehodlderDeltaOp.end - placehodlderDeltaOp.attributes.placeholder!.invisibleMarkers
					) {
						// end falls into hello within helloXXX of the placeholder move it to the start
						textStyleDeltaOp.end = placehodlderDeltaOp.start;

						textStyleDeltaOp.processed = true;
						if (textStyleDeltaOp.end < textStyleDeltaOp.start) {
							// still a legal rang - add it finaly
							deltaOps.push(textStyleDeltaOp);
						}
					}
				}
			}

			if (!textStyleDeltaOp.processed) {
				if (!(textStyleDeltaOp.start < textStyleDeltaOp.end)) {
					throw new Error("textStyleDeltaOp.start < textStyleDeltaOp.end");
				}

				deltaOps.push(textStyleDeltaOp);
			}
		}

		const uncoveredPlaceholderOps = placehodlderDeltaOps.filter(
			(placehodlderDeltaOp) => !placehodlderDeltaOp.processed,
		);
		for (const uncoveredPlaceholderOp of uncoveredPlaceholderOps) {
			uncoveredPlaceholderOp.ignoreForLabelStyle = true;
			deltaOps.push(uncoveredPlaceholderOp);
		}

		return deltaOps.sort((op1, op2) => op1.start - op2.start);
	}

	private extractDeltaOpsAndLabelStyles(
		node: TextNode,
		fillins: FillinsToPlaceholder,
	): {
		matchingLabelLints: string[];
		deltaOps: any[];
		labelStyle: LabelStyle /* , allowedFormats: string[] */;
	} {
		const fontFamilies = new Set<string>();

		const labelStyle = {
			fontFamily: null,
			bold: null,
			italic: null,
			textDecoration: null,
		} as LabelStyle;

		const deltaOps = this.getDeltaOps(node, fillins);

		const linter = this.labelLinter;
		const matchingLabelLints = linter.lint(node);

		// get label styles
		for (const deltaOp of deltaOps) {
			if (deltaOp.ignoreForLabelStyle) {
				// ignoring placeholders not wrapped by styles

				continue;
			}
			if (deltaOp.attributes.fontFamily) {
				fontFamilies.add(deltaOp.attributes.fontFamily);
				// console.log('adding font fimily: ' + deltaOp.attributes.fontFamily);
			}

			labelStyle.bold =
				labelStyle.bold !== null && labelStyle.bold !== deltaOp.attributes.bold
					? "MIXED"
					: deltaOp.attributes.bold;
			labelStyle.italic =
				labelStyle.italic !== null && labelStyle.italic !== deltaOp.attributes.italic
					? "MIXED"
					: deltaOp.attributes.italic;
			labelStyle.textDecoration =
				labelStyle.textDecoration !== null &&
				labelStyle.textDecoration !== deltaOp.attributes.textDecoration
					? "MIXED"
					: deltaOp.attributes.textDecoration;
			labelStyle.fontFamily =
				labelStyle.fontFamily !== null && labelStyle.fontFamily !== deltaOp.attributes.fontFamily
					? "MIXED"
					: deltaOp.attributes.fontFamily;
		}

		// reset unmixed label stlyes
		for (const deltaOp of deltaOps) {
			deltaOp.attributes.bold = labelStyle.bold !== "MIXED" ? undefined : deltaOp.attributes.bold;
			deltaOp.attributes.italic =
				labelStyle.italic !== "MIXED" ? undefined : deltaOp.attributes.italic;
			deltaOp.attributes.textDecoration =
				labelStyle.textDecoration !== "MIXED" ? undefined : deltaOp.attributes.textDecoration;
			deltaOp.attributes.fontFamily =
				labelStyle.fontFamily !== "MIXED" ? undefined : deltaOp.attributes.fontFamily;
		}

		return {
			matchingLabelLints,
			// if we have no style changes within the label we don't handle styling
			deltaOps, // : deltaOps.length > 1 ? deltaOps : [],
			labelStyle,
		};
	}

	getPluginData(key: string) {
		return "";
	}
}
