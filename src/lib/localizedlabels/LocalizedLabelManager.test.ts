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
		vi.stubGlobal("figma", { getNodeById: () => undefined });
		manager.updateLabelProperties = vi.fn(async (nodeId: string) => {
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
