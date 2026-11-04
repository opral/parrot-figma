import LocalizedLabelManager from "../src/lib/localizedlabels/LocalizedLabelManager";
import { InlangMessageStore } from "../src/lib/message/store/InlangMessageStoreFigmaRoot";
figma.showUI(
	'<pre id="result">Profiling bulk link phases…</pre><script>onmessage=e=>{if(!Array.isArray(e.data.pluginMessage)&&!e.data.pluginMessage.error)return;document.getElementById("result").textContent=JSON.stringify(e.data.pluginMessage)}</script>',
	{ width: 700, height: 600 },
);
async function run() {
	const originalPage = figma.currentPage;
	const page = figma.createPage();
	page.name = "Parrot disposable bulk profile";
	const samples = [];
	try {
		await figma.setCurrentPageAsync(page);
		await figma.loadFontAsync({ family: "Inter", style: "Regular" });
		const store = new InlangMessageStore(false);
		const manager = new LocalizedLabelManager(store);
		await manager.prepare();
		for (let trial = 0; trial < 3; trial++) {
			const frame = figma.createFrame();
			frame.resize(600, 600);
			const texts: TextNode[] = [];
			for (let i = 0; i < 1000; i++) {
				const t = figma.createText();
				t.fontName = { family: "Inter", style: "Regular" };
				t.characters = "Hello " + i;
				frame.appendChild(t);
				texts.push(t);
			}
			const prepareStart = Date.now();
			await manager.getFrameById(frame.id);
			const prepareMs = Date.now() - prepareStart;
			const phases: Record<string, number> = {};
			const methods = [
				"toLocalizedLabelOrUndefined",
				"extractDeltaOpsAndLabelStyles",
				"updateMessageReference",
				"refreshLabelMessageLinkCache",
			];
			const originals: Record<string, any> = {};
			for (const key of methods) {
				const orig = (manager as any)[key];
				if (!orig) continue;
				originals[key] = orig;
				(manager as any)[key] = function (...args: any[]) {
					const start = Date.now();
					try {
						return orig.apply(this, args);
					} finally {
						phases[key] = (phases[key] || 0) + Date.now() - start;
						phases[key + "Calls"] = (phases[key + "Calls"] || 0) + 1;
					}
				};
			}
			const start = Date.now();
			const results = await manager.updateLabelsProperties(
				texts.map((t, i) => ({
					nodeId: t.id,
					properties: {
						messageState: {
							type: "linked" as const,
							messageId: "qa_phase_" + i,
							parameterValues: {},
						},
					},
				})),
			);
			samples.push({
				totalMs: Date.now() - start,
				prepareMs,
				errors: results.filter((r) => r.error).length,
				...phases,
			});
			for (const key in originals) (manager as any)[key] = originals[key];
			frame.remove();
			await new Promise<void>((resolve) => setTimeout(resolve, 400));
		}
		(store as any).bundleStore.dispose();
		(manager as any).disposePageObservers?.();
	} finally {
		await figma.setCurrentPageAsync(originalPage);
		page.remove();
	}
	figma.ui.postMessage(
		samples.map((s: any) => ({
			total: s.totalMs,
			prepare: s.prepareMs,
			errors: s.errors,
			read: s.toLocalizedLabelOrUndefined,
			readCalls: s.toLocalizedLabelOrUndefinedCalls,
			style: s.extractDeltaOpsAndLabelStyles,
		})),
	);
}
run().catch((e) => figma.ui.postMessage({ error: String(e) }));
