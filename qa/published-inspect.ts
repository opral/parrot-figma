import {
	FIGMA_BUNDLE_PREFIX,
	LEGACY_MESSAGE_PREFIX,
} from "../src/lib/message/store/FigmaBundleStore";
async function snapshot() {
	const root: Record<string, string> = {};
	for (const key of figma.root.getPluginDataKeys())
		if (
			key.startsWith(LEGACY_MESSAGE_PREFIX) ||
			key.startsWith(FIGMA_BUNDLE_PREFIX) ||
			["prt_c", "prt_ic", "fileSetupCompleted", "parrot_migration_executed", "prt_t"].includes(key)
		)
			root[key] = figma.root.getPluginData(key);
	const nodes = [];
	for (const page of figma.root.children) {
		await page.loadAsync();
		for (const text of page.findAllWithCriteria({ types: ["TEXT"] })) {
			const data: Record<string, string> = {};
			for (const key of text.getPluginDataKeys()) data[key] = text.getPluginData(key);
			nodes.push({ id: text.id, page: page.name, characters: text.characters, data });
		}
	}
	return { root, nodes };
}
async function run() {
	const id = figma.root.getPluginData("qa_published_frame");
	if (!id) throw Error("Use only the published-version QA fixture");
	if (!figma.root.getPluginData("qa_published_cloned")) {
		const first = await figma.getNodeByIdAsync(id);
		if (first?.type !== "FRAME") throw Error("Missing fixture frame");
		const second = figma.root.children.find((p) => p.name === "Published upgrade B")!;
		await second.loadAsync();
		second.appendChild(first.clone());
		figma.root.setPluginData("qa_published_cloned", "true");
	}
	const before = await snapshot();
	if (!figma.root.getPluginData("qa_before_upgrade"))
		figma.root.setPluginData("qa_before_upgrade", JSON.stringify(before));
	figma.showUI(
		'<div id="r"></div><script>onmessage=e=>{const r=document.getElementById("r");r.textContent="";for(const [k,v] of Object.entries(e.data.pluginMessage.root||{})){for(let i=0;i<v.length;i+=250){let p=document.createElement("pre");p.textContent=JSON.stringify([k,i,v.slice(i,i+250)]);r.appendChild(p)}}}</script>',
		{ width: 900, height: 800 },
	);
	figma.ui.postMessage({ root: before.root });
}
run().catch((e) => figma.closePlugin(String(e)));
