// use polyfill in sandbox https://forum.figma.com/t/sandbox-not-support-urlsearchparams/41676
import URLSearchParams from "@ungap/url-search-params";
import Monitoring from "../monitoring/MonitoringProxy";

const placeholderPattern = /<ph\b[^>]*>[\s\S]*?<\/ph>/gi;
const variablePattern = /\{\{[^{}]*\}\}|\{[^{}]*\}/g;
const entityPattern = /&(?:[a-z][a-z0-9]*|#\d+|#x[0-9a-f]+);/gi;
const lineBreakPattern = /(\r\n|\r|\n)/g;
const sentenceBreakPattern = /(\. )/g;

type TranslationResponse = [string[][]] | undefined;

// Google knows plain language codes plus a few region / script variants. Everything else ("pt-BR", "en-GB",
// "es-419", "sr-Latn" ...) is translated as its base language.
const googleLanguageCodes: Record<string, string> = {
	se: "SV",
	"zh-hans": "zh-CN",
	"zh-cn": "zh-CN",
	"zh-sg": "zh-CN",
	"zh-hant": "zh-TW",
	"zh-tw": "zh-TW",
	"zh-hk": "zh-TW",
	"zh-mo": "zh-TW",
};

/** The language code Google Translate expects for a BCP-47 tag used in Parrot ("pt-BR" -> "pt", "zh-Hans" -> "zh-CN"). */
export function toGoogleLanguage(tag: string): string {
	const known = googleLanguageCodes[tag.toLowerCase()];
	if (known) return known;
	const base = tag.split("-")[0];
	return base === "se" ? "SV" : base;
}

const serbianLatin: Record<string, string> = {
	А: "A",
	Б: "B",
	В: "V",
	Г: "G",
	Д: "D",
	Ђ: "Đ",
	Е: "E",
	Ж: "Ž",
	З: "Z",
	И: "I",
	Ј: "J",
	К: "K",
	Л: "L",
	Љ: "Lj",
	М: "M",
	Н: "N",
	Њ: "Nj",
	О: "O",
	П: "P",
	Р: "R",
	С: "S",
	Т: "T",
	Ћ: "Ć",
	У: "U",
	Ф: "F",
	Х: "H",
	Ц: "C",
	Ч: "Č",
	Џ: "Dž",
	Ш: "Š",
};

/** Google only returns Serbian in Cyrillic - "sr-Latn" needs the (lossless) Latin alphabet. */
export function serbianCyrillicToLatin(text: string) {
	return text.replace(/[\u0400-\u04FF]/g, (letter, offset: number) => {
		const latin = serbianLatin[letter.toUpperCase()];
		if (latin === undefined) return letter;
		if (letter !== letter.toUpperCase()) return latin.toLowerCase();
		// "Љ" is "Lj" in "Љубав" but "LJ" in "ЉУБАВ"
		const next = text[offset + 1];
		return latin.length > 1 && next !== undefined && next !== next.toLowerCase()
			? latin.toUpperCase()
			: latin;
	});
}

/** Machine translation failed in a way the user can act on - the message is shown as is. */
export class TranslationServiceError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "TranslationServiceError";
	}
}

export default class GoogleTranslator {
	static async translate(text: string, sourceLanguage: string, targetLanguage: string) {
		if (/^\s*$/.test(text)) {
			return text;
		}

		// "en" -> "en-GB": nothing to translate (Google has no regional variants of its own)
		if (toGoogleLanguage(sourceLanguage) === toGoogleLanguage(targetLanguage)) {
			return text;
		}

		const replacements = new Map<string, string>();
		let tokenIndex = 0;
		const createToken = (value: string) => {
			let token: string;
			do {
				token = `[[${tokenIndex++}]]`;
			} while (text.includes(token) || replacements.has(token));
			replacements.set(token, value);
			return token;
		};

		const protect = (value: string) =>
			value
				// Keep Figma's inline placeholders intact, including their original attributes.
				.replace(placeholderPattern, (match) => createToken(match))
				// Variables such as {name} or {{count}} must not be translated ("{name}" -> "{Name}").
				.replace(variablePattern, (match) => createToken(match))
				// HTML entities (&lt; &amp; ...) are escaped text of the design: Google decodes them, so a
				// literal "<b>" in a text came back as real markup and turned part of it bold.
				.replace(entityPattern, (match) => createToken(match))
				// "#" is structural in Parrot content and should survive translation. Dots stay in the text:
				// Google adds its own dots when it translates e.g. "e.g." or "12.05." and moves protected
				// tokens around, which doubled or displaced them ("z.B..g.", "am {Datum}. versendet").
				.replace(/#/g, (match) => createToken(match))
				// Preserve intentional spacing such as indentation or multiple spaces.
				.replace(/[ \t]{2,}/g, (match) => createToken(match));

		const translatedParts: string[] = [];
		// Translate one line at a time so paragraph and line breaks remain exactly where they were.
		const lines = text.split(lineBreakPattern);
		for (const line of lines) {
			if (/^(\r\n|\r|\n)$/.test(line)) {
				translatedParts.push(line);
				continue;
			}

			// Keep sentence separators out of the translation request. Besides preserving punctuation,
			// this gives the translator sentence context without sending our own marker words to Google.
			const sentences = line.split(sentenceBreakPattern);
			for (let i = 0; i < sentences.length; i += 1) {
				const sentenceOrSeparator = sentences[i];
				if (i % 2 === 1) {
					translatedParts.push(sentenceOrSeparator);
					continue;
				}

				if (!sentenceOrSeparator.trim()) {
					translatedParts.push(sentenceOrSeparator);
					continue;
				}

				const leadingWhitespace = sentenceOrSeparator.match(/^[ \t]*/)?.[0] ?? "";
				const contentAfterLeadingWhitespace = sentenceOrSeparator.slice(leadingWhitespace.length);
				const trailingWhitespace = contentAfterLeadingWhitespace.match(/[ \t]*$/)?.[0] ?? "";
				const content = contentAfterLeadingWhitespace.slice(
					0,
					contentAfterLeadingWhitespace.length - trailingWhitespace.length,
				);

				if (!content) {
					translatedParts.push(sentenceOrSeparator);
					continue;
				}

				// Keep the end of sentence punctuation out of the request and re-attach it at the same
				// place - translators may otherwise move or drop it.
				const trailingDots = content.match(/\.+$/)?.[0] ?? "";
				const sentence = content.slice(0, content.length - trailingDots.length);
				if (!sentence) {
					translatedParts.push(sentenceOrSeparator);
					continue;
				}

				let translated = await this.translateChunk(
					protect(sentence),
					sourceLanguage,
					targetLanguage,
				);
				// Google ends a request with its own dot when the text ends in an abbreviation ("e.g" ->
				// "z.B.", "EUR" -> "евро."). The original dot is added back below - don't write it twice.
				const dotFollows = trailingDots !== "" || i + 1 < sentences.length;
				if (dotFollows) {
					translated = translated.replace(/\.+$/, "");
				}

				translatedParts.push(leadingWhitespace, translated, trailingDots, trailingWhitespace);
			}
		}

		let translatedText = translatedParts.join("");
		if (/^sr-Latn/i.test(targetLanguage)) translatedText = serbianCyrillicToLatin(translatedText);
		for (const [token, originalValue] of replacements) {
			translatedText = translatedText.split(token).join(originalValue);
		}
		return translatedText;
	}

	private static async translateChunk(
		text: string,
		sourceLanguage: string,
		targetLanguage: string,
	): Promise<string> {
		if (!text) {
			return text;
		}

		let result: Response;
		try {
			result = await fetch(
				`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({
					client: "gtx",
					dt: "t",
					sl: toGoogleLanguage(sourceLanguage),
					tl: toGoogleLanguage(targetLanguage),
					q: text,
				})}`,
				{ method: "GET" },
			);
		} catch {
			// fetch only rejects when no response arrived ("Failed to fetch") - offline, VPN, firewall, ...
			throw new TranslationServiceError(
				"Could not reach the machine translation service (translate.googleapis.com). Check your internet connection or firewall and try again.",
			);
		}

		if (!result.ok) {
			Monitoring.instance?.sentryCaptureMesage(
				`Translation of ${text} failed. Status code (${result.status}).`,
			);
			if (result.status === 429 || result.status === 403) {
				throw new TranslationServiceError(
					`The machine translation service is limiting requests right now (HTTP ${result.status}). Wait a few minutes and try again.`,
				);
			}
			if (result.status === 400) {
				throw new TranslationServiceError(
					`Machine translation does not support translating from ${sourceLanguage} to ${targetLanguage}. Enter the translation manually or import it.`,
				);
			}
			throw new TranslationServiceError(
				`The machine translation service returned an error (HTTP ${result.status}). Try again later.`,
			);
		}

		const translationResults = (await result.json()) as TranslationResponse;
		const translatedSegments = translationResults?.[0]
			?.map((segment) => segment?.[0])
			.filter((segment): segment is string => typeof segment === "string");

		if (!translatedSegments?.length) {
			const error = new Error("Expected a translation within [0][0][0] not found");
			Monitoring.instance?.sentryCaptureException(error, {
				extra: {
					sourceLanguage,
					targetLanguage,
					text,
					translationResults,
				},
			});
			throw new TranslationServiceError(
				`The machine translation service did not return a translation from ${sourceLanguage} to ${targetLanguage}.`,
			);
		}

		// Google may split one translated sentence into several response segments. Concatenate them
		// directly; adding punctuation between segments changes the user's text.
		return translatedSegments.join("");
	}
}
