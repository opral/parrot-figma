import { describe, expect, test } from "vitest";
import {
	FakeComponentNode,
	FakeFrameNode,
	FakeGroupNode,
	FakeInstanceNode,
	FakeTextNode,
} from "./FakeFigma";
import { createTranslationFixture } from "./translationFixtures";
import { parseBundle, serializeBundle } from "../../lib/message/store/FigmaBundleStore";

describe("Fake Figma regression harness", () => {
	test("tracks stable node identity, selection, plugin data, and mutations", () => {
		const { figma, page, frameA, richText } = createTranslationFixture();

		expect(figma.getNodeById(richText.id)).toBe(richText);
		expect(page.selection).toEqual([frameA]);
		expect(richText.getPluginData("mn")).toBe("checkout.greeting");

		richText.characters = "Hallo Sam";
		richText.setPluginData("l", "de");
		expect(figma.mutations.map(({ nodeId, property }) => ({ nodeId, property }))).toEqual([
			{ nodeId: richText.id, property: "characters" },
			{ nodeId: richText.id, property: "pluginData:l" },
		]);
	});

	test("snapshots rich text and injected failures without touching sibling frames", () => {
		const { figma, richText, sibling } = createTranslationFixture();
		const before = figma.snapshot();
		figma.failOnMutation = { nodeId: richText.id, property: "characters" };

		expect(() => {
			richText.characters = "Hallo";
		}).toThrow("Injected failure");
		expect(figma.snapshot()).toEqual(before);
		expect(sibling.characters).toBe("Hello Sam");
	});

	test("restores characters, rich text, names, and plugin data from a snapshot", () => {
		const { figma, richText } = createTranslationFixture();
		const before = figma.snapshot();
		richText.characters = "Hallo";
		richText.name = "Changed";
		richText.setPluginData("l", "de");
		richText.ranges[0]!.fills = [{ type: "SOLID", color: { r: 1, g: 0, b: 0 } }];

		figma.restore(before);
		expect(figma.snapshot()).toEqual(before);
	});

	test("supports large multi-page fixtures and operation counters", () => {
		const { figma } = createTranslationFixture();
		const page = figma.addPage("Large", "10:0");
		const frame = page.appendChild(new FakeFrameNode("Table", "11:0")) as FakeFrameNode;
		for (let index = 0; index < 1_000; index++) {
			frame.appendChild(new FakeTextNode(`Cell ${index}`, `Cell ${index}`, `12:${index}`));
		}

		const visited: string[] = [];
		figma.traverse(frame, (node) => visited.push(node.id));
		expect(visited).toHaveLength(1_001);
		expect(figma.counters.traversedNodes).toBe(1_001);
		expect(figma.getNodeById("12:999")).toBeDefined();
		expect(figma.counters.nodeLookups).toBe(1);
	});

	test("supports component, instance, group, and document-change fixtures", () => {
		const { figma, page } = createTranslationFixture();
		const component = page.appendChild(
			new FakeComponentNode("Button", "20:0"),
		) as FakeComponentNode;
		const instance = page.appendChild(
			new FakeInstanceNode("Button instance", "21:0"),
		) as FakeInstanceNode;
		const group = instance.appendChild(
			new FakeGroupNode("Label group", "22:0"),
		) as FakeGroupNode;
		const label = group.appendChild(new FakeTextNode("Submit", "Label", "23:0"));
		const events: any[] = [];
		const listener = (event: any) => events.push(event);
		figma.on("documentchange", listener);
		figma.emitDocumentChanges([
			{
				origin: "REMOTE",
				type: "PROPERTY_CHANGE",
				id: label.id,
				node: label,
				properties: ["characters"],
			},
		]);
		figma.off("documentchange", listener);
		figma.emitDocumentChanges([{ origin: "REMOTE", type: "DELETE", id: label.id }]);

		expect(component.type).toBe("COMPONENT");
		expect(instance.type).toBe("INSTANCE");
		expect(events).toHaveLength(1);
	});

	test("splits half-open ranges at mutation boundaries", () => {
		const { richText } = createTranslationFixture();
		richText.setRangeIndentation(4, 12, 3);

		expect(richText.ranges.map(({ start, end, indentation }) => ({ start, end, indentation }))).toEqual([
			{ start: 0, end: 4, indentation: 0 },
			{ start: 4, end: 9, indentation: 3 },
			{ start: 9, end: 12, indentation: 3 },
			{ start: 12, end: 19, indentation: 1 },
		]);
		expect(richText.getRangeFontName(9)).toEqual({ family: "Inter", style: "Italic" });
	});

	test("rejects duplicate node IDs", () => {
		const { page } = createTranslationFixture();
		const childCount = page.children.length;
		expect(() => page.appendChild(new FakeTextNode("Duplicate", "Duplicate", "4:0"))).toThrow(
			"Duplicate fake Figma node id",
		);
		expect(page.children).toHaveLength(childCount);
	});

	test("counts criteria traversals and exports", async () => {
		const { figma, frameA } = createTranslationFixture();
		expect(frameA.findAllWithCriteria({ types: ["TEXT"] })).toHaveLength(1);
		await frameA.exportAsync();
		expect(figma.counters.traversedNodes).toBe(1);
		expect(figma.counters.exports).toBe(1);
	});

	test("retains Inlang v2 selectors, variables, matches, and fallback variants", () => {
		const { bundle } = createTranslationFixture();
		const roundtripped = parseBundle(serializeBundle(bundle), bundle.id);

		expect(roundtripped).toEqual(bundle);
		expect(roundtripped.declarations).toContainEqual(
			expect.objectContaining({ type: "input-variable", name: "count" }),
		);
		expect(roundtripped.messages[0]?.variants[0]?.pattern).toContainEqual({
			type: "markup-start",
			name: "strong",
		});
	});
});
