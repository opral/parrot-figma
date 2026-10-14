async function seed() {
	if (figma.root.getPluginDataKeys().length !== 0)
		throw Error("Use a fresh, empty file before opening Parrot");
	for (const page of figma.root.children) {
		await page.loadAsync();
		if (page.children.length !== 0) throw Error("Use a fresh, empty file");
	}
	await figma.loadFontAsync({ family: "Inter", style: "Regular" });
	for (let i = 0; i < 2; i++) {
		const page = figma.createPage();
		page.name = "Published upgrade " + (i ? "B" : "A");
		await figma.setCurrentPageAsync(page);
		const frame = figma.createFrame();
		frame.name = "Published upgrade frame " + (i ? "B" : "A");
		frame.resize(600, 500);
		const values = i ? ["Café 🦜 welcome", "3 items"] : ["Hello Anna!", "First line\nSecond line"];
		values.forEach((value, j) => {
			const text = figma.createText();
			text.fontName = { family: "Inter", style: "Regular" };
			text.characters = value;
			text.y = j * 80;
			frame.appendChild(text);
		});
		if (!i) figma.root.setPluginData("qa_published_frame", frame.id);
	}
	const first = figma.root.children.find((p) => p.name === "Published upgrade A")!;
	await figma.setCurrentPageAsync(first);
	const frame = await figma.getNodeByIdAsync(figma.root.getPluginData("qa_published_frame"));
	if (frame?.type === "FRAME") figma.currentPage.selection = [frame];
	figma.closePlugin("Published-version upgrade canvas fixture prepared.");
}
seed().catch((e) => figma.closePlugin(String(e)));
