import { describe, expect, it, vi } from "vitest";
import LocalizedLabelManager from "./LocalizedLabelManager";

describe("LocalizedLabelManager font load errors", () => {
	const manager = new LocalizedLabelManager() as any;

	it("wraps the plain string figma.loadFontAsync rejects with", () => {
		// figma.loadFontAsync rejects with a string for missing fonts - assigning `.message` on it throws "not an object"
		const error = manager.toFontLoadError(
			"Could not load bold font for Inter",
			'The font "Inter Bold" could not be loaded',
		);

		expect(error).toBeInstanceOf(Error);
		expect(error.message).toBe(
			'Could not load bold font for Inter: The font "Inter Bold" could not be loaded',
		);
	});

	it("keeps the message of a real Error", () => {
		const error = manager.toFontLoadError("Can't update label", new Error("boom"));

		expect(error.message).toBe("Can't update label: boom");
	});
});

describe("LocalizedLabelManager.loadFont", () => {
	it("loads a font once and retries fonts that failed", async () => {
		const manager = new LocalizedLabelManager() as any;
		const loadFontAsync = vi
			.fn()
			.mockRejectedValueOnce('The font "Inter Bold" could not be loaded')
			.mockResolvedValue(undefined);
		vi.stubGlobal("figma", { loadFontAsync });
		try {
			const bold = { family: "Inter", style: "Bold" };
			await expect(manager.loadFont(bold)).rejects.toBeDefined();
			await manager.loadFont(bold);
			await manager.loadFont({ ...bold });
			await manager.loadFonts([bold, { family: "Inter", style: "Regular" }]);
			// failed once, then loaded once; Regular once
			expect(loadFontAsync).toHaveBeenCalledTimes(3);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("LocalizedLabelManager.updateLabelsProperties", () => {
	it("keeps going when a label fails and reports its error", async () => {
		const manager = new LocalizedLabelManager() as any;
		manager.createLabelReadContext = () => ({});
		vi.stubGlobal("figma", { getNodeByIdAsync: async () => undefined });
		manager.updateLabelPropertiesWithNode = vi.fn(async (nodeId: string) => {
			if (nodeId === "b") throw new Error("Can't update label: font missing");
			return { nodeId };
		});
		try {
			const results = await manager.updateLabelsProperties([
				{ nodeId: "a", properties: {} },
				{ nodeId: "b", properties: {} },
				{ nodeId: "c", properties: {} },
			]);
			expect(results).toEqual([
				{ label: { nodeId: "a" } },
				{ error: "Can't update label: font missing" },
				{ label: { nodeId: "c" } },
			]);
		} finally {
			vi.unstubAllGlobals();
		}
	});
});

describe("dynamic page index", () => {
	it("loads a page before accessing its children and indexes live nodes without exports", async () => {
		const manager = new LocalizedLabelManager() as any;
		manager.messageStore = { messageIdToLabels: new Map() };
		const root: any = {
			id: "root",
			type: "DOCUMENT",
			getPluginData: () => "",
			setPluginData: vi.fn(),
		};
		const text: any = {
			id: "label",
			type: "TEXT",
			removed: false,
			getPluginData: (key: string) => (key === "mn" ? "welcome" : ""),
		};
		let loaded = false;
		const current: any = { id: "current", type: "PAGE", parent: root, children: [], on: vi.fn() };
		const other: any = {
			id: "other",
			type: "PAGE",
			parent: root,
			name: "Other",
			loadAsync: vi.fn(async () => {
				loaded = true;
			}),
			on: vi.fn(),
			get children() {
				if (!loaded) throw Error("unloaded");
				return [text];
			},
		};
		text.parent = other;
		root.children = [current, other];
		vi.stubGlobal("figma", {
			root,
			currentPage: current,
			ui: { postMessage: vi.fn() },
			loadAllPagesAsync: vi.fn(async () => {}),
			on: vi.fn(),
			getNodeById: () => {
				throw Error("deprecated");
			},
		});
		try {
			await manager.fillUpCache();
			expect(other.loadAsync).toHaveBeenCalledOnce();
			expect(other.on).toHaveBeenCalledWith("nodechange", expect.any(Function));
			expect(manager.messageStore.messageIdToLabels.get("welcome")).toEqual(new Set(["label"]));
			expect(root.setPluginData).toHaveBeenCalledWith("numberOfTextNodes", "1");
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("reads selection before the virtual index exists", async () => {
		const manager = new LocalizedLabelManager() as any;
		const text = { id: "text", type: "TEXT" };
		const frame = { id: "frame", type: "FRAME", findAllWithCriteria: () => [text] };
		manager.getRootFrame = () => frame;
		manager.toLocalizedLabelOrUndefined = () => ({ messageId: "hello" });
		vi.stubGlobal("figma", { currentPage: { selection: [frame] } });
		try {
			expect((await manager.getSelection()).text.messageId).toBe("hello");
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("unlinking removes reverse and virtual references, allowing a relink to the same key", () => {
		const manager = new LocalizedLabelManager() as any;
		manager.messageStore = { messageIdToLabels: new Map() };
		const node: any = { id: "text", type: "TEXT", getPluginData: () => "" };
		manager.virtualTree.addNode(node, node.id);
		manager.refreshLabelMessageLinkCache("text", "hello");
		manager.refreshLabelMessageLinkCache("text", undefined);
		expect(manager.virtualTree.getVirtualNode("text").messageId).toBeUndefined();
		manager.refreshLabelMessageLinkCache("text", "hello");
		expect(manager.messageStore.messageIdToLabels.get("hello")).toEqual(new Set(["text"]));
	});
});

describe("bulk async node lookup", () => {
	it("resolves every layer once and reuses the same handles for the batch", async () => {
		const manager = new LocalizedLabelManager() as any;
		const nodes = [
			{ id: "a", type: "TEXT", getPluginData: () => "" },
			{ id: "b", type: "TEXT", getPluginData: () => "" },
		];
		const getNodeByIdAsync = vi.fn(async (id: string) => nodes.find((node) => node.id === id));
		vi.stubGlobal("figma", { getNodeByIdAsync });
		manager.loadFontsForTextNodes = vi.fn(async () => {});
		manager.updateLabelPropertiesWithNode = vi.fn(
			async (id: string, _props: unknown, node: unknown) => {
				expect(node).toBe(nodes.find((node) => node.id === id));
				return { nodeId: id };
			},
		);
		try {
			await manager.updateLabelsProperties([
				{ nodeId: "a", properties: { characters: "A" } },
				{ nodeId: "b", properties: { characters: "B" } },
			]);
			expect(getNodeByIdAsync).toHaveBeenCalledTimes(2);
			expect(manager.loadFontsForTextNodes).toHaveBeenCalledWith(nodes);
		} finally {
			vi.unstubAllGlobals();
		}
	});
	it("releases the per-label queue if a prefetched layer is removed before use", async () => {
		vi.useFakeTimers();
		const manager = new LocalizedLabelManager() as any;
		vi.stubGlobal("figma", {
			getNodeByIdAsync: async () => ({ id: "deleted", type: "TEXT", removed: true }),
		});
		try {
			const results = await manager.updateLabelsProperties([{ nodeId: "deleted", properties: {} }]);
			expect(results[0].error).toContain("no longer exists");
			await vi.advanceTimersByTimeAsync(1);
			expect(manager.labelUpdateQueue.deleted).toBeUndefined();
		} finally {
			vi.unstubAllGlobals();
			vi.useRealTimers();
		}
	});
});

it("reuses loaded live nodes and resolves a fresh handle after removal", async () => {
	const manager = new LocalizedLabelManager() as any;
	const cached: any = { id: "text", type: "TEXT", removed: false, getPluginData: () => "" };
	const replacement = { ...cached };
	manager.virtualTree.addNode(cached, cached.id);
	const getNodeByIdAsync = vi.fn(async () => replacement);
	vi.stubGlobal("figma", { getNodeByIdAsync });
	try {
		expect(await manager.getNode("text")).toBe(cached);
		expect(getNodeByIdAsync).not.toHaveBeenCalled();
		cached.removed = true;
		expect(await manager.getNode("text")).toBe(replacement);
		expect(getNodeByIdAsync).toHaveBeenCalledOnce();
		expect(manager.virtualTree.getVirtualNode("text").sourceNode).toBe(replacement);
	} finally {
		vi.unstubAllGlobals();
	}
});
