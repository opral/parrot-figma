import { describe, expect, it } from "vitest";
import { hasMessageWithText, suggestMessageKey } from "./KeySuggestion";

const suggest = (
	frameName: string | undefined,
	layerName: string,
	characters: string,
	keys: string[] = [],
) => suggestMessageKey({ frameName, layerName, characters, existingKeys: new Set(keys) });

describe("suggestMessageKey", () => {
	it("uses the text of an auto-named layer and the frame name", () => {
		expect(suggest("Login Screen", "Sign in", "Sign in")).toBe("login_screen.sign_in");
	});

	it("uses a deliberate layer name instead of the text", () => {
		expect(suggest("Login Screen", "CTA label", "Continue with Google")).toBe(
			"login_screen.cta_label",
		);
	});

	it("leaves out default frame names and default layer names", () => {
		expect(suggest("Frame 12", "Text", "Welcome back, friend of the parrot!")).toBe(
			"welcome_back_friend_of",
		);
	});

	it("treats a layer named after the start of a long text as auto-named", () => {
		expect(suggest("Home", "We ship worldwide", "We ship worldwide in 3 days")).toBe(
			"home.we_ship_worldwide_in",
		);
	});

	it("removes accents and punctuation", () => {
		expect(suggest("Präferenzen", "Größe ändern…", "Größe ändern…")).toBe(
			"praferenzen.grosse_andern",
		);
	});

	it("falls back to text when nothing latin is left", () => {
		expect(suggest("Frame 1", "登录", "登录")).toBe("text");
	});

	it("never suggests an existing key", () => {
		expect(suggest("Home", "Title", "Hi", ["home.title", "home.title_2"])).toBe("home.title_3");
	});
});

describe("hasMessageWithText", () => {
	const message = (...texts: string[]) => ({
		variants: texts.map((value) => ({ pattern: [{ type: "Text", value }] })),
	});

	it("finds an identical text in any language", () => {
		expect(hasMessageWithText([message("Cancel", "Abbrechen")], "Abbrechen")).toBe(true);
		expect(hasMessageWithText([message("Cancel")], " Cancel ")).toBe(true);
	});

	it("does not match a text that only contains the layer text", () => {
		expect(hasMessageWithText([message("Cancel subscription")], "Cancel")).toBe(false);
	});

	it("does not match messages with variables", () => {
		const withVariable = {
			variants: [
				{
					pattern: [
						{ type: "Text", value: "Hi " },
						{ type: "VariableReference", value: undefined },
					],
				},
			],
		};
		expect(hasMessageWithText([withVariable], "Hi")).toBe(false);
	});
});
