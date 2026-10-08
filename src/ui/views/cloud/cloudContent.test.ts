import { describe, expect, it } from "vitest";
import { CLOUD_INTEREST_FORM_URL } from "./cloudContent";

describe("CLOUD_INTEREST_FORM_URL", () => {
	it("opens the shared interest form with Parrot pre-selected as the product", () => {
		const url = new URL(CLOUD_INTEREST_FORM_URL);
		expect(url.hostname).toBe("docs.google.com");
		expect(url.searchParams.get("usp")).toBe("pp_url");
		expect(url.searchParams.get("entry.14901479")).toBe("Parrot");
	});
});
