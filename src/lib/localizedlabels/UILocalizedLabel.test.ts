import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("quill", () => ({
	default: { import: () => class FakeDelta {} },
}));
vi.mock("quill/blots/inline", () => ({ default: class FakeInline {} }));

import type { Message } from "../message/LegacyMessage";
import { Locale } from "../message/variants/Locale";
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
	variants: [
		{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Hello" }] },
	],
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
			variants: [
				{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Hallo" }] },
			],
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
