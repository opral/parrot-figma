import LocalizedLabelManager from "../localizedlabels/LocalizedLabelManager";

type RealFigmaPerformanceTrial = {
	creationMs: number;
	readinessMs: number;
	coldIndexMs: number;
	warmHydrationMs: number;
	lookupMs: number;
};

export type RealFigmaPerformanceSample = {
	size: number;
	linkedLabels: number;
	lookupMatches: number;
	trials: RealFigmaPerformanceTrial[];
	median: RealFigmaPerformanceTrial;
};

const monotonicNow = () => (typeof performance === "undefined" ? Date.now() : performance.now());

export const REAL_FIGMA_PERFORMANCE_RESULT_KEY = "parrotPerformanceResult";

function median(trials: RealFigmaPerformanceTrial[], key: keyof RealFigmaPerformanceTrial) {
	const sorted = trials.map((trial) => trial[key]).sort((a, b) => a - b);
	const upper = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 0 ? (sorted[upper - 1]! + sorted[upper]!) / 2 : sorted[upper]!;
}

/** Development-only microbenchmarks over Figma's real Plugin API. */
export default class RealFigmaPerformanceHarness {
	public proxyClassName = "RealFigmaPerformanceHarness";
	private activeRun: Promise<RealFigmaPerformanceSample[]> | undefined;
	constructor(private readonly liveManager?: LocalizedLabelManager) {}

	async run(
		sizes: number[] = [100, 1_000, 5_000],
		repetitions = 3,
	): Promise<RealFigmaPerformanceSample[]> {
		if (this.activeRun) throw new Error("A real-Figma performance run is already active.");
		this.activeRun = this.runExclusive(sizes, repetitions);
		try {
			return await this.activeRun;
		} finally {
			this.activeRun = undefined;
		}
	}

	private async runExclusive(
		sizes: number[],
		repetitions: number,
	): Promise<RealFigmaPerformanceSample[]> {
		if (
			!Array.isArray(sizes) ||
			sizes.length === 0 ||
			sizes.length > 10 ||
			sizes.some((size) => !Number.isSafeInteger(size) || size < 1 || size > 10_000) ||
			!Number.isSafeInteger(repetitions) ||
			repetitions < 1 ||
			repetitions > 5 ||
			sizes.reduce((total, size) => total + size, 0) * repetitions > 20_000
		) {
			throw new Error(
				"Performance fixtures require 1–10 integer sizes, 1–5 repetitions, each size at most 10,000, and 20,000 total created nodes.",
			);
		}

		const results: RealFigmaPerformanceSample[] = [];
		await figma.loadFontAsync({ family: "Inter", style: "Regular" });

		for (const size of sizes) {
			const trials: RealFigmaPerformanceTrial[] = [];
			const linkedLabels = Math.min(size, 1_000) + (size > 1_000 ? 1 : 0);
			const expectedMatches = size === 1 ? 1 : 2;

			for (let repetition = 0; repetition < repetitions; repetition++) {
				const originalPage = figma.currentPage;
				const creationStarted = monotonicNow();
				const page = figma.createPage();

				try {
					page.name = `Parrot performance fixture (${size}, trial ${repetition + 1})`;
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
						} else if (index < 1_000) {
							text.setPluginData("mn", `performance.linked.${index}`);
						}
					}
					const creationMs = monotonicNow() - creationStarted;
					const fixtureNodeIds = [page.id, ...page.findAll().map((node) => node.id)];
					this.liveManager?.setIgnoredDocumentChangeNodes(fixtureNodeIds);

					const readinessManager = new LocalizedLabelManager();
					(readinessManager as any).messageStore = { messageIdToLabels: {} };
					if (page.getPluginDataKeys().some((key) => key.startsWith("prt_pli__")))
						throw new Error("Fixture was indexed before the cold measurement began.");
					const readinessStarted = monotonicNow();
					readinessManager.publishInitialReadiness(page);
					const readinessMs = monotonicNow() - readinessStarted;

					const nativeManager = new LocalizedLabelManager();
					(nativeManager as any).messageStore = {
						messageIdToLabels: {},
						getConfigSync: () => ({ refLanguage: "en" }),
					};
					const coldStarted = monotonicNow();
					const nodesProcessed = await nativeManager.indexPageTextNodes(page, new Set());
					const coldIndexMs = monotonicNow() - coldStarted;

					// A new manager over the completed durable data models a plugin reopen.
					const warmManager = new LocalizedLabelManager();
					(warmManager as any).messageStore = { messageIdToLabels: {} };
					const warmStarted = monotonicNow();
					const warmIndex = await warmManager.hydratePageLinkIndex(page, new Set());
					const warmHydrationMs = monotonicNow() - warmStarted;

					const lookupStarted = monotonicNow();
					const matches = await nativeManager.getWithMessage("performance.target");
					const lookupMs = monotonicNow() - lookupStarted;
					const actualIds = matches.map(({ nodeId }) => nodeId).sort();

					if (
						nodesProcessed !== size ||
						!warmIndex.valid ||
						warmIndex.hydrated !== linkedLabels ||
						matches.length !== expectedMatches ||
						JSON.stringify(actualIds) !== JSON.stringify([...matchingIds].sort())
					) {
						throw new Error(
							`Invalid performance sample: indexed ${nodesProcessed}/${size}, hydrated ${warmIndex.hydrated}/${linkedLabels}, and found ${matches.length}/${expectedMatches}.`,
						);
					}

					trials.push({ creationMs, readinessMs, coldIndexMs, warmHydrationMs, lookupMs });
				} finally {
					this.liveManager?.setIgnoredDocumentChangeNodes([]);
					try {
						await figma.setCurrentPageAsync(originalPage);
					} finally {
						page.remove();
					}
				}
			}

			results.push({
				size,
				linkedLabels,
				lookupMatches: expectedMatches,
				trials,
				median: {
					creationMs: median(trials, "creationMs"),
					readinessMs: median(trials, "readinessMs"),
					coldIndexMs: median(trials, "coldIndexMs"),
					warmHydrationMs: median(trials, "warmHydrationMs"),
					lookupMs: median(trials, "lookupMs"),
				},
			});
		}

		await figma.clientStorage.setAsync(REAL_FIGMA_PERFORMANCE_RESULT_KEY, results);
		return results;
	}
}

export function installRealFigmaPerformanceHarness(liveManager?: LocalizedLabelManager) {
	return new RealFigmaPerformanceHarness(liveManager);
}
