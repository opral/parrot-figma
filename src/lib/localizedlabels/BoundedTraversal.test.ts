import { afterEach, describe, expect, test } from "vitest";
import LocalizedLabelManager from "./LocalizedLabelManager";
import { FakeFrameNode, FakeTextNode } from "../../testing/figma/FakeFigma";
import { createTranslationFixture } from "../../testing/figma/translationFixtures";

describe("bounded Figma traversal", () => {
	afterEach(() => Reflect.deleteProperty(globalThis, "figma"));

	test("walks native nodes without serializing any page or frame", async () => {
		const { figma, page } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		const unrelatedPage = figma.addPage("Unrelated", "20:0");
		const unrelatedFrame = unrelatedPage.appendChild(
			new FakeFrameNode("Large", "21:0"),
		) as FakeFrameNode;
		for (let index = 0; index < 500; index++) {
			unrelatedFrame.appendChild(new FakeTextNode(`Cell ${index}`, `Cell ${index}`, `22:${index}`));
		}
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		Object.assign(figma, { ui: { postMessage: () => undefined } });
		let lookupsAtReady = -1;
		await manager.fillUpCache(() => {
			lookupsAtReady = figma.counters.pluginDataReads;
		});
		await manager.waitForBackgroundIndex();
		expect(lookupsAtReady).toBeLessThan(20);
		expect(figma.counters.exports).toBe(0);
		expect(figma.counters.pluginDataReads).toBeGreaterThan(500);
	});

	test("looks up linked labels from the message index, not the virtual tree", async () => {
		const { figma, richText, sibling } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = {
			messageIdToLabels: { "checkout.greeting": new Set([richText.id, sibling.id]) },
			getConfigSync: () => ({ refLanguage: "en" }),
		};
		(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
			nodeId: node.id,
			messageId: node.getPluginData("mn"),
		});
		const labels = await manager.getWithMessage("checkout.greeting");
		expect(labels.map(({ nodeId }) => nodeId).sort()).toEqual([richText.id, sibling.id].sort());
		expect(figma.counters.nodeLookups).toBe(2);
		expect(figma.counters.traversedNodes).toBe(0);
	});

	test("prunes stale and relinked message-index entries", async () => {
		const { figma, richText } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		richText.setPluginData("mn", "checkout.other");
		const index = new Set([richText.id, "missing:0"]);
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = {
			messageIdToLabels: { "checkout.greeting": index },
			getConfigSync: () => ({ refLanguage: "en" }),
		};
		(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
			nodeId: node.id,
			messageId: node.getPluginData("mn"),
		});
		expect(await manager.getWithMessage("checkout.greeting")).toEqual([]);
		expect(index.size).toBe(0);
		expect((manager as any).messageStore.messageIdToLabels["checkout.other"]).toEqual(
			new Set([richText.id]),
		);
	});
});
