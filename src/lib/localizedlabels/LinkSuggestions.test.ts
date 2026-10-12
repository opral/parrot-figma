import { describe, expect, it } from "vitest";
import {
	buildMessageTextIndex,
	findKeyConflicts,
	isValidMessageKey,
	isFlatText,
	matchLayersToMessages,
	messageText,
	planLinks,
	proposeKeys,
	type LayerText,
} from "./LinkSuggestions";

const text = (value: string) => [{ type: "Text" as const, value }];
const message = (id: string, variants: Record<string, any[]>, selectors: any[] = []) => ({
	id,
	selectors,
	variants: Object.entries(variants).map(([languageTag, pattern]) => ({
		languageTag,
		match: [],
		pattern,
	})),
});
const layer = (
	nodeId: string,
	characters: string,
	overrides: Partial<LayerText> = {},
): LayerText => ({
	nodeId,
	characters,
	language: "en",
	layerName: characters,
	frameName: "Login",
	...overrides,
});

const messages = [
	message("login.sign_in", { en: text("Sign in"), de: text("Anmelden") }),
	message("dialog.ok", { en: text("OK") }),
	message("button.ok", { en: text("OK") }),
	message("intro", { en: text("Fast &amp; <strong>simple</strong>") }),
	message("list", { en: text("<ul><li>One</li><li>Two</li></ul>") }),
	message("greeting", {
		en: [
			{ type: "Text", value: "Hi " },
			{ type: "VariableReference", name: "name" },
		],
	}),
];
const index = buildMessageTextIndex(messages, ["en", "de"]);

describe("messageText", () => {
	it("ignores formatting, entities and line breaks", () => {
		expect(messageText(messages[3], "en")).toBe("Fast & simple");
		expect(messageText(messages[4], "en")).toBe("One Two");
	});

	it("has no text for variables or plurals", () => {
		expect(messageText(messages[5], "en")).toBeUndefined();
		expect(
			messageText(
				message("p", { en: text("x") }, [{ type: "VariableReference", name: "n" }]),
				"en",
			),
		).toBeUndefined();
	});
});

describe("matchLayersToMessages", () => {
	it("matches by the text in the layer's language, whitespace-insensitive", () => {
		const matches = matchLayersToMessages(
			[
				layer("1", " Sign  in "),
				layer("2", "Anmelden", { language: "de" }),
				layer("3", "One\nTwo"),
				layer("4", "Nope"),
			],
			index,
		);
		expect(matches.map((m) => [m.layer.nodeId, m.messageIds])).toEqual([
			["1", ["login.sign_in"]],
			["2", ["login.sign_in"]],
			["3", ["list"]],
		]);
	});

	it("reports every message of an ambiguous text", () => {
		expect(matchLayersToMessages([layer("1", "OK")], index)[0].messageIds).toEqual([
			"dialog.ok",
			"button.ok",
		]);
	});

	it("can be limited to some messages", () => {
		expect(
			matchLayersToMessages([layer("1", "OK")], index, new Set(["button.ok"]))[0].messageIds,
		).toEqual(["button.ok"]);
		expect(matchLayersToMessages([layer("1", "Sign in")], index, new Set(["button.ok"]))).toEqual(
			[],
		);
	});
});

describe("proposeKeys", () => {
	it("reuses existing messages, shares keys for equal texts and never collides", () => {
		const proposals = proposeKeys(
			[
				layer("1", "Sign in"),
				layer("2", "Forgot password?"),
				layer("3", "Forgot password?"),
				layer("4", "Title", { layerName: "Title", frameName: "Dialog" }),
			],
			[...messages, message("dialog.title", { en: text("Other") })],
			index,
		);
		expect(proposals.map((p) => [p.layer.nodeId, p.key, p.existing])).toEqual([
			["1", "login.sign_in", true],
			["2", "login.forgot_password", false],
			["3", "login.forgot_password", false],
			["4", "dialog.title_2", false],
		]);
	});
});

describe("isValidMessageKey", () => {
	it("accepts dotted keys and rejects spaces or trailing separators", () => {
		expect(isValidMessageKey("login.sign_in")).toBe(true);
		expect(isValidMessageKey("login.")).toBe(false);
		expect(isValidMessageKey("sign in")).toBe(false);
		expect(isValidMessageKey("")).toBe(false);
	});
});

describe("findKeyConflicts", () => {
	it("flags a key that is used for a different text, not for the same text", () => {
		expect(
			findKeyConflicts([
				{ key: "a", characters: "Pay now" },
				{ key: "a", characters: "Pay  now " },
				{ key: "a", characters: "Cancel" },
				{ key: "b", characters: "Cancel" },
			]),
		).toEqual([false, false, true, false]);
	});
});

describe("planLinks", () => {
	const request = (
		nodeId: string,
		messageName: string,
		layerHtml: string,
		characters = layerHtml,
	) => ({
		nodeId,
		messageName,
		language: "en",
		layerHtml,
		characters,
	});
	const byName = (list: ReturnType<typeof message>[]) => (name: string) =>
		list.find((m) => m.id === name) as any;

	it("keeps the layer's line breaks and bold and puts them into a flat message", () => {
		const plans = planLinks(
			[
				request("1", "welcome", "Welcome\nback"),
				request("2", "pay", "Pay <strong>now</strong>", "Pay now"),
			],
			byName([
				message("welcome", { en: text("Welcome back") }),
				message("pay", { en: text("Pay now") }),
			]),
		);
		expect(plans.map((p) => [p.nodeId, p.keepText, p.updateMessage])).toEqual([
			["1", true, true],
			["2", true, true],
		]);
	});

	it("does not rewrite a message that has formatting of its own, is used, or is shown exactly", () => {
		const plans = planLinks(
			[
				request("1", "welcome", "Welcome back"),
				request("2", "used", "Used\ntext"),
				request("3", "hello", "Hello\nworld"),
				request("4", "hello", "Hello world"),
			],
			byName([
				message("welcome", { en: text("Welcome<br>back") }),
				message("used", { en: text("Used text") }),
				message("hello", { en: text("Hello world") }),
			]),
			new Set(["used"]),
		);
		expect(plans.map((p) => [p.nodeId, p.keepText, p.updateMessage])).toEqual([
			["1", true, false],
			["2", true, false],
			["3", true, false],
			["4", true, false],
		]);
	});

	it("rewrites a message once per batch and only from the first layer", () => {
		const plans = planLinks(
			[
				request("1", "hello", "Hello\nworld"),
				request("2", "hello", "Hello <em>world</em>", "Hello world"),
			],
			byName([message("hello", { en: text("Hello world") })]),
		);
		expect(plans.map((p) => p.updateMessage)).toEqual([true, false]);
		expect(plans.every((p) => p.keepText)).toBe(true);
	});

	it("keeps layers that create a message or share the one created", () => {
		const plans = planLinks(
			[request("1", "new.key", "New"), request("2", "new.key", "New\n")],
			() => undefined,
		);
		expect(plans.map((p) => [p.keepText, p.updateMessage])).toEqual([
			[true, false],
			[true, false],
		]);
	});

	it("shows the message's text on a layer linked to a message with other words", () => {
		const [plan] = planLinks(
			[request("1", "title", "Sign in")],
			byName([message("title", { en: text("Welcome") })]),
		);
		expect(plan.keepText).toBe(false);
	});
});

describe("isFlatText", () => {
	it("is text without markup, line breaks or repeated spaces", () => {
		expect(isFlatText("Tom &amp; Jerry")).toBe(true);
		expect(isFlatText("Two\nlines")).toBe(false);
		expect(isFlatText("Two  spaces")).toBe(false);
		expect(isFlatText("<strong>Bold</strong>")).toBe(false);
	});
});
