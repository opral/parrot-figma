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

	test("hydrates a complete durable page index without scanning unrelated text", async () => {
		const { figma, page, richText, sibling } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		page.setPluginData("prt_pli_v", "1");
		page.setPluginData(`prt_pli__${richText.id}`, "checkout.greeting");
		page.setPluginData(`prt_pli__${sibling.id}`, "checkout.greeting");
		for (let index = 0; index < 1_000; index++)
			page.appendChild(new FakeTextNode(`Unrelated ${index}`, `Unrelated ${index}`, `90:${index}`));
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		const before = { ...figma.counters };
		const keys = new Set<string>();
		expect(await manager.hydratePageLinkIndex(page as any, keys)).toEqual({
			valid: true,
			hydrated: 2,
		});
		expect(figma.counters.traversedNodes - before.traversedNodes).toBe(0);
		expect(figma.counters.nodeLookups - before.nodeLookups).toBe(2);
		expect(keys).toEqual(new Set(["checkout.greeting"]));
	});

	test("rejects incomplete indexes and prunes stale durable entries", async () => {
		const { figma, page, richText } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		page.setPluginData(`prt_pli__${richText.id}`, "checkout.greeting");
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		expect(await manager.hydratePageLinkIndex(page as any, new Set())).toEqual({
			valid: false,
			hydrated: 0,
		});
		page.setPluginData("prt_pli_v", "1");
		page.setPluginData("prt_pli__missing:0", "checkout.missing");
		expect(await manager.hydratePageLinkIndex(page as any, new Set())).toEqual({
			valid: true,
			hydrated: 1,
		});
		expect(page.getPluginData("prt_pli__missing:0")).toBe("");
	});

	test("publishes a warm hint, then reconciles links added while Parrot was closed", async () => {
		const { figma, page, richText, sibling } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		page.setPluginData("prt_pli_v", "1");
		page.setPluginData(`prt_pli__${richText.id}`, "checkout.greeting");
		sibling.setPluginData("mn", "checkout.added-while-closed");
		const posted: any[] = [];
		Object.assign(figma, { ui: { postMessage: (message: any) => posted.push(message) } });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };

		await manager.fillUpCache();
		expect(posted.at(0).keys).toEqual([]);
		await manager.waitForBackgroundIndex();
		expect(posted.at(-1).keys.sort()).toEqual(["checkout.added-while-closed", "checkout.greeting"]);
		expect(page.getPluginData(`prt_pli__${sibling.id}`)).toBe("checkout.added-while-closed");
	});

	test("publishes readiness in O(1) before reading a large warm index", async () => {
		const { figma, page } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		page.setPluginData("prt_pli_v", "1");
		for (let index = 0; index < 5_000; index++)
			page.appendChild(new FakeTextNode(`Unrelated ${index}`, `Unrelated ${index}`, `95:${index}`));
		for (let index = 0; index < 1_000; index++)
			page.setPluginData(`prt_pli__missing:${index}`, `message.${index}`);
		const posted: any[] = [];
		Object.assign(figma, { ui: { postMessage: (message: any) => posted.push(message) } });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		const before = { ...figma.counters };
		let readsAtReady = -1;
		let traversalsAtReady = -1;
		let lookupsAtReady = -1;
		await manager.fillUpCache(() => {
			readsAtReady = figma.counters.pluginDataReads - before.pluginDataReads;
			traversalsAtReady = figma.counters.traversedNodes - before.traversedNodes;
			lookupsAtReady = figma.counters.nodeLookups - before.nodeLookups;
		});
		expect(readsAtReady).toBe(0);
		expect(traversalsAtReady).toBe(0);
		expect(lookupsAtReady).toBe(0);
		expect(figma.counters.traversedNodes - before.traversedNodes).toBe(0);
		expect(posted.at(0).keys).toEqual([]);
		await manager.waitForBackgroundIndex();
	});

	test("maintains durable links for relink, unlink, and cross-page moves", async () => {
		const { figma, page, richText } = createTranslationFixture();
		const destination = figma.addPage("Destination", "30:0");
		Object.assign(globalThis, { figma });
		Object.assign(figma, { ui: { postMessage: () => undefined } });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
			nodeId: node.id,
			messageId: node.getPluginData("mn") || undefined,
		});
		await manager.indexPageTextNodes(page as any, new Set());
		for (let index = 0; index < 5_000; index++)
			page.appendChild(new FakeTextNode(`Unrelated ${index}`, `Unrelated ${index}`, `96:${index}`));

		const relinkBefore = { ...figma.counters };
		richText.setPluginData("mn", "checkout.relinked");
		manager.forwardDocumentChanges({
			documentChanges: [
				{
					origin: "LOCAL",
					type: "PROPERTY_CHANGE",
					id: richText.id,
					node: richText,
					properties: ["pluginData"],
				},
			],
		});
		expect(page.getPluginData(`prt_pli__${richText.id}`)).toBe("checkout.relinked");
		expect(figma.counters.traversedNodes - relinkBefore.traversedNodes).toBe(0);

		figma.moveNode(richText, destination);
		manager.forwardDocumentChanges({
			documentChanges: [
				{
					origin: "LOCAL",
					type: "PROPERTY_CHANGE",
					id: richText.id,
					node: richText,
					properties: ["parent"],
				},
			],
		});
		expect(page.getPluginData(`prt_pli__${richText.id}`)).toBe("");
		expect(destination.getPluginData(`prt_pli__${richText.id}`)).toBe("checkout.relinked");

		richText.setPluginData("mn", "");
		manager.forwardDocumentChanges({
			documentChanges: [
				{
					origin: "LOCAL",
					type: "PROPERTY_CHANGE",
					id: richText.id,
					node: richText,
					properties: ["pluginData"],
				},
			],
		});
		expect(destination.getPluginData(`prt_pli__${richText.id}`)).toBe("");
	});

	test("indexes only a moved container when it was not previously in memory", () => {
		const { figma, page, frameA, richText } = createTranslationFixture();
		const destination = figma.addPage("Destination", "31:0");
		for (let index = 0; index < 5_000; index++)
			page.appendChild(new FakeTextNode(`Unrelated ${index}`, `Unrelated ${index}`, `97:${index}`));
		Object.assign(globalThis, { figma });
		Object.assign(figma, { ui: { postMessage: () => undefined } });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
			nodeId: node.id,
			messageId: node.getPluginData("mn") || undefined,
		});
		figma.moveNode(frameA, destination);
		const before = { ...figma.counters };
		manager.forwardDocumentChanges({
			documentChanges: [
				{
					origin: "LOCAL",
					type: "PROPERTY_CHANGE",
					id: frameA.id,
					node: frameA,
					properties: ["parent"],
				},
			],
		});
		expect(figma.counters.traversedNodes - before.traversedNodes).toBe(1);
		expect(destination.getPluginData(`prt_pli__${richText.id}`)).toBe("checkout.greeting");
	});

	test("keeps the marker invalid after a partial reconciliation and repairs on reopen", async () => {
		const { figma, page, richText } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		page.setPluginData("prt_pli_v", "1");
		figma.failOnMutation = {
			nodeId: page.id,
			property: `pluginData:prt_pli__${richText.id}`,
		};
		const failedManager = new LocalizedLabelManager();
		(failedManager as any).messageStore = { messageIdToLabels: {} };
		await expect(failedManager.indexPageTextNodes(page as any, new Set())).rejects.toThrow(
			"Injected failure",
		);
		expect(page.getPluginData("prt_pli_v")).toBe("");

		const posted: any[] = [];
		Object.assign(figma, { ui: { postMessage: (message: any) => posted.push(message) } });
		const reopenedManager = new LocalizedLabelManager();
		(reopenedManager as any).messageStore = { messageIdToLabels: {} };
		await reopenedManager.fillUpCache();
		expect(posted.at(0).keys).toEqual([]);
		await reopenedManager.waitForBackgroundIndex();
		expect(page.getPluginData("prt_pli_v")).toBe("1");
		expect(page.getPluginData(`prt_pli__${richText.id}`)).toBe("checkout.greeting");
	});

	test("indexes and deletes every linked descendant of a created subtree", () => {
		const { figma, page } = createTranslationFixture();
		Object.assign(globalThis, { figma });
		Object.assign(figma, { ui: { postMessage: () => undefined } });
		const manager = new LocalizedLabelManager();
		(manager as any).messageStore = { messageIdToLabels: {} };
		(manager as any).toLocalizedLabelOrUndefined = (node: FakeTextNode) => ({
			nodeId: node.id,
			messageId: node.getPluginData("mn") || undefined,
		});
		const createdFrame = page.appendChild(new FakeFrameNode("Created", "40:0")) as FakeFrameNode;
		const first = createdFrame.appendChild(
			new FakeTextNode("First", "First", "41:0"),
		) as FakeTextNode;
		const nested = createdFrame.appendChild(new FakeFrameNode("Nested", "42:0")) as FakeFrameNode;
		const second = nested.appendChild(new FakeTextNode("Second", "Second", "43:0")) as FakeTextNode;
		first.setPluginData("mn", "created.first");
		second.setPluginData("mn", "created.second");

		manager.forwardDocumentChanges({
			documentChanges: [
				{ origin: "LOCAL", type: "CREATE", id: createdFrame.id, node: createdFrame },
			],
		});
		expect(page.getPluginData(`prt_pli__${first.id}`)).toBe("created.first");
		expect(page.getPluginData(`prt_pli__${second.id}`)).toBe("created.second");

		manager.forwardDocumentChanges({
			documentChanges: [{ origin: "LOCAL", type: "DELETE", id: createdFrame.id }],
		});
		expect(page.getPluginData(`prt_pli__${first.id}`)).toBe("");
		expect(page.getPluginData(`prt_pli__${second.id}`)).toBe("");
	});
});
