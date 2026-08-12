import LocalizedLabelManager from "../localizedlabels/LocalizedLabelManager";

export type RealFigmaPerformanceSample = {
	size: number;
	creationMs: number;
	scanMs: number;
	nativeScanMs: number;
	nodesProcessed: number;
	lookupMs: number;
	lookupMatches: number;
};

type RealFigmaPerformanceRequest = {
	type: "parrotPerformanceRun";
	requestId: string;
	sizes: number[];
};

const monotonicNow = () => (typeof performance === "undefined" ? Date.now() : performance.now());

export const REAL_FIGMA_PERFORMANCE_RESULT_KEY = "parrotPerformanceResult";

/**
 * Development harness for measuring Parrot against Figma's real Plugin API.
 * Every fixture page is removed in a finally block and this class is only
 * registered when the UI is served from localhost.
 */
export default class RealFigmaPerformanceHarness {
	public proxyClassName = "RealFigmaPerformanceHarness";

	async run(sizes: number[] = [100, 1_000, 5_000]): Promise<RealFigmaPerformanceSample[]> {
		if (
			!Array.isArray(sizes) ||
			sizes.length === 0 ||
			sizes.length > 10 ||
			sizes.some((size) => !Number.isSafeInteger(size) || size < 1 || size > 10_000)
			|| sizes.reduce((total, size) => total + size, 0) > 20_000
		) {
			throw new Error(
				"Performance fixtures require 1–10 integer sizes, each at most 10,000 and 20,000 total nodes.",
			);
		}
		const results: RealFigmaPerformanceSample[] = [];
		await figma.loadFontAsync({ family: "Inter", style: "Regular" });

		for (const size of sizes) {
			const creationStarted = monotonicNow();
			const originalPage = figma.currentPage;
			const page = figma.createPage();
			page.name = `Parrot performance fixture (${size})`;
			try {
				await figma.setCurrentPageAsync(page);
				const frame = figma.createFrame();
				page.appendChild(frame);
				frame.name = "Mixed wide and nested labels";
				const nestedParents: FrameNode[] = [];
				for (let index = 0; index < Math.ceil(size / 10); index++) {
					const nested = figma.createFrame();
					frame.appendChild(nested);
					nested.name = `Nested ${index}`;
					nestedParents.push(nested);
				}
				const matchingIds: string[] = [];
				for (let index = 0; index < size; index++) {
					const text = figma.createText();
					const parent = index % 10 === 0 ? nestedParents[Math.floor(index / 10)]! : frame;
					parent.appendChild(text);
					text.characters = `Cell ${index}`;
					if (index === 0 || index === size - 1) {
						text.setPluginData("mn", "performance.target");
						matchingIds.push(text.id);
					}
				}

				const creationMs = monotonicNow() - creationStarted;
				const nativeManager = new LocalizedLabelManager();
				(nativeManager as any).messageStore = {
					messageIdToLabels: {},
					getConfigSync: () => ({ refLanguage: "en" }),
				};
				// Let Figma deliver the fixture's documentchange batch before timing the isolated scan.
				await new Promise((resolve) => setTimeout(resolve, 0));
				const nativeScanStarted = monotonicNow();
				const nativeNodesProcessed = await nativeManager.indexPageTextNodes(page, new Set());
				const nativeScanMs = monotonicNow() - nativeScanStarted;
				const recursiveManager = new LocalizedLabelManager();
				(recursiveManager as any).messageStore = {
					messageIdToLabels: {},
					getConfigSync: () => ({ refLanguage: "en" }),
				};
				const scanStarted = monotonicNow();
				const scan = await recursiveManager.processNodeRecursively(page, figma.root, new Set(), 0);
				const scanMs = monotonicNow() - scanStarted;
				const lookupStarted = monotonicNow();
				const matches = await nativeManager.getWithMessage("performance.target");
				const lookupMs = monotonicNow() - lookupStarted;
				const expectedMatches = size === 1 ? 1 : 2;
				const actualIds = matches.map(({ nodeId }) => nodeId).sort();
				if (
					scan.nodesProcessed !== size ||
					nativeNodesProcessed !== size ||
					matches.length !== expectedMatches ||
					JSON.stringify(actualIds) !== JSON.stringify([...matchingIds].sort())
				) {
					throw new Error(
						`Invalid performance sample: scanned ${scan.nodesProcessed}/${size} nodes and found ${matches.length}/${expectedMatches} matches.`,
					);
				}
				results.push({
					size,
					creationMs,
					scanMs,
					nativeScanMs,
					nodesProcessed: scan.nodesProcessed,
					lookupMs,
					lookupMatches: matches.length,
				});
			} finally {
				await figma.setCurrentPageAsync(originalPage);
				page.remove();
			}
		}

		await figma.clientStorage.setAsync(REAL_FIGMA_PERFORMANCE_RESULT_KEY, results);
		return results;
	}
}

export function installRealFigmaPerformanceHarness() {
	const harness = new RealFigmaPerformanceHarness();
	let activeRun: Promise<RealFigmaPerformanceSample[]> | undefined;
	figma.ui.on("message", async (message) => {
		if (message?.type !== "parrotPerformanceRun") return;
		const request = message as RealFigmaPerformanceRequest;
		try {
			activeRun ??= harness.run(request.sizes).finally(() => {
				activeRun = undefined;
			});
			figma.ui.postMessage({
				type: "parrotPerformanceResult",
				requestId: request.requestId,
				samples: await activeRun,
			});
		} catch (error) {
			figma.ui.postMessage({
				type: "parrotPerformanceResult",
				requestId: request.requestId,
				error: error instanceof Error ? error.message : String(error),
			});
		}
	});
}
