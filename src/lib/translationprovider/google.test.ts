import { afterEach, describe, expect, it, vi } from "vitest";
import GoogleTranslator from "./google";

function mockGoogleTranslation(
	translate: (query: string) => string | string[],
) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const query = new URL(input.toString()).searchParams.get("q") ?? "";
		const translatedSegments = translate(query);
		const segments = Array.isArray(translatedSegments)
			? translatedSegments
			: [translatedSegments];
		return {
			ok: true,
			status: 200,
			json: async () => [segments.map((segment) => [segment])],
		} as Response;
	});

	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe("GoogleTranslator", () => {
	it("keeps Figma placeholders and structural punctuation out of the translation text", async () => {
		const fetchMock = mockGoogleTranslation((query) =>
			query.replace("Hello", "Hola").replace("World", "Mundo").replace("See", "Ver"),
		);

		const translated = await GoogleTranslator.translate(
			'Hello. World <ph arg="1">name</ph>\n\nSee #tag.',
			"en",
			"es",
		);

		expect(translated).toBe('Hola. Mundo <ph arg="1">name</ph>\n\nVer #tag.');
		const queries = fetchMock.mock.calls.map(([url]) =>
			new URL(url.toString()).searchParams.get("q"),
		);
		expect(queries.some((query) => query?.includes("<ph"))).toBe(false);
		expect(queries.join(" ")).not.toContain("{{dot}}");
		expect(queries.join(" ")).not.toContain("{{newline}}");
		expect(queries.join(" ")).not.toContain("#");
	});

	it("preserves paragraph breaks and repeated whitespace exactly", async () => {
		const text = "First.  Second with  spaces.\r\n\r\nLast.";
		mockGoogleTranslation((query) => query);

		await expect(GoogleTranslator.translate(text, "en", "fr")).resolves.toBe(text);
	});

	it("joins Google's response segments without adding punctuation", async () => {
		mockGoogleTranslation(() => ["Hola", " mundo"]);

		await expect(GoogleTranslator.translate("Hello world", "en", "es")).resolves.toBe(
			"Hola mundo",
		);
	});

	it("does not request a translation for whitespace-only input", async () => {
		const fetchMock = mockGoogleTranslation((query) => query);
		const text = " \n  ";

		await expect(GoogleTranslator.translate(text, "en", "fr")).resolves.toBe(text);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});
