import type { SearchQuery } from "./store/MessageStoreMemory";

/**
 * Message IDs are canonical Inlang identifiers. Parrot must never derive or
 * normalize them from display text because punctuation and Unicode are valid.
 */
export function preserveCanonicalMessageKey(value: string): string {
	return value;
}

export function isCanonicalMessageKey(value: string): boolean {
	return value.length > 0;
}

/** Avoid the legacy text-query parser, which only recognizes ASCII `\w` IDs. */
export function canonicalMessageKeySearchQuery(messageId: string, labelText: string): SearchQuery {
	return {
		exactText: true,
		name: messageId === "" ? "*" : messageId,
		text: labelText,
	};
}
