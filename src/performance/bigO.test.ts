import { afterEach, describe, expect, test } from "vitest";
import LocalizedLabelManager from "../lib/localizedlabels/LocalizedLabelManager";
import { FigmaBundleStore } from "../lib/message/store/FigmaBundleStore";
import { FakeFigmaDocument, FakeFrameNode, FakeTextNode } from "../testing/figma/FakeFigma";
import { createTranslationFixture } from "../testing/figma/translationFixtures";

type Sample = { size: number; operations: number; elapsedMs: number };

async function medianElapsed(run: () => Promise<void> | void) {
	await run();
	const values: number[] = [];
	for (let iteration = 0; iteration < 7; iteration++) {
		const started = performance.now();
		await run();
		values.push(performance.now() - started);
	}
	return values.sort((a, b) => a - b)[3]!;
}

function assertLinear(samples: Sample[], slack = 1.15) {
	for (let index = 1; index < samples.length; index++) {
		const previous = samples[index - 1]!;
		const current = samples[index]!;
		expect(current.operations / previous.operations).toBeLessThanOrEqual(
			(current.size / previous.size) * slack,
		);
	}
}

describe("Big-O performance gates", () => {
	afterEach(() => Reflect.deleteProperty(globalThis, "figma"));

	test("native startup primitive work is O(nodes)", async () => {
		const samples: Sample[] = [];
		for (const size of [100, 1_000, 5_000]) {
			const figma = new FakeFigmaDocument();
			Object.assign(globalThis, { figma });
			const page = figma.addPage("Page");
			const frame = page.appendChild(new FakeFrameNode("Frame")) as FakeFrameNode;
			for (let index = 0; index < size; index++) {
				const parent =
					index % 10 === 0
						? (frame.appendChild(new FakeFrameNode(`Group ${index}`)) as FakeFrameNode)
						: frame;
				const text = parent.appendChild(new FakeTextNode(`Cell ${index}`)) as FakeTextNode;
				if (index % 2 === 0) text.setPluginData("mn", `message.${index % 4}`);
			}
			const manager = new LocalizedLabelManager();
			(manager as any).messageStore = { messageIdToLabels: {} };
			figma.counters.pluginDataReads = 0;
			figma.counters.nodeLookups = 0;
			const result = await manager.indexPageTextNodes(page as any, new Set());
			const operations = figma.counters.pluginDataReads;
			const elapsedMs = await medianElapsed(async () => {
				await manager.indexPageTextNodes(page as any, new Set());
			});
			samples.push({ size, operations, elapsedMs });
			expect(figma.counters.exports).toBe(0);
			expect(figma.counters.nodeLookups).toBe(0);
			expect(result).toBe(size);
			expect(operations).toBe(size + Math.ceil(size / 2));
			expect(Object.values((manager as any).messageStore.messageIdToLabels)).toHaveLength(2);
			expect((manager as any).messageStore.messageIdToLabels["message.0"].size).toBe(
				Math.ceil(size / 4),
			);
		}
		assertLinear(samples);
		console.table(samples);
	});

	test("indexed lookup is O(matches), independent of unrelated nodes", async () => {
		const samples: Sample[] = [];
		for (const size of [100, 1_000, 5_000]) {
			const { figma, richText, sibling, page } = createTranslationFixture();
			Object.assign(globalThis, { figma });
			const unrelated = page.appendChild(new FakeFrameNode("Unrelated")) as FakeFrameNode;
			for (let index = 0; index < size; index++)
				unrelated.appendChild(new FakeTextNode(`Cell ${index}`));
			const manager = new LocalizedLabelManager();
			(manager as any).messageStore = {
				messageIdToLabels: { "checkout.greeting": new Set([richText.id, sibling.id]) },
				getConfigSync: () => ({ refLanguage: "en" }),
			};
			(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
				nodeId: node.id,
				messageId: node.getPluginData("mn"),
			});
			const before = { ...figma.counters };
			const labels = await manager.getWithMessage("checkout.greeting");
			const operations = figma.counters.nodeLookups - before.nodeLookups;
			expect(figma.counters.traversedNodes - before.traversedNodes).toBe(0);
			expect(figma.counters.pluginDataReads - before.pluginDataReads).toBe(4);
			const elapsedMs = await medianElapsed(async () => {
				await manager.getWithMessage("checkout.greeting");
			});
			samples.push({
				size,
				operations,
				elapsedMs,
			});
			expect(labels).toHaveLength(2);
		}
		expect(samples.map(({ operations }) => operations)).toEqual([2, 2, 2]);
		console.table(samples);
	});

	test("bundle loading performs one plugin-data read per bundle", async () => {
		const samples: Sample[] = [];
		for (const size of [100, 1_000, 5_000]) {
			let reads = 0;
			const data = new Map<string, string>();
			for (let index = 0; index < size; index++) {
				data.set(
					`prt_ib__message.${index}`,
					JSON.stringify({ id: `message.${index}`, declarations: [], messages: [] }),
				);
			}
			const root = {
				id: "0:0",
				getPluginData: (key: string) => {
					reads++;
					return data.get(key) ?? "";
				},
				getPluginDataKeys: () => [...data.keys()],
				setPluginData: (key: string, value: string) => void data.set(key, value),
			};
			const store = new FigmaBundleStore({ root });
			reads = 0;
			expect(store.load()).toHaveLength(size);
			const operations = reads;
			const elapsedMs = await medianElapsed(() => void store.load());
			samples.push({ size, operations, elapsedMs });
			expect(operations).toBe(size);
			store.dispose();
		}
		assertLinear(samples);
		console.table(samples);
	});

	test("warm startup is O(linked labels), independent of unrelated text", async () => {
		for (const linkedCount of [0, 1, 10, 100, 1_000]) {
			const figma = new FakeFigmaDocument();
			Object.assign(globalThis, { figma });
			const page = figma.addPage("Page");
			page.setPluginData("prt_pli_v", "1");
			for (let index = 0; index < 5_000; index++) {
				const text = page.appendChild(
					new FakeTextNode(`Cell ${index}`, `Cell ${index}`, `warm:${linkedCount}:${index}`),
				) as FakeTextNode;
				if (index < linkedCount) {
					text.setPluginData("mn", `message.${index}`);
					page.setPluginData(`prt_pli__${text.id}`, `message.${index}`);
				}
			}
			const manager = new LocalizedLabelManager();
			(manager as any).messageStore = { messageIdToLabels: {} };
			const before = { ...figma.counters };
			const warmIndex = await manager.hydratePageLinkIndex(page as any, new Set());
			expect(warmIndex).toEqual({ valid: true, hydrated: linkedCount });
			expect(figma.counters.traversedNodes - before.traversedNodes).toBe(0);
			expect(figma.counters.nodeLookups - before.nodeLookups).toBe(linkedCount);
			expect(figma.counters.pluginDataReads - before.pluginDataReads).toBe(1 + linkedCount * 3);
			expect(figma.counters.pluginDataKeysEnumerated - before.pluginDataKeysEnumerated).toBe(
				linkedCount + 1,
			);
		}
	});

	test("warm startup key enumeration is O(page metadata), independent of text", async () => {
		for (const unrelatedKeyCount of [0, 100, 1_000]) {
			const figma = new FakeFigmaDocument();
			Object.assign(globalThis, { figma });
			const page = figma.addPage("Page");
			page.setPluginData("prt_pli_v", "1");
			for (let index = 0; index < 10; index++) {
				const text = page.appendChild(new FakeTextNode(`Linked ${index}`)) as FakeTextNode;
				text.setPluginData("mn", `message.${index}`);
				page.setPluginData(`prt_pli__${text.id}`, `message.${index}`);
			}
			for (let index = 0; index < unrelatedKeyCount; index++)
				page.setPluginData(`unrelated.${index}`, "value");
			const manager = new LocalizedLabelManager();
			(manager as any).messageStore = { messageIdToLabels: {} };
			const before = { ...figma.counters };
			expect(await manager.hydratePageLinkIndex(page as any, new Set())).toEqual({
				valid: true,
				hydrated: 10,
			});
			expect(figma.counters.pluginDataKeysEnumerated - before.pluginDataKeysEnumerated).toBe(
				unrelatedKeyCount + 11,
			);
			expect(figma.counters.nodeLookups - before.nodeLookups).toBe(10);
		}
	});
});
