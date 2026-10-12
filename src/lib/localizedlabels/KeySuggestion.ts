/**
 * Suggests a message key for a text layer: `<frame>.<layer>`, e.g. `login_screen.sign_in`.
 *
 * Figma names text layers after their text and containers "Frame 12" by default - such names say
 * nothing, so an auto-named layer contributes its text and a default-named frame is left out.
 */

const defaultLayerName =
	/^(frame|group|section|component|instance|rectangle|ellipse|text|vector|line|polygon|star|image|container|auto layout|layer)(\s+\d+)?$/i;

// letters that do not decompose into a latin letter + accent
const transliterations: { [letter: string]: string } = {
	ß: "ss",
	æ: "ae",
	œ: "oe",
	ø: "o",
	ł: "l",
	đ: "d",
	þ: "th",
};

function words(value: string) {
	return value
		.toLowerCase()
		.replace(/[ßæœøłđþ]/g, (letter) => transliterations[letter])
		.normalize("NFKD")
		.replace(/[̀-ͯ]/g, "")
		.replace(/[^a-z0-9]+/g, " ")
		.trim()
		.split(" ")
		.filter((word) => word !== "");
}

function slug(value: string, maxWords: number) {
	return words(value).slice(0, maxWords).join("_");
}

function isMeaningless(name: string) {
	const trimmed = name.trim();
	return trimmed === "" || defaultLayerName.test(trimmed) || /^\d+$/.test(trimmed);
}

function isNamedAfterText(layerName: string, characters: string) {
	const name = words(layerName).join(" ");
	const text = words(characters).join(" ");
	return name !== "" && text.startsWith(name);
}

export function suggestMessageKey({
	frameName,
	layerName,
	characters,
	existingKeys,
}: {
	frameName: string | undefined;
	layerName: string;
	characters: string;
	existingKeys: Set<string>;
}) {
	const layerPart =
		(isMeaningless(layerName) || isNamedAfterText(layerName, characters)
			? slug(characters, 4)
			: slug(layerName, 4)) || "text";
	const framePart = frameName && !isMeaningless(frameName) ? slug(frameName, 3) : "";

	const key = framePart ? `${framePart}.${layerPart}` : layerPart;
	if (!existingKeys.has(key)) return key;

	let suffix = 2;
	while (existingKeys.has(`${key}_${suffix}`)) suffix += 1;
	return `${key}_${suffix}`;
}

type MessageWithPatterns = {
	variants: { pattern: readonly { type: string; value?: string }[] }[];
};

/**
 * True if a message has exactly this text (in any language). The message search finds substrings
 * ("Cancel" is in "Cancel subscription") - only an identical text is a reason to link instead of
 * creating a new key.
 */
export function hasMessageWithText(messages: readonly MessageWithPatterns[], characters: string) {
	const wanted = characters.trim();
	return messages.some((message) =>
		message.variants.some(
			(variant) =>
				variant.pattern.every((part) => part.type === "Text") &&
				variant.pattern
					.map((part) => part.value ?? "")
					.join("")
					.trim() === wanted,
		),
	);
}
