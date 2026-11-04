import LocalizedLabelManager from "../src/lib/localizedlabels/LocalizedLabelManager";
import { InlangMessageStore } from "../src/lib/message/store/InlangMessageStoreFigmaRoot";
figma.showUI(
	'<html><body><pre id="result">Profiling Parrot…</pre><script>onmessage=e=>{const p=e.data.pluginMessage;if(p.profile||p.error)document.getElementById("result").textContent=JSON.stringify({...p,samples:undefined},null,2)+String.fromCharCode(10)+(p.samples||[]).map(s=>s.join(",")).join(String.fromCharCode(10))}</script></body></html>',
	{ width: 650, height: 650 },
);
async function sample() {
	const started = Date.now();
	const storeStart = Date.now();
	const store = new InlangMessageStore(false);
	const storeMs = Date.now() - storeStart;
	const manager = new LocalizedLabelManager();
	manager.messageStore = store;
	const layersStart = Date.now();
	const layers = await manager.getPageRootFrames();
	const layersMs = Date.now() - layersStart;
	const scanStart = Date.now();
	await manager.fillUpCache();
	const scanMs = Date.now() - scanStart;
	const labelsStart = Date.now();
	const labels = await manager.getPageLabels();
	const labelsMs = Date.now() - labelsStart;
	const frameStart = Date.now();
	const frame = layers.frames[0] ? await manager.getFrameById(layers.frames[0].id) : undefined;
	const frameMs = Date.now() - frameStart;
	(store as any).bundleStore.dispose();
	(manager as any).disposePageObservers?.();
	return {
		page: layers.pageName,
		labels: labels.length,
		frameLabels: frame?.localizedLabelsInFrame.length,
		times: [storeMs, layersMs, scanMs, labelsMs, frameMs, Date.now() - started],
	};
}
async function run() {
	const samples = [];
	for (let i = 0; i < 3; i++) samples.push(await sample());
	const median = samples[0].times.map(
		(_, i) => samples.map((s) => s.times[i]).sort((a, b) => a - b)[1],
	);
	figma.ui.postMessage({
		profile: true,
		page: samples[0].page,
		pages: figma.root.children.length,
		labels: samples[0].labels,
		columns: ["store", "layers", "scan", "labels", "frame", "total"],
		median,
		samples: samples.map((s) => s.times),
	});
}
run().catch((error) => figma.ui.postMessage({ error: String(error), stack: error.stack }));
