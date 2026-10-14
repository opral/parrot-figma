const beforeRaw = figma.root.getPluginData("qa_before_upgrade");
if (!beforeRaw) throw Error("Use only the isolated published upgrade fixture");
const before = JSON.parse(beforeRaw);
figma.showUI(
	'<button id="u">Undo one Figma step</button><pre id="r"></pre><script>document.getElementById("u").onclick=()=>parent.postMessage({pluginMessage:{undo:true}},"*");onmessage=e=>document.getElementById("r").textContent=JSON.stringify(e.data.pluginMessage)</script>',
	{ width: 900, height: 400 },
);
let steps = 0;
figma.ui.onmessage = async (m) => {
	if (!m.undo) return;
	figma.triggerUndo();
	steps++;
	await new Promise<void>((r) => setTimeout(r, 400));
	const texts = [];
	for (const old of before.nodes) {
		const text = await figma.getNodeByIdAsync(old.id);
		if (text?.type === "TEXT" && old.data.mn)
			texts.push({
				id: text.id,
				text: text.characters,
				matches: text.characters === old.characters,
				l: text.getPluginData("l"),
			});
	}
	const frame = await figma.getNodeByIdAsync(figma.root.getPluginData("qa_published_frame"));
	figma.ui.postMessage({
		steps,
		texts,
		frameLanguage: frame?.getPluginData("l"),
		migration: figma.root.getPluginData("parrot_migration_executed"),
	});
};
