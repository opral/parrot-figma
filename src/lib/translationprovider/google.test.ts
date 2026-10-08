import { afterEach, describe, expect, it, vi } from "vitest";
import GoogleTranslator, { serbianCyrillicToLatin, toGoogleLanguage } from "./google";

function mockGoogleTranslation(translate: (query: string) => string | string[]) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const query = new URL(input.toString()).searchParams.get("q") ?? "";
		const translatedSegments = translate(query);
		const segments = Array.isArray(translatedSegments) ? translatedSegments : [translatedSegments];
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

	it("sends dots inside abbreviations, numbers and URLs to the translator but keeps sentence dots out of the request", async () => {
		const fetchMock = mockGoogleTranslation((query) => query);
		const text = "Costs 3.5 EUR e.g. on 12.05.2026... See www.example.com now.";

		await expect(GoogleTranslator.translate(text, "en", "de")).resolves.toBe(text);
		const queries = fetchMock.mock.calls.map(([url]) =>
			new URL(url.toString()).searchParams.get("q"),
		);
		expect(queries).toEqual(["Costs 3.5 EUR e.g", "on 12.05.2026", "See www.example.com now"]);
	});

	it("does not double a dot that Google adds to an abbreviation before one of our own dots", async () => {
		mockGoogleTranslation((query) =>
			query.replace(/e\.g$/, "par ex.").replace(/EUR$/, "euros.").replace("Pay", "Payez"),
		);

		await expect(
			GoogleTranslator.translate("Pay 5, e.g. now. Done EUR.", "en", "fr"),
		).resolves.toBe("Payez 5, par ex. now. Done euros.");
	});

	it("keeps escaped HTML entities out of the translation request", async () => {
		const fetchMock = mockGoogleTranslation((query) => query.replace("said", "sagte"));

		await expect(
			GoogleTranslator.translate("She said &lt;b&gt;hi&lt;/b&gt; &amp; left", "en", "de"),
		).resolves.toBe("She sagte &lt;b&gt;hi&lt;/b&gt; &amp; left");
		const query = new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("q");
		expect(query).not.toContain("&");
	});

	it("keeps variables like {name} out of the translation request", async () => {
		const fetchMock = mockGoogleTranslation((query) => query.replace("Hello", "Hallo"));

		await expect(
			GoogleTranslator.translate("Hello {name}, you have {{count}} items.", "en", "de"),
		).resolves.toBe("Hallo {name}, you have {{count}} items.");
		const query = new URL(fetchMock.mock.calls[0][0].toString()).searchParams.get("q");
		expect(query).not.toContain("{");
	});

	it("preserves paragraph breaks and repeated whitespace exactly", async () => {
		const text = "First.  Second with  spaces.\r\n\r\nLast.";
		mockGoogleTranslation((query) => query);

		await expect(GoogleTranslator.translate(text, "en", "fr")).resolves.toBe(text);
	});

	it("joins Google's response segments without adding punctuation", async () => {
		mockGoogleTranslation(() => ["Hola", " mundo"]);

		await expect(GoogleTranslator.translate("Hello world", "en", "es")).resolves.toBe("Hola mundo");
	});

	it("does not request a translation for whitespace-only input", async () => {
		const fetchMock = mockGoogleTranslation((query) => query);
		const text = " \n  ";

		await expect(GoogleTranslator.translate(text, "en", "fr")).resolves.toBe(text);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("explains a network failure instead of surfacing the raw fetch error", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => {
				throw new TypeError("Failed to fetch");
			}),
		);

		await expect(GoogleTranslator.translate("Hello", "en", "de")).rejects.toThrow(
			/Could not reach the machine translation service.*internet connection/,
		);
	});

	it.each([
		[429, /limiting requests.*HTTP 429/],
		[400, /does not support translating from en to de/],
		[500, /returned an error \(HTTP 500\)/],
	])(
		"turns HTTP %i into an actionable error instead of a missing translation",
		async (status, message) => {
			vi.stubGlobal(
				"fetch",
				vi.fn(async () => ({ ok: false, status }) as Response),
			);

			await expect(GoogleTranslator.translate("Hello", "en", "de")).rejects.toThrow(message);
		},
	);
});

describe("region and script locales", () => {
	it("maps BCP-47 tags to the language codes Google understands", () => {
		expect(toGoogleLanguage("pt-BR")).toBe("pt");
		expect(toGoogleLanguage("en-GB")).toBe("en");
		expect(toGoogleLanguage("es-419")).toBe("es");
		expect(toGoogleLanguage("zh-Hans")).toBe("zh-CN");
		expect(toGoogleLanguage("zh-Hant")).toBe("zh-TW");
		expect(toGoogleLanguage("zh-HK")).toBe("zh-TW");
		expect(toGoogleLanguage("sr-Latn")).toBe("sr");
		expect(toGoogleLanguage("zh")).toBe("zh");
		expect(toGoogleLanguage("de")).toBe("de");
		expect(toGoogleLanguage("se")).toBe("SV");
	});

	it("sends the mapped codes to Google", async () => {
		const fetchMock = mockGoogleTranslation((query) => `[${query}]`);
		await GoogleTranslator.translate("Hello", "en", "pt-BR");
		await GoogleTranslator.translate("Hello", "en-GB", "zh-Hans");
		const params = fetchMock.mock.calls.map(([url]) => new URL(url.toString()).searchParams);
		expect(params.map((p) => [p.get("sl"), p.get("tl")])).toEqual([
			["en", "pt"],
			["en", "zh-CN"],
		]);
	});

	it("does not call Google when the base language is the same", async () => {
		const fetchMock = mockGoogleTranslation((query) => `[${query}]`);
		expect(await GoogleTranslator.translate("Colour", "en", "en-GB")).toBe("Colour");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("writes Serbian in Latin script for sr-Latn", async () => {
		mockGoogleTranslation(() => "Добро јутро, Њујорк! Џеп");
		expect(await GoogleTranslator.translate("Good morning", "en", "sr-Latn")).toBe(
			"Dobro jutro, Njujork! Džep",
		);
		expect(serbianCyrillicToLatin("љубав ЉУБАВ Љубав")).toBe("ljubav LJUBAV Ljubav");
	});
});
