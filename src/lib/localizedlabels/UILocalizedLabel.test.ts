import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("quill", () => ({
	default: { import: () => class FakeDelta {} },
}));
vi.mock("quill/blots/inline", () => ({ default: class FakeInline {} }));

import type { Message } from "../message/LegacyMessage";
import { Locale } from "../message/variants/Locale";
import { MessageLinkState } from "./LocalizedLabel";
import { UILocalizedLabel } from "./UILocalizedLabel";

function createLabel(message: Message) {
	let currentMessage = message;
	const manager = {
		messageStore: {
			getRefLanugage: () => "en",
			getMessage: () => currentMessage,
		},
		updateMessage: vi.fn(async (updated: Message) => {
			currentMessage = updated;
		}),
		updateLabelProperties: vi.fn(async () => {}),
	};
	const label = Object.create(UILocalizedLabel.prototype) as UILocalizedLabel;
	Object.assign(label, {
		manager,
		messageId: message.id,
		nodeId: "text-node",
		parameterValues: {},
	});
	return { label, manager };
}

const englishMessage: Message = {
	id: "welcome",
	selectors: [],
	variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hello" }] }],
};

describe("UILocalizedLabel.setLanguageOnLinkedLabel", () => {
	beforeEach(() => vi.restoreAllMocks());

	test("persists the requested locale after creating a new translation", async () => {
		const { label, manager } = createLabel(englishMessage);
		const translator = { translate: vi.fn(async () => "Hallo") } as any;

		await label.setLanguageOnLinkedLabel(Locale.DE, translator, false, false);

		expect(manager.updateLabelProperties).toHaveBeenLastCalledWith("text-node", {
			messageState: { type: "linked", messageId: "welcome", parameterValues: {} },
			language: Locale.DE,
		});
	});

	test("persists the base locale even when the base variant is missing", async () => {
		const messageWithoutBase: Message = {
			...englishMessage,
			variants: [{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] }],
		};
		const { label, manager } = createLabel(messageWithoutBase);
		const translator = { translate: vi.fn() } as any;

		await label.setLanguageOnLinkedLabel(Locale.EN, translator, false, false);

		expect(manager.updateLabelProperties).toHaveBeenCalledWith("text-node", {
			messageState: { type: "linked", messageId: "welcome", parameterValues: {} },
			language: Locale.EN,
		});
		expect(translator.translate).not.toHaveBeenCalled();
	});
});

describe("UILocalizedLabel.setLanguage", () => {
	test("leaves labels with unsupported text styles untouched", async () => {
		const { label, manager } = createLabel(englishMessage);
		Object.assign(label, {
			matchingLabelLints: ["IndentationNotSupported"],
			messageLinkState: MessageLinkState.Unset,
		});
		const translator = { translate: vi.fn() } as any;

		await label.setLanguage(Locale.DE, translator, false, false);

		expect(translator.translate).not.toHaveBeenCalled();
		expect(manager.updateLabelProperties).toHaveBeenCalledTimes(1);
		expect(manager.updateLabelProperties).toHaveBeenCalledWith("text-node", {});
	});
});

describe("UILocalizedLabel unlinked labels that show text of another language", () => {
	const createUnlinked = (rootFrameLanguage: string, characters: string, variants: any[]) =>
		new UILocalizedLabel(
			{
				messageStore: { getRefLanugage: () => "en", getMessage: () => undefined },
				updateMessage: vi.fn(),
				updateLabelProperties: vi.fn(),
			} as any,
			{
				nodeId: "text-node",
				rootFrameLanguage,
				language: rootFrameLanguage,
				characters,
				ops: [{ from: 0, to: characters.length }],
				unlinkedMessage: { id: "____unlinked", selectors: [], variants },
				matchingLabelLints: [],
				parameterValues: {},
			} as any,
		);
	const variant = (languageTag: string, value: string) => ({
		languageTag,
		match: [],
		pattern: [{ type: "Text", value }],
	});

	beforeEach(() => {
		vi.spyOn(UILocalizedLabel, "toHtml").mockImplementation((text: string) => text);
	});

	test("does not store the only existing text as the translation of the frame language", () => {
		// unlinked text of a German frame, frame switched to Spanish without a source text to translate from
		const label = createUnlinked("es", "Hallo Welt", [variant("de", "Hallo Welt")]);
		expect(label.unlinkedMessage.variants.map((v) => v.languageTag)).toEqual(["de"]);
	});

	test("stores an edit of the text as the translation of the frame language", () => {
		const label = createUnlinked("es", "Hola mundo", [variant("de", "Hallo Welt")]);
		expect(label.unlinkedMessage.variants.map((v) => v.languageTag).sort()).toEqual(["de", "es"]);
	});
});

describe("UILocalizedLabel.setLanguageOnUnsetLabel", () => {
	test("writes the label once when the translation is unavailable and keeps the text untranslated", async () => {
		const { label, manager } = createLabel(englishMessage);
		Object.assign(label, { language: "en", currentPatternHTML: "Hello" });
		const error = new Error("Machine translation is available on request");
		const translator = {
			translate: vi.fn(async () => {
				throw error;
			}),
		} as any;

		await expect(label.setLanguageOnUnsetLabel(Locale.DE, translator, false)).rejects.toBe(error);

		expect(manager.updateLabelProperties).toHaveBeenCalledTimes(1);
		const [, changes] = (manager.updateLabelProperties as any).mock.calls[0];
		expect(changes.language).toBe(Locale.DE);
		expect(changes.messageState.type).toBe("unlinked");
		// no German variant: the English text must not be stored as the German translation
		expect(changes.messageState.unlinkedMessage.variants.map((v: any) => v.languageTag)).toEqual([
			"en",
		]);
	});

	test("writes the label once with the translation when it succeeds", async () => {
		const { label, manager } = createLabel(englishMessage);
		Object.assign(label, { language: "en", currentPatternHTML: "Hello" });
		const translator = { translate: vi.fn(async () => "Hallo") } as any;

		await label.setLanguageOnUnsetLabel(Locale.DE, translator, false);

		expect(manager.updateLabelProperties).toHaveBeenCalledTimes(1);
		const [, changes] = (manager.updateLabelProperties as any).mock.calls[0];
		expect(
			changes.messageState.unlinkedMessage.variants.map((v: any) => v.languageTag).sort(),
		).toEqual(["de", "en"]);
	});
});

describe("UILocalizedLabel linked to a plural message", () => {
	const count = { type: "VariableReference" as const, name: "count" };
	const form = (languageTag: string, match: string, value: string) => ({
		languageTag,
		match: [match],
		pattern: [count, { type: "Text" as const, value }],
	});
	// "other" is a literal match, as the Inlang message format and i18next files import it
	const items: Message = {
		id: "checkout.items",
		selectors: [{ type: "VariableReference", name: "count" }],
		variants: [
			form("en", "one", " item"),
			form("en", "other", " items"),
			form("de", "one", " Artikel"),
			form("de", "other", " Artikel"),
		],
	};
	const countOf = (value: string) => ({ count: { type: "string" as const, value } });

	test("is not modified while it shows the form its count chooses", () => {
		const { label } = createLabel(items);
		Object.assign(label, {
			messageLinkState: MessageLinkState.Linked,
			language: "en",
			parameterValues: countOf("1"),
			currentPatternHTML: "<ph>count</ph> item",
		});
		expect(label.getState().modified).toBe(false);
		label.currentPatternHTML = "<ph>count</ph> items";
		expect(label.getState().modified).toBe(true);
		// without a stored count the layer shows the catch-all form
		Object.assign(label, { parameterValues: {}, currentPatternHTML: "<ph>count</ph> items" });
		expect(label.getState().modified).toBe(false);
	});

	test("switches the language without asking for a translation that exists", async () => {
		const { label, manager } = createLabel(items);
		Object.assign(label, {
			messageLinkState: MessageLinkState.Linked,
			language: "en",
			parameterValues: countOf("1"),
		});
		const translator = { translate: vi.fn() } as any;

		await label.setLanguageOnLinkedLabel(Locale.DE, translator, false, false);

		expect(translator.translate).not.toHaveBeenCalled();
		expect(manager.updateMessage).not.toHaveBeenCalled();
		expect(manager.updateLabelProperties).toHaveBeenCalledTimes(1);
		expect(manager.updateLabelProperties).toHaveBeenCalledWith("text-node", {
			messageState: {
				type: "linked",
				messageId: "checkout.items",
				parameterValues: countOf("1"),
			},
			language: Locale.DE,
		});
	});

	test("asks for the translation of the form the layer shows, not of a form without selectors", async () => {
		const english: Message = { ...items, variants: items.variants.slice(0, 2) };
		const { label, manager } = createLabel(english);
		Object.assign(label, {
			messageLinkState: MessageLinkState.Linked,
			language: "en",
			parameterValues: countOf("1"),
		});
		const translator = { translate: vi.fn(async () => "<ph>count</ph> Artikel") } as any;

		await label.setLanguageOnLinkedLabel(Locale.DE, translator, false, false);

		expect(translator.translate).toHaveBeenCalledWith(
			"<ph>count</ph> item",
			"en",
			Locale.DE,
			false,
		);
		const [written] = (manager.updateMessage as any).mock.calls[0] as [Message];
		expect(written.variants.map((variant) => [variant.languageTag, variant.match])).toEqual([
			["en", ["one"]],
			["en", ["other"]],
			["de", ["one"]],
		]);
	});
});
