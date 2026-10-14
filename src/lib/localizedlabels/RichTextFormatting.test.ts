import { describe, expect, it, vi } from "vitest";
import { restoreTextFillRanges, toQuillTextOperations } from "./RichTextFormatting";

describe("rich text formatting helpers", () => {
	it("restores mixed fill colors across replacement text ranges", async () => {
		const red = { type: "SOLID", color: { r: 1, g: 0, b: 0 } } as Paint;
		const blue = { type: "SOLID", color: { r: 0, g: 0, b: 1 } } as Paint;
		const setRangeFills = vi.fn();

		await restoreTextFillRanges(
			[
				{ start: 0, end: 4, fills: [red] },
				{ start: 4, end: 8, fills: [blue] },
			],
			8,
			10,
			setRangeFills,
		);

		expect(setRangeFills.mock.calls.map((call) => call.slice(0, 3))).toEqual([
			[0, 4, [red]],
			[4, 10, [blue]],
		]);
	});

	it("clips fill ranges when translated text is shorter", async () => {
		const red = { type: "SOLID", color: { r: 1, g: 0, b: 0 } } as Paint;
		const blue = { type: "SOLID", color: { r: 0, g: 0, b: 1 } } as Paint;
		const setRangeFills = vi.fn();

		await restoreTextFillRanges(
			[
				{ start: 0, end: 4, fills: [red] },
				{ start: 4, end: 8, fills: [blue] },
			],
			8,
			6,
			setRangeFills,
		);

		expect(setRangeFills.mock.calls.map((call) => call.slice(0, 3))).toEqual([
			[0, 4, [red]],
			[4, 6, [blue]],
		]);
	});

	it("keeps Quill's terminal newline outside the final list range", () => {
		const operations = [{ start: 0, end: 5, attributes: { list: "bullet" } }];

		expect(toQuillTextOperations("item\n", operations)).toEqual([
			{ insert: "item\n", attributes: { list: "bullet" } },
			{ insert: "\n" },
		]);
		expect(operations[0]?.end).toBe(5);
	});

	it("applies the last line's list formatting to a required newline", () => {
		expect(
			toQuillTextOperations("item", [{ start: 0, end: 4, attributes: { list: "bullet" } }]),
		).toEqual([
			{ insert: "item", attributes: { list: "bullet" } },
			{ insert: "\n", attributes: { list: "bullet" } },
		]);
	});
});

import { rangeMatches } from "./RichTextFormatting";
it("matches only complete range coverage with the expected formatting", () => {
	const segments = [
		{ start: 0, end: 3, value: "same" },
		{ start: 3, end: 8, value: "different" },
	];
	expect(rangeMatches(segments, 0, 3, (s) => s.value === "same")).toBe(true);
	expect(rangeMatches(segments, 0, 4, (s) => s.value === "same")).toBe(false);
	expect(rangeMatches([{ start: 1, end: 3, value: "same" }], 0, 3, () => true)).toBe(false);
	expect(rangeMatches([{ start: 0, end: 2, value: "same" }], 0, 3, () => true)).toBe(false);
	expect(rangeMatches(segments, 3, 3, () => false)).toBe(true);
});
