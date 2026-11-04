import { InlangMessageStore } from "../src/lib/message/store/InlangMessageStoreFigmaRoot";
import LocalizedLabelManager from "../src/lib/localizedlabels/LocalizedLabelManager";
import {
	LEGACY_MESSAGE_PREFIX,
	FIGMA_BUNDLE_PREFIX,
} from "../src/lib/message/store/FigmaBundleStore";
function check(ok: unknown, msg: string): asserts ok {
	if (!ok) throw Error(msg);
}
function canonical(value: any): any {
	return Array.isArray(value)
		? value.map(canonical)
		: value && typeof value === "object"
			? Object.fromEntries(
					Object.entries(value)
						.sort(([a], [b]) => a.localeCompare(b))
						.map(([k, v]) => [k, canonical(v)]),
				)
			: value;
}
const equal = (a: any, b: any) => JSON.stringify(canonical(a)) === JSON.stringify(canonical(b));
figma.showUI(
	'<pre id="r">Verifying published-project upgrade…</pre><script>onmessage=e=>{if(e.data.pluginMessage.verified||e.data.pluginMessage.error)document.getElementById("r").textContent=JSON.stringify(e.data.pluginMessage)}</script>',
	{ width: 850, height: 450 },
);
async function run() {
	const before = JSON.parse(figma.root.getPluginData("qa_before_upgrade"));
	check(before, "Missing published QA snapshot");
	check(
		figma.root.getPluginData("parrot_migration_executed") === "0.10.101",
		"Older schema migration did not complete",
	);
	const store = new InlangMessageStore(false);
	const manager = new LocalizedLabelManager(store);
	await manager.prepare();
	let messages = 0;
	for (const [key, raw] of Object.entries(before.root) as [string, string][]) {
		if (key.startsWith(LEGACY_MESSAGE_PREFIX)) {
			const source = JSON.parse(raw);
			const actual = await store.getMessageAsync(source.id);
			check(actual, "Missing message " + source.id);
			const normalized = {
				id: source.id,
				alias: source.alias ?? {},
				selectors: source.selectors,
				variants: source.variants,
			};
			const projected = {
				id: actual.id,
				alias: actual.alias ?? {},
				selectors: actual.selectors,
				variants: actual.variants,
			};
			check(equal(normalized, projected), "Message changed: " + source.id);
			check(figma.root.getPluginData(key) === "", "Legacy key still active");
			check(
				figma.root.getPluginData(FIGMA_BUNDLE_PREFIX + source.id) !== "",
				"Missing native bundle",
			);
			messages++;
		} else if (key !== "parrot_migration_executed")
			check(figma.root.getPluginData(key) === raw, "Configuration changed: " + key);
	}
	let linked = 0;
	for (const old of before.nodes) {
		const text = await figma.getNodeByIdAsync(old.id);
		check(text?.type === "TEXT", "Layer missing: " + old.id);
		check(text.characters === old.characters, "Canvas text changed");
		for (const [key, value] of Object.entries(old.data))
			check(text.getPluginData(key) === value, "Layer plugin data changed: " + key);
		if (old.data.mn) {
			const label = await manager.getById(old.id);
			check(label?.messageId === old.data.mn, "Layer link changed");
			linked++;
		}
	}
	await manager.startFillupCache();
	const hello = await manager.getWithMessages(["store_upgrade__hello"]);
	check(hello.length === 2, "Cross-page links were lost");
	(store as any).bundleStore.dispose();
	(manager as any).disposePageObservers?.();
	figma.ui.postMessage({
		verified: true,
		messages,
		linkedLayers: linked,
		canvasTextUnchanged: true,
		layerDataUnchanged: true,
		configurationUnchanged: true,
		crossPageLinks: hello.length,
	});
}
run().catch((e) => figma.ui.postMessage({ error: String(e), stack: e.stack }));
