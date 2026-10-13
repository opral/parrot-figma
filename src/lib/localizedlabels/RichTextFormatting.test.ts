import { describe, expect, it, vi } from "vitest";
import {
	mergeUncoveredPlaceholders,
	restoreTextFillRanges,
	toQuillTextOperations,
	type TextRangeOperation,
} from "./RichTextFormatting";

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

	// the sandbox lists a placeholder at the very start of a single-style text next to the style range
	// (the "2" of "2 items" with its invisible marker is [0, 2) of the 8 characters)
	type Range = TextRangeOperation<{ indentation?: number; bold?: boolean }>;
	const placeholder = { name: "count", unnamed: false, invisibleMarkers: 2 };
	const loose: Range[] = [
		{ start: 0, end: 8, attributes: { indentation: 0 } },
		{ start: 0, end: 2, attributes: { placeholder } },
	];

	it("cuts a placeholder at the start out of the style range it sits in", () => {
		expect(mergeUncoveredPlaceholders(loose)).toEqual([
			{ start: 0, end: 2, attributes: { indentation: 0, placeholder } },
			{ start: 2, end: 8, attributes: { indentation: 0 } },
		]);
		expect(toQuillTextOperations("2\u200b items", loose)).toEqual([
			{ insert: "count", attributes: { indentation: 0, placeholder } },
			{ insert: " items", attributes: { indentation: 0 } },
			{ insert: "\n", attributes: { indentation: 0 } },
		]);
	});

	it("cuts a placeholder out of the middle of a range too, and keeps styles on both sides", () => {
		const ranges: Range[] = [
			{ start: 0, end: 10, attributes: { bold: true } },
			{ start: 4, end: 6, attributes: { placeholder } },
		];
		expect(mergeUncoveredPlaceholders(ranges)).toEqual([
			{ start: 0, end: 4, attributes: { bold: true } },
			{ start: 4, end: 6, attributes: { bold: true, placeholder } },
			{ start: 6, end: 10, attributes: { bold: true } },
		]);
	});

	it("leaves ranges that do not overlap as they are", () => {
		const merged: Range[] = [
			{ start: 0, end: 2, attributes: { indentation: 0, placeholder } },
			{ start: 2, end: 8, attributes: { indentation: 0 } },
		];
		expect(mergeUncoveredPlaceholders(merged)).toEqual(merged);
		expect(mergeUncoveredPlaceholders([])).toEqual([]);
	});
});
