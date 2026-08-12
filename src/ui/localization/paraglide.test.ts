import { describe, expect, it } from "vitest";
import * as m from "../paraglide/messages.js";

describe("Paraglide messages", () => {
	it("uses English as the base locale", () => {
		expect(m.keys__version__reuse_button()).toBe("Reuse");
	});

	it("returns German translations when explicitly requested", () => {
		expect(m.keys__version__reuse_button({}, { locale: "de" })).toBe("Wiederverwenden");
	});

	it("interpolates message parameters", () => {
		expect(m.keys__search_result_hint({ count: 3 })).toBe("3 results");
	});
});
