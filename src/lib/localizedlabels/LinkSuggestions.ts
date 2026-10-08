import type { Message } from "../message/LegacyMessage";
import { htmlToPlainText } from "../message/editor/HtmlText";
import { suggestMessageKey } from "./KeySuggestion";

/**
 * Matching text layers to messages by their text - used to link layers after an import and to propose
 * keys for all unlinked layers of a frame. Layers and messages are compared by their visible text:
 * whitespace and line breaks are collapsed, formatting is ignored.
 */

export type LayerText = {
	nodeId: string;
	characters: string;
	/** the language the layer text is in (the language of its frame) */
	language: string;
	layerName: string;
	frameName: string | undefined;
};

export function normalizeText(value: string) {
	return value.replace(/\s+/g, " ").trim();
}

/** The visible text of a message in a language - undefined for variables, plurals or no text. */
export function messageText(message: Message, language: string) {
	if (message.selectors.length > 0) return undefined;
	const variants = message.variants.filter((variant) => variant.languageTag === language);
	if (variants.length !== 1) return undefined;
	const { pattern } = variants[0];
	if (pattern.length === 0 || pattern.some((part) => part.type !== "Text")) return undefined;
	const html = pattern.map((part) => (part.type === "Text" ? part.value : "")).join("");
	const text = normalizeText(
		htmlToPlainText(
			html
				.replace(/<br\s*\/?>|<\/(p|li|div|h[1-6])>/gi, "\n")
				.replace(/<[^>]*>/g, "")
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'"),
		),
	);
	return text === "" ? undefined : text;
}

/** language -> normalized text -> ids of the messages with exactly that text */
export type MessageTextIndex = Map<string, Map<string, string[]>>;

export function buildMessageTextIndex(messages: readonly Message[], languages: Iterable<string>) {
	const index: MessageTextIndex = new Map();
	for (const language of languages) {
		const byText = new Map<string, string[]>();
		for (const message of messages) {
			const text = messageText(message, language);
			if (text === undefined) continue;
			byText.set(text, [...(byText.get(text) ?? []), message.id]);
		}
		index.set(language, byText);
	}
	return index;
}

export function messagesWithText(
	index: MessageTextIndex,
	layer: Pick<LayerText, "characters" | "language">,
) {
	const text = normalizeText(layer.characters);
	if (text === "") return [];
	return index.get(layer.language)?.get(text) ?? [];
}

/**
 * Layers whose text equals the text of a message in the layer's language. `onlyMessageIds` limits the
 * matches to these messages (e.g. the messages that were just imported).
 */
export function matchLayersToMessages(
	layers: readonly LayerText[],
	index: MessageTextIndex,
	onlyMessageIds?: ReadonlySet<string>,
) {
	const matches = [] as { layer: LayerText; messageIds: string[] }[];
	for (const layer of layers) {
		const messageIds = messagesWithText(index, layer).filter(
			(id) => !onlyMessageIds || onlyMessageIds.has(id),
		);
		if (messageIds.length > 0) matches.push({ layer, messageIds });
	}
	return matches;
}

export type ProposedKey = {
	layer: LayerText;
	key: string;
	/** a message with exactly this text exists - the layer is linked to it instead of a new one */
	existing: boolean;
};

/**
 * A key for every layer: an existing message with the same text, else a suggested new key. Layers with
 * the same text share one key, new keys never collide with existing ones or with each other.
 */
export function proposeKeys(
	layers: readonly LayerText[],
	messages: readonly Message[],
	index: MessageTextIndex,
) {
	const takenKeys = new Set(messages.map((message) => message.id));
	const keyForText = new Map<string, string>();
	const proposals = [] as ProposedKey[];

	for (const layer of layers) {
		const [existingId] = messagesWithText(index, layer);
		if (existingId !== undefined) {
			proposals.push({ layer, key: existingId, existing: true });
			continue;
		}
		const textKey = `${layer.language}\u0000${normalizeText(layer.characters)}`;
		let key = keyForText.get(textKey);
		if (key === undefined) {
			key = suggestMessageKey({
				frameName: layer.frameName,
				layerName: layer.layerName,
				characters: layer.characters,
				existingKeys: takenKeys,
			});
			takenKeys.add(key);
			keyForText.set(textKey, key);
		}
		proposals.push({ layer, key, existing: false });
	}
	return proposals;
}

/** Keys that can be typed for a message: letters, digits, `.`, `_`, `-`, ending in a letter or digit. */
export function isValidMessageKey(key: string) {
	return /^[A-Za-z0-9._-]*[A-Za-z0-9]$/.test(key);
}

/**
 * Layers that would create a message with a key another layer creates for a different text: the
 * message can only hold one text, so the second layer would silently show the first text.
 * Returns true for every such layer after the first one.
 */
export function findKeyConflicts(newMessages: readonly { key: string; characters: string }[]) {
	const textByKey = new Map<string, string>();
	return newMessages.map(({ key, characters }) => {
		const text = normalizeText(characters);
		const first = textByKey.get(key);
		if (first === undefined) {
			textByKey.set(key, text);
			return false;
		}
		return first !== text;
	});
}
