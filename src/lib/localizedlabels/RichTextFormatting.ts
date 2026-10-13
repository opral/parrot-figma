export type TextFillRange = {
	start: number;
	end: number;
	fills: Paint[];
	/** the color style of the range ("" = none): restoring raw fills would detach it */
	fillStyleId?: string;
};

export async function restoreTextFillRanges(
	ranges: readonly TextFillRange[],
	sourceTextLength: number,
	targetTextLength: number,
	setRangeFills: (start: number, end: number, fills: Paint[], range: TextFillRange) => unknown,
) {
	for (const range of ranges) {
		const end =
			range.end === sourceTextLength ? targetTextLength : Math.min(range.end, targetTextLength);
		if (range.start < end) {
			await setRangeFills(range.start, end, range.fills, range);
		}
	}
}

/** Sets a range's color style when it had one, its raw fills otherwise. */
export async function setTextFillRange(
	node: Pick<TextNode, "setRangeFills" | "setRangeFillStyleIdAsync">,
	start: number,
	end: number,
	range: TextFillRange,
) {
	if (range.fillStyleId) await node.setRangeFillStyleIdAsync(start, end, range.fillStyleId);
	else node.setRangeFills(start, end, range.fills);
}

type PlaceholderAttribute = { placeholder?: { name: string } };

export type TextRangeOperation<Attributes> = {
	start: number;
	end: number;
	attributes: Attributes & PlaceholderAttribute;
};

export type QuillTextOperation<Attributes> = {
	insert: string;
	attributes?: Attributes & PlaceholderAttribute;
};

/**
 * A placeholder the sandbox could not merge into the text styles (one at the very start of a text that
 * has a single style, e.g. the "2" of "2 items") comes as a range of its own that overlaps the style range
 * it sits in. The placeholder is cut out of that range: it carries the style of the text around it, and
 * the style range keeps the rest. Without it the whole text is inserted and the placeholder again after
 * it ("2 items" followed by a "count" chip), which also makes the layer look modified.
 */
export function mergeUncoveredPlaceholders<Attributes>(
	operations: readonly TextRangeOperation<Attributes>[],
): TextRangeOperation<Attributes>[] {
	const overlap = (a: { start: number; end: number }, b: { start: number; end: number }) =>
		a.start < b.end && b.start < a.end;
	const uncovered = operations.filter(
		(operation) =>
			operation.attributes.placeholder &&
			operations.some(
				(other) =>
					other !== operation && !other.attributes.placeholder && overlap(operation, other),
			),
	);
	if (uncovered.length === 0) return [...operations];

	const result: TextRangeOperation<Attributes>[] = [];
	const merged = new Set<TextRangeOperation<Attributes>>();
	for (const operation of operations) {
		if (uncovered.includes(operation)) continue;
		let start = operation.start;
		for (const placeholder of uncovered.filter((candidate) => overlap(candidate, operation))) {
			if (placeholder.start > start) result.push({ ...operation, start, end: placeholder.start });
			if (!merged.has(placeholder)) {
				merged.add(placeholder);
				result.push({
					...placeholder,
					attributes: { ...operation.attributes, ...placeholder.attributes },
				});
			}
			start = Math.max(start, placeholder.end);
		}
		if (start < operation.end) result.push({ ...operation, start });
	}
	return result.sort((a, b) => a.start - b.start || a.end - b.end);
}

/**
 * Convert source text ranges to Quill inserts and append Quill's required final newline
 * separately. When the source text already ends with a newline, keep the helper newline
 * unformatted so a list does not gain an empty final item. Otherwise, apply the final range's
 * formatting to Quill's required newline so the source's last list item keeps its formatting.
 */
export function toQuillTextOperations<Attributes>(
	text: string,
	operations: readonly TextRangeOperation<Attributes>[],
): QuillTextOperation<Attributes>[] {
	const ranges = mergeUncoveredPlaceholders(operations);
	const result: QuillTextOperation<Attributes>[] = ranges.map((operation) => ({
		insert:
			operation.attributes.placeholder?.name ??
			text.substring(operation.start, Math.min(operation.end, text.length)),
		attributes: operation.attributes,
	}));

	const terminalAttributes = text.endsWith("\n") ? undefined : ranges.at(-1)?.attributes;
	result.push({ insert: "\n", attributes: terminalAttributes });
	return result;
}
