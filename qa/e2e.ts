import LocalizedLabelManager from "../src/lib/localizedlabels/LocalizedLabelManager";
import { InlangMessageStore } from "../src/lib/message/store/InlangMessageStoreFigmaRoot";
import { FigmaBundleStore, FIGMA_BUNDLE_PREFIX } from "../src/lib/message/store/FigmaBundleStore";
import { Locale } from "../src/lib/message/variants/Locale";
import FigmaUtil from "../src/shared/FigmaUtil";
import { getVariant, type Message } from "../src/lib/message/LegacyMessage";

figma.showUI(
	'<html><body><pre id="result">Running migration E2E…</pre><script>onmessage=e=>{if(e.data.pluginMessage.profile||e.data.pluginMessage.error)document.getElementById("result").textContent=JSON.stringify({...e.data.pluginMessage,checks:undefined},null,2)+String.fromCharCode(10)+(e.data.pluginMessage.checks||[]).join(String.fromCharCode(10))}</script></body></html>',
	{ width: 700, height: 700 },
);
let report: Record<string, unknown> = {};
const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 400));
function check(ok: unknown, message: string): asserts ok {
	if (!ok) throw Error(message);
}
async function run() {
	const prefix = `dynamic_e2e_${Date.now()}_`;
	const store = new InlangMessageStore(false);
	const manager = new LocalizedLabelManager(store);
	const originalPage = figma.currentPage;
	const pages: PageNode[] = [];
	const imported: string[] = [];
	const results: Record<string, unknown> = { profile: true, checks: [] };
	report = results;
	const checks = results.checks as string[];
	try {
		await manager.prepare();
		await figma.loadFontAsync({ family: "Inter", style: "Regular" });
		// Root undo must work before loadAllPagesAsync/documentchange is available.
		const earlyId = prefix + "early";
		const early: Message = {
			id: earlyId,
			selectors: [],
			variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Before" }] }],
		};
		await store.saveMessage(early);
		imported.push(earlyId);
		await store.commitUndo();
		let earlyChanges = 0;
		const earlyUnsubscribe = (store as any).bundleStore.subscribe(() => earlyChanges++);
		await store.saveMessage({
			...early,
			variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "After" }] }],
		});
		await store.commitUndo();
		figma.triggerUndo();
		await settle();
		check(
			(await store.getMessageAsync(earlyId))?.variants[0].pattern[0].value === "Before",
			"Root undo before index failed",
		);
		check(earlyChanges > 0, "Root undo before index was not notified");
		earlyUnsubscribe();
		checks.push("Root undo before document scan");

		for (let i = 0; i < 2; i++) {
			const page = figma.createPage();
			page.name = `Parrot dynamic migration QA ${i + 1}`;
			pages.push(page);
			await page.loadAsync();
		}
		await figma.setCurrentPageAsync(pages[0]);
		const frame = figma.createFrame();
		frame.name = "Migration 1000-layer frame";
		frame.resize(600, 600);
		const texts: TextNode[] = [];
		for (let i = 0; i < 1000; i++) {
			const text = figma.createText();
			text.fontName = { family: "Inter", style: "Regular" };
			text.characters = `Hello ${i}`;
			frame.appendChild(text);
			texts.push(text);
			if (i % 50 === 0) await tick();
		}
		// The Layers flow reads the frame before applying its bulk action. Warm both builds identically.
		const prepareFrameStart = Date.now();
		await manager.getFrameById(frame.id);
		results.prepareFrame1000Ms = Date.now() - prepareFrameStart;
		await figma.setCurrentPageAsync(pages[1]);
		const otherFrame = figma.createFrame();
		otherFrame.name = "Cross-page link";
		const otherText = figma.createText();
		otherText.fontName = { family: "Inter", style: "Regular" };
		otherText.characters = "Hello 0";
		otherFrame.appendChild(otherText);
		const importStart = Date.now();
		for (let i = 0; i < 5000; i++) {
			const id = prefix + i;
			const message: Message = {
				id,
				selectors: [],
				variants: [
					{ languageTag: "en", match: [], pattern: [{ type: "Text", value: `Hello ${i}` }] },
					{ languageTag: "de", match: [], pattern: [{ type: "Text", value: `Hallo ${i}` }] },
				],
			};
			await store.saveMessage(message);
			imported.push(id);
			if (i % 100 === 0) await tick();
		}
		results.import5000Ms = Date.now() - importStart;
		check(prefix + 4999 in (await store.getMessagesAsync(imported)), "Imported message missing");
		checks.push("5000-message persistence and reload");
		await figma.setCurrentPageAsync(pages[0]);
		const linkStart = Date.now();
		const links = await manager.updateLabelsProperties(
			texts.map((text, i) => ({
				nodeId: text.id,
				properties: {
					messageState: { type: "linked" as const, messageId: prefix + i, parameterValues: {} },
				},
			})),
		);
		check(
			links.every((result) => !result.error),
			"Bulk link failed",
		);
		await manager.updateLabelProperties(otherText.id, {
			messageState: { type: "linked", messageId: prefix + 0, parameterValues: {} },
		});
		results.link1000Ms = Date.now() - linkStart;
		await manager.startFillupCache();
		await new Promise<void>((resolve) => setTimeout(resolve, 2500));
		const linked = await manager.getWithMessages([prefix + 0]);
		check(linked.length === 2, "Cross-page index incomplete");
		checks.push("Cross-page link lookup");
		await figma.setCurrentPageAsync(pages[1]);
		await new FigmaUtil().selectNodes([texts[0].id]);
		check(
			figma.currentPage.id === pages[0].id && figma.currentPage.selection[0].id === texts[0].id,
			"Cross-page navigation failed",
		);
		checks.push("Async page navigation and selection");
		await store.commitUndo();
		const switchStart = Date.now();
		const switched = await manager.updateLabelsProperties(
			texts.map((text, i) => ({
				nodeId: text.id,
				properties: {
					language: Locale.DE,
					characters: `Hallo ${i}`,
					ops: [{ from: 0, to: `Hallo ${i}`.length, attributes: {} }],
				},
			})),
		);
		check(
			switched.every((result) => !result.error),
			`Language switch failed: ${switched.find((result) => result.error)?.error}`,
		);
		await store.commitUndo();
		results.switch1000Ms = Date.now() - switchStart;
		check(
			texts.every((text, i) => text.characters === `Hallo ${i}`),
			"Language text mismatch",
		);
		checks.push("1000-layer language switch");
		figma.triggerUndo();
		await settle();
		check(
			texts.every((text, i) => text.characters === `Hello ${i}`),
			"Bulk undo did not restore all layers",
		);
		checks.push("Bulk undo across 1000 layers");
		const editStart = Date.now();
		otherText.characters = "Edited on another page";
		await settle();
		check(
			(await manager.getById(otherText.id))?.characters === "Edited on another page",
			"Off-page canvas edit stale",
		);
		results.offPageEditMs = Date.now() - editStart;
		checks.push("Off-page canvas edits");
		const pluralId = prefix + "plural";
		const plural: Message = {
			id: pluralId,
			selectors: [{ type: "VariableReference", name: "count" }],
			variants: [
				{ languageTag: "en", match: ["one"], pattern: [{ type: "Text", value: "One item" }] },
				{
					languageTag: "en",
					match: ["*"],
					pattern: [
						{ type: "VariableReference", name: "count" },
						{ type: "Text", value: " items" },
					],
				},
			],
		};
		await store.saveMessage(plural);
		imported.push(pluralId);
		check(
			(await store.getMessageAsync(pluralId))?.variants.find(
				(variant) => variant.match[0] === "one",
			)?.pattern[0].type === "Text",
			"Plural roundtrip failed",
		);
		checks.push("Plural count data roundtrip");
		const isolated = (store as any).bundleStore as FigmaBundleStore;
		let rootChanges = 0;
		const unsub = isolated.subscribe(() => rootChanges++);
		await store.commitUndo();
		const changed = {
			...plural,
			variants: [
				{ languageTag: "en", match: ["*"], pattern: [{ type: "Text" as const, value: "Changed" }] },
			],
		};
		await store.saveMessage(changed);
		await settle();
		await store.commitUndo();
		figma.triggerUndo();
		await settle();
		check((await store.getMessageAsync(pluralId))!.variants.length === 2, "Root undo failed");
		check(rootChanges > 0, "Root change not notified");
		checks.push("Root message undo and change notification");
		unsub();
		// Export the canvas through Figma's async API. Import/export format roundtrips are covered by unit tests.
		const exportStart = Date.now();
		const exported = await otherFrame.exportAsync({ format: "JSON_REST_V1" });
		check(!!exported, "Canvas export failed");
		results.canvasExportMs = Date.now() - exportStart;
		checks.push("Async canvas export");
	} finally {
		for (const id of imported) await store.deleteMessage(id);
		await figma.setCurrentPageAsync(originalPage);
		for (const page of pages) if (!page.removed) page.remove();
	}

	// Clean up only records and pages created by this run, restoring the original page.

	check(
		imported.every((id) => figma.root.getPluginData(FIGMA_BUNDLE_PREFIX + id) === ""),
		"QA cleanup failed",
	);
	checks.push("Fixture cleanup");
	figma.ui.postMessage(results);
}
run().catch((error) =>
	figma.ui.postMessage({ ...report, error: String(error), stack: error.stack }),
);
