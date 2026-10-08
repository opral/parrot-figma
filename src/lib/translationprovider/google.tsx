// use polyfill in sandbox https://forum.figma.com/t/sandbox-not-support-urlsearchparams/41676
import URLSearchParams from "@ungap/url-search-params";
import Monitoring from "../monitoring/MonitoringProxy";

const placeholderPattern = /<ph\b[^>]*>[\s\S]*?<\/ph>/gi;
const lineBreakPattern = /(\r\n|\r|\n)/g;
const sentenceBreakPattern = /(\. )/g;

type TranslationResponse = [string[][]] | undefined;

export default class GoogleTranslator {
	static async translate(text: string, sourceLanguage: string, targetLanguage: string) {
		if (/^\s*$/.test(text)) {
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
				// These characters are structural in Parrot content and should survive translation.
				.replace(/[.#]/g, (match) => createToken(match))
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

				const translated = await this.translateChunk(
					protect(content),
					sourceLanguage,
					targetLanguage,
				);
				if (translated === null) {
					return null;
				}

				translatedParts.push(leadingWhitespace, translated, trailingWhitespace);
			}
		}

		let translatedText = translatedParts.join("");
		for (const [token, originalValue] of replacements) {
			translatedText = translatedText.split(token).join(originalValue);
		}
		return translatedText;
	}

	private static async translateChunk(
		text: string,
		sourceLanguage: string,
		targetLanguage: string,
	): Promise<string | null> {
		if (!text) {
			return text;
		}

		const result = await fetch(
			`https://translate.googleapis.com/translate_a/single?${new URLSearchParams({
				client: "gtx",
				dt: "t",
			sl: sourceLanguage === "se" ? "SV" : sourceLanguage,
				tl: targetLanguage === "se" ? "SV" : targetLanguage,
				q: text,
			})}`,
			{ method: "GET" },
		);

		if (!result.ok) {
			Monitoring.instance?.sentryCaptureMesage(
				`Translation of ${text} failed. Status code (${result.status}).`,
			);
			return null;
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
			return null;
		}

		// Google may split one translated sentence into several response segments. Concatenate them
		// directly; adding punctuation between segments changes the user's text.
		return translatedSegments.join("");
	}
}
