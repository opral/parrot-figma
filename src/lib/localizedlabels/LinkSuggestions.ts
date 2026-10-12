import type { Message } from "../message/LegacyMessage";
import { htmlToPlainText } from "../message/editor/HtmlText";
import { suggestMessageKey } from "./KeySuggestion";

/**
 * Matching text layers to messages by their text - used to link layers after an import and to propose
 * keys for all unlinked layers of a frame. Layers and messages are compared by their visible text:
 * whitespace and line breaks are collapsed, formatting is ignored. That comparison only finds the
 * candidates - the collapsed text is never written anywhere (see `planLinks`).
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

/** The stored (HTML) text of a message in a language - undefined for variables, plurals or no text. */
export function messageHtml(message: Message, language: string) {
	if (message.selectors.length > 0) return undefined;
	const variants = message.variants.filter((variant) => variant.languageTag === language);
	if (variants.length !== 1) return undefined;
	const { pattern } = variants[0];
	if (pattern.length === 0 || pattern.some((part) => part.type !== "Text")) return undefined;
	return pattern.map((part) => (part.type === "Text" ? part.value : "")).join("");
}

/** The visible text of stored (HTML) text: formatting dropped, whitespace and line breaks collapsed. */
export function visibleText(html: string) {
	return normalizeText(
		htmlToPlainText(
			html
				.replace(/<br\s*\/?>|<\/(p|li|div|h[1-6])>/gi, "\n")
				.replace(/<[^>]*>/g, "")
				.replace(/&quot;/g, '"')
				.replace(/&#39;/g, "'"),
		),
	);
}

/** The visible text of a message in a language - undefined for variables, plurals or no text. */
export function messageText(message: Message, language: string) {
	const html = messageHtml(message, language);
	if (html === undefined) return undefined;
	const text = visibleText(html);
	return text === "" ? undefined : text;
}

/**
 * Text without formatting, line breaks or repeated spaces (e.g. imported from a JSON file). A layer
 * with the same words but line breaks or bold adds to it - it loses nothing when the layer's text
 * replaces it.
 */
export function isFlatText(html: string) {
	return !/[<\r\n\u2028\u2029]/.test(html) && normalizeText(html) === html;
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

export type LinkRequest = {
	nodeId: string;
	messageName: string;
	/** the language the layer is linked in (the language of its frame) */
	language: string;
	/** the layer text as stored in a message (HTML: line breaks, bold, lists, ...) */
	layerHtml: string;
	/** the characters of the layer */
	characters: string;
};

export type LinkPlan = {
	nodeId: string;
	messageName: string;
	/**
	 * The layer already shows the message's text (exactly, or with other line breaks / formatting): it
	 * is linked as it is. Only a layer linked to a different text is rewritten with the message's text.
	 */
	keepText: boolean;
	/**
	 * The message's text in the layer's language is replaced by the layer's text: it was flat (e.g.
	 * imported from JSON), no layer uses the message yet and no other layer of this batch shows it
	 * exactly - the layer's line breaks and formatting then survive a language switch.
	 */
	updateMessage: boolean;
};

/**
 * How each layer of a bulk link is linked. Matching is tolerant (whitespace, line breaks and formatting
 * are ignored), but neither the layer nor the message is ever overwritten with a collapsed text:
 * - the layer keeps its text whenever it shows the message's words,
 * - a message is only rewritten with the exact text of a layer, and only if it loses nothing by it
 *   (`isFlatText`) and nothing else shows it yet.
 * @param getMessage the messages that exist before the links are made
 * @param usedMessageIds messages that layers are linked to already
 */
export function planLinks(
	links: readonly LinkRequest[],
	getMessage: (name: string) => Message | undefined,
	usedMessageIds: ReadonlySet<string> = new Set(),
): LinkPlan[] {
	// the text of a message in a language is decided once per batch: by a layer that shows it exactly,
	// by the layer that creates the message, or by the first layer whose text replaces it
	const settled = new Set<string>();
	const settledKey = (name: string, language: string) => `${name}\u0000${language}`;
	for (const link of links) {
		const message = getMessage(link.messageName);
		if (message && messageHtml(message, link.language) === link.layerHtml)
			settled.add(settledKey(link.messageName, link.language));
	}
	// messages created by this batch: the html of the layer that creates them
	const created = new Map<string, string>();
	return links.map((link) => {
		const key = settledKey(link.messageName, link.language);
		const message = getMessage(link.messageName);
		const plan = (keepText: boolean, updateMessage = false): LinkPlan => ({
			nodeId: link.nodeId,
			messageName: link.messageName,
			keepText,
			updateMessage,
		});
		if (!message) {
			const createdHtml = created.get(link.messageName);
			if (createdHtml === undefined) {
				// the message is created from this layer
				created.set(link.messageName, link.layerHtml);
				settled.add(key);
				return plan(true);
			}
			return plan(
				createdHtml === link.layerHtml ||
					visibleText(createdHtml) === normalizeText(link.characters),
			);
		}
		const html = messageHtml(message, link.language);
		if (html === link.layerHtml) return plan(true);
		if (html === undefined || visibleText(html) !== normalizeText(link.characters)) {
			// linked to a message with another text (chosen by the user): the layer shows the message
			return plan(false);
		}
		const updateMessage = isFlatText(html) && !settled.has(key) && !usedMessageIds.has(message.id);
		if (updateMessage) settled.add(key);
		return plan(true, updateMessage);
	});
}

/** Layers of a review that changed before it was confirmed are not linked - said after the result. */
export function skippedNotice(skipped: number) {
	if (skipped === 0) return "";
	return skipped === 1
		? " 1 layer was skipped: it was changed, linked or deleted since the list was made."
		: ` ${skipped} layers were skipped: they were changed, linked or deleted since the list was made.`;
}
