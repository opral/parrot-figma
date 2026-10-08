import { describe, expect, test, vi } from "vitest";

vi.mock("quill", () => ({
	default: { import: () => class FakeDelta {} },
}));
vi.mock("quill/blots/inline", () => ({ default: class FakeInline {} }));

import { Locale } from "../message/variants/Locale";
import LocalizedLabelManagerUI from "./LocalizedLabelManagerUI";
import type { Message } from "../message/LegacyMessage";

function createManager() {
	const manager = Object.create(LocalizedLabelManagerUI.prototype) as any;
	manager.frameOperations = new Map();
	manager.cachedFrames = {};
	manager.cachedLocalisedLabels = {};
	const localizedLabel = { nodeId: "label-1", rootFrameId: "frame-2" };
	manager.getLocalizedLabelsByFrame = vi.fn(async () => [localizedLabel]);
	manager.setLabelLanguage = vi.fn(async () => {});
	manager.dispatchEvent = vi.fn();
	manager.localizedLabelMangerSandbox = {
		updateFrameProperties: vi.fn(async () => {}),
		commitUndo: vi.fn(async () => {}),
	};
	return { manager, localizedLabel };
}

describe("LocalizedLabelManagerUI.setFrameLanguage", () => {
	test("loads frame labels before updating the frame language", async () => {
		const { manager, localizedLabel } = createManager();

		await manager.setFrameLanguage("frame-2", Locale.DE, {} as any);

		expect(manager.getLocalizedLabelsByFrame).toHaveBeenCalledWith("frame-2");
		expect(manager.setLabelLanguage).toHaveBeenCalledWith(
			localizedLabel,
			Locale.DE,
			{},
			false,
			false,
		);
		expect(manager.localizedLabelMangerSandbox.updateFrameProperties).toHaveBeenCalledWith(
			"frame-2",
			{ language: Locale.DE },
		);
		expect(manager.getLocalizedLabelsByFrame).toHaveBeenCalledTimes(2);
		expect(manager.dispatchEvent).toHaveBeenCalledTimes(1);
		// one language switch is one undo step
		expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
	});

	test("serializes rapid changes so the last selected locale is applied last", async () => {
		const { manager } = createManager();
		let releaseGerman!: () => void;
		const germanTranslation = new Promise<void>((resolve) => {
			releaseGerman = resolve;
		});
		const translatedLabels: Locale[] = [];
		const frameUpdates: Locale[] = [];
		let active = 0;
		let maxActive = 0;

		manager.setLabelLanguage = vi.fn(async (_label: unknown, language: Locale) => {
			active += 1;
			maxActive = Math.max(maxActive, active);
			if (language === Locale.DE) await germanTranslation;
			translatedLabels.push(language);
			active -= 1;
		});
		manager.localizedLabelMangerSandbox.updateFrameProperties = vi.fn(
			async (_frameId: string, properties: { language: Locale }) => {
				frameUpdates.push(properties.language);
			},
		);

		const german = manager.setFrameLanguage("frame-2", Locale.DE, {} as any);
		const english = manager.setFrameLanguage("frame-2", Locale.EN, {} as any);
		await new Promise((resolve) => setTimeout(resolve, 0));
		expect(translatedLabels).toEqual([]);
		releaseGerman();
		await Promise.all([german, english]);

		expect(translatedLabels).toEqual([Locale.DE, Locale.EN]);
		expect(frameUpdates).toEqual([Locale.DE, Locale.EN]);
		expect(maxActive).toBe(1);
	});
});

describe("LocalizedLabelManagerUI link vs. language switch", () => {
	test("a language switch waits for a link that is still being written", async () => {
		const { manager } = createManager();
		const order: string[] = [];
		let releaseLink!: () => void;
		const linkWritten = new Promise<void>((resolve) => {
			releaseLink = resolve;
		});
		const label = { nodeId: "label-1", rootFrameId: "frame-2", rootFrameLanguage: "en" };
		manager.cachedLocalisedLabels["label-1"] = label;
		manager.messageStore = {
			getMessageByName: () => undefined,
			upsertMessage: vi.fn(async (message: Message) => {
				order.push("link: message written");
				await linkWritten;
				return message;
			}),
		};
		manager.updateLabelProperties = vi.fn(async () => {
			order.push("link: label updated");
		});
		manager.setLabelLanguage = vi.fn(async () => {
			order.push("switch: label language");
		});

		const link = manager.linkMessage(label, "new.key", "en");
		const switched = manager.setFrameLanguage("frame-2", Locale.DE, {} as any);
		await new Promise((resolve) => setTimeout(resolve, 10));
		expect(order).toEqual(["link: message written"]);
		releaseLink();
		await Promise.all([link, switched]);

		expect(order).toEqual([
			"link: message written",
			"link: label updated",
			"switch: label language",
		]);
	});

	test("a link that waited for a language switch links the layer in the new frame language", async () => {
		const { manager } = createManager();
		let releaseSwitch!: () => void;
		const switchDone = new Promise<void>((resolve) => {
			releaseSwitch = resolve;
		});
		const staleLabel = {
			nodeId: "label-1",
			rootFrameId: "frame-2",
			rootFrameLanguage: "en",
			currentPatternHTML: "Hello",
			parameterValues: {},
		};
		manager.cachedLocalisedLabels["label-1"] = staleLabel;
		manager.setLabelLanguage = vi.fn(async () => {
			await switchDone;
			// the switch refreshed the cache: the layer now shows German text in a German frame
			manager.cachedLocalisedLabels["label-1"] = {
				...staleLabel,
				rootFrameLanguage: "de",
				currentPatternHTML: "Hallo",
			};
		});
		const upserted: Message[] = [];
		manager.messageStore = {
			getMessageByName: () => undefined,
			upsertMessage: vi.fn(async (message: Message) => {
				upserted.push(message);
				return message;
			}),
		};
		manager.updateLabelProperties = vi.fn(async () => {});

		const switched = manager.setFrameLanguage("frame-2", Locale.DE, {} as any);
		const link = manager.linkMessage(staleLabel, "new.key", "en");
		releaseSwitch();
		await Promise.all([switched, link]);

		expect(upserted[0].variants[0].languageTag).toBe("de");
		expect(manager.updateLabelProperties).toHaveBeenLastCalledWith(
			"label-1",
			expect.objectContaining({ language: "de" }),
		);
	});
});

describe("translation import", () => {
	test("updates only the imported locale and refreshes linked labels", async () => {
		let stored: Message = {
			id: "checkout.title",
			selectors: [],
			variants: [
				{ languageTag: "en", match: [], pattern: [{ type: "Text", value: "Checkout" }] },
				{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Alt" }] },
			],
		};
		const manager = Object.create(LocalizedLabelManagerUI.prototype) as LocalizedLabelManagerUI;
		manager.messageStore = {
			getMessageByName: () => structuredClone(stored),
			getMessage: () => structuredClone(stored),
			upsertMessage: vi.fn(async (message: Message) => {
				stored = message;
			}),
		} as any;
		const linkedLabels = [
			{ nodeId: "in-german", language: "de", rootFrameLanguage: "de" },
			{ nodeId: "in-english", language: "en", rootFrameLanguage: "en" },
		];
		manager.getWithMessages = vi.fn(async () => linkedLabels as any);
		manager.updateToMessageHead = vi.fn(async () => {});
		await manager.import(
			[
				{
					id: stored.id,
					selectors: [],
					variants: [{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Kasse" }] }],
				},
			],
			Locale.DE,
		);
		expect(stored.variants.find((variant) => variant.languageTag === "en")?.pattern).toEqual([
			{ type: "Text", value: "Checkout" },
		]);
		expect(stored.variants.find((variant) => variant.languageTag === "de")?.pattern).toEqual([
			{ type: "Text", value: "Kasse" },
		]);
		// one lookup for all changed messages, and only layers showing the imported language are refreshed
		expect(manager.getWithMessages).toHaveBeenCalledTimes(1);
		expect(manager.getWithMessages).toHaveBeenCalledWith(["checkout.title"]);
		expect(manager.updateToMessageHead).toHaveBeenCalledWith([linkedLabels[0]]);
	});

	test("does not touch any layer when the import changes nothing", async () => {
		const stored: Message = {
			id: "checkout.title",
			selectors: [],
			variants: [{ languageTag: "de", match: [], pattern: [{ type: "Text", value: "Kasse" }] }],
		};
		const manager = Object.create(LocalizedLabelManagerUI.prototype) as LocalizedLabelManagerUI;
		manager.messageStore = {
			getMessage: () => structuredClone(stored),
			upsertMessage: vi.fn(async () => {}),
		} as any;
		manager.getWithMessages = vi.fn(async () => []);
		manager.updateToMessageHead = vi.fn(async () => {});
		await manager.import([structuredClone(stored)], Locale.DE);
		expect(manager.getWithMessages).not.toHaveBeenCalled();
		expect(manager.updateToMessageHead).not.toHaveBeenCalled();
	});

	test("rejects invalid messages before writing any translations", async () => {
		const existing: Message = {
			id: "item",
			selectors: [{ type: "VariableReference", name: "count" }],
			variants: [],
		};
		const manager = Object.create(LocalizedLabelManagerUI.prototype) as LocalizedLabelManagerUI;
		manager.messageStore = { getMessage: () => existing } as any;
		manager.updateMessage = vi.fn();
		await expect(
			manager.import([{ id: "item", selectors: [], variants: [] }], Locale.EN),
		).rejects.toThrow("selectors but no variants");
		expect(manager.updateMessage).not.toHaveBeenCalled();
	});
});

describe("LocalizedLabelManagerUI.commitUndoWhenIdle", () => {
	test("closes one undo step once the edits pause", () => {
		vi.useFakeTimers();
		try {
			const { manager } = createManager();
			// typing: every keystroke is a save
			for (let i = 0; i < 5; i++) {
				manager.commitUndoWhenIdle(800);
				vi.advanceTimersByTime(200);
			}
			expect(manager.localizedLabelMangerSandbox.commitUndo).not.toHaveBeenCalled();
			vi.advanceTimersByTime(800);
			expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
			// the next edit is a new undo step
			manager.commitUndoWhenIdle(800);
			vi.advanceTimersByTime(800);
			expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(2);
		} finally {
			vi.useRealTimers();
		}
	});
});
