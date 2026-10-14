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
 * Convert source text ranges to Quill inserts and append Quill's required final newline
 * separately. When the source text already ends with a newline, keep the helper newline
 * unformatted so a list does not gain an empty final item. Otherwise, apply the final range's
 * formatting to Quill's required newline so the source's last list item keeps its formatting.
 */
export function toQuillTextOperations<Attributes>(
	text: string,
	operations: readonly TextRangeOperation<Attributes>[],
): QuillTextOperation<Attributes>[] {
	const result: QuillTextOperation<Attributes>[] = operations.map((operation) => ({
		insert:
			operation.attributes.placeholder?.name ??
			text.substring(operation.start, Math.min(operation.end, text.length)),
		attributes: operation.attributes,
	}));

	const terminalAttributes = text.endsWith("\n") ? undefined : operations.at(-1)?.attributes;
	result.push({ insert: "\n", attributes: terminalAttributes });
	return result;
}

/** Every character in the range must be covered by segments satisfying the predicate. */
export function rangeMatches<T extends { start: number; end: number }>(
	segments: readonly T[],
	start: number,
	end: number,
	matches: (segment: T) => boolean,
) {
	if (start >= end) return true;
	let covered = start;
	for (const segment of segments) {
		if (segment.end <= covered) continue;
		if (segment.start > covered || !matches(segment)) return false;
		covered = Math.min(end, segment.end);
		if (covered === end) return true;
	}
	return false;
}
