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
	manager.frameLanguageUpdates = new Map();
	manager.cachedFrames = {};
	manager.cachedLocalisedLabels = {};
	const localizedLabel = { nodeId: "label-1", rootFrameId: "frame-2" };
	manager.getLocalizedLabelsByFrame = vi.fn(async () => [localizedLabel]);
	manager.setLabelLanguage = vi.fn(async () => {});
	manager.dispatchEvent = vi.fn();
	manager.localizedLabelMangerSandbox = {
		updateFrameProperties: vi.fn(async () => {}),
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
		manager.updateUnpinnedLabelsWithMessage = vi.fn(async () => {});
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
		expect(manager.updateUnpinnedLabelsWithMessage).toHaveBeenCalledWith("checkout.title");
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
