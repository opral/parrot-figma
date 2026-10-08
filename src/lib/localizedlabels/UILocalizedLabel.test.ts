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
