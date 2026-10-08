import { describe, expect, it } from "vitest";
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
