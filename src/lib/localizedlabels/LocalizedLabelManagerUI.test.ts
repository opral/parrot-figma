import { describe, expect, test, vi } from "vitest";

vi.mock("quill", () => ({
	default: { import: () => class FakeDelta {} },
}));
vi.mock("quill/blots/inline", () => ({ default: class FakeInline {} }));

import { Locale } from "../message/variants/Locale";
import LocalizedLabelManagerUI from "./LocalizedLabelManagerUI";
import type { Message } from "../message/LegacyMessage";
import { MessageLinkState } from "./LocalizedLabel";
import { UILocalizedLabel } from "./UILocalizedLabel";

function createManager() {
	const manager = Object.create(LocalizedLabelManagerUI.prototype) as any;
	manager.frameOperations = new Map();
	manager.undoStepDepth = 0;
	manager.undoSteps = Promise.resolve();
	manager.pendingUndoSteps = 0;
	manager.idleCommitHolds = 0;
	manager.linksLoaded = true;
	manager.cachedFrames = {};
	manager.cachedLocalisedLabels = {};
	const localizedLabel = { nodeId: "label-1", rootFrameId: "frame-2" };
	manager.getLocalizedLabelsByFrame = vi.fn(async () => [localizedLabel]);
	manager.setLabelLanguage = vi.fn(async () => {});
	manager.dispatchEvent = vi.fn();
	manager.localizedLabelMangerSandbox = {
		updateFrameProperties: vi.fn(async () => {}),
		commitUndo: vi.fn(async () => {}),
		// the layers as they are now: the cached ones
		getByIds: vi.fn(async (ids: string[]) =>
			ids.map((id) => manager.cachedLocalisedLabels[id]).filter(Boolean),
		),
		getWithMessages: vi.fn(async () => []),
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
		Object.assign(manager, {
			undoStepDepth: 0,
			undoSteps: Promise.resolve(),
			pendingUndoSteps: 0,
			localizedLabelMangerSandbox: { commitUndo: vi.fn(async () => {}) },
		});
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
		Object.assign(manager, {
			undoStepDepth: 0,
			undoSteps: Promise.resolve(),
			pendingUndoSteps: 0,
			localizedLabelMangerSandbox: { commitUndo: vi.fn(async () => {}) },
		});
		manager.messageStore = {
			getMessage: () => structuredClone(stored),
			upsertMessage: vi.fn(async () => {}),
		} as any;
		manager.getWithMessages = vi.fn(async () => []);
		manager.updateToMessageHead = vi.fn(async () => {});
		await manager.import([structuredClone(stored)], Locale.DE);
		expect(manager.messageStore.upsertMessage).not.toHaveBeenCalled();
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
		Object.assign(manager, {
			undoStepDepth: 0,
			undoSteps: Promise.resolve(),
			pendingUndoSteps: 0,
			localizedLabelMangerSandbox: { commitUndo: vi.fn(async () => {}) },
		});
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

	test("commitUndo closes the step right away, for a change that is a step of its own", async () => {
		vi.useFakeTimers();
		try {
			const { manager } = createManager();
			// typing, then a form is added before the typing paused
			manager.commitUndoWhenIdle(800);
			await manager.commitUndo();
			expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
			// the pending idle commit is no longer needed: it would close an empty step later
			vi.advanceTimersByTime(800);
			expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
		} finally {
			vi.useRealTimers();
		}
	});
});

/** A linkable layer as the Layers tab / a review drawer has it. */
const linkable = (nodeId: string, rootFrameId: string, html = "Sign in", characters = html) => ({
	nodeId,
	rootFrameId,
	rootFrameLanguage: Locale.EN,
	language: Locale.EN,
	messageLinkState: MessageLinkState.Unset,
	matchingLabelLints: [],
	characters,
	currentPatternHTML: html,
	parameterValues: {},
});

const plainMessage = (id: string, en: string): Message => ({
	id,
	selectors: [],
	variants: [{ languageTag: "en", match: [], pattern: [{ type: "Text", value: en }] }],
});

/** A manager whose sandbox records the label updates of a bulk link. */
function linkManager(labels: ReturnType<typeof linkable>[], messages: Message[]) {
	const { manager } = createManager();
	for (const label of labels) manager.cachedLocalisedLabels[label.nodeId] = label;
	const stored = new Map(messages.map((message) => [message.id, message]));
	manager.updateBatchDepth = 0;
	manager.messageStore = {
		getMessageByName: (name: string) => stored.get(name),
		upsertMessage: vi.fn(async (message: Message) => {
			stored.set(message.id, message);
			return message;
		}),
	};
	manager.refreshCachedLabel = vi.fn((label: any) => {
		manager.cachedLocalisedLabels[label.nodeId] = label;
		return true;
	});
	manager.toSandboxUpdate = vi.fn((nodeId: string, changes: any) => ({ nodeId, ...changes }));
	manager.localizedLabelMangerSandbox.updateLabelsProperties = vi.fn(async (updates: any[]) =>
		updates.map(({ nodeId }) => ({ label: manager.cachedLocalisedLabels[nodeId] })),
	);
	const written = () =>
		manager.localizedLabelMangerSandbox.updateLabelsProperties.mock.calls.flatMap(
			([updates]: any[]) => updates.map((update: any) => update.properties),
		);
	return { manager, stored, written };
}

describe("LocalizedLabelManagerUI.linkLabelsToMessages", () => {
	test("links all layers with one sandbox call, one view refresh and one undo step", async () => {
		const labels = [linkable("a", "frame-1"), linkable("b", "frame-1"), linkable("c", "frame-2")];
		const { manager } = linkManager(labels, [plainMessage("login.sign_in", "Sign in")]);

		const result = await manager.linkLabelsToMessages(
			labels.map((l) => ({ label: l, messageName: "login.sign_in" })),
		);

		expect(result).toEqual({ linked: 3, skipped: 0 });
		expect(manager.localizedLabelMangerSandbox.updateLabelsProperties).toHaveBeenCalledTimes(1);
		expect(
			manager.localizedLabelMangerSandbox.updateLabelsProperties.mock.calls[0][0],
		).toHaveLength(3);
		expect(manager.dispatchEvent).toHaveBeenCalledTimes(1);
		expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
		expect(manager.frameOperations.size).toBe(0);
	});

	test("waits for a running operation of its frames and holds back the next one", async () => {
		const label = linkable("a", "frame-1");
		const { manager } = linkManager([label], [plainMessage("login.cancel", "Sign in")]);
		const order: string[] = [];
		let finishSwitch!: () => void;
		const switching = manager.runFrameOperation(
			"frame-1",
			() =>
				new Promise<void>((resolve) => {
					finishSwitch = () => {
						order.push("switch done");
						resolve();
					};
				}),
		);
		manager.localizedLabelMangerSandbox.updateLabelsProperties = vi.fn(async (updates: any[]) => {
			order.push("link written");
			return updates.map(({ nodeId }: any) => ({ label: { nodeId } }));
		});

		const linking = manager.linkLabelsToMessages([{ label, messageName: "login.cancel" }]);
		const nextSwitch = manager.runFrameOperation("frame-1", async () => {
			order.push("next operation");
		});
		await new Promise((resolve) => setTimeout(resolve, 20));
		expect(order).toEqual([]);

		finishSwitch();
		await Promise.all([switching, linking, nextSwitch]);
		expect(order).toEqual(["switch done", "link written", "next operation"]);
	});

	test("skips rows that went stale: deleted, linked meanwhile, or with another text", async () => {
		const labels = [
			linkable("kept", "frame-1"),
			linkable("deleted", "frame-1"),
			linkable("linked", "frame-1"),
			linkable("edited", "frame-1"),
		];
		const { manager, written } = linkManager(labels, [plainMessage("login.sign_in", "Sign in")]);
		// what happened on the canvas after the review was opened
		delete manager.cachedLocalisedLabels.deleted;
		manager.cachedLocalisedLabels.linked = {
			...labels[2],
			messageLinkState: MessageLinkState.Linked,
			messageId: "other",
		};
		manager.cachedLocalisedLabels.edited = {
			...labels[3],
			characters: "Sign up",
			currentPatternHTML: "Sign up",
		};

		const result = await manager.linkLabelsToMessages(
			labels.map((label) => ({ label, messageName: "login.sign_in" })),
		);

		expect(result).toEqual({ linked: 1, skipped: 3 });
		expect(written().map((update: any) => update.nodeId)).toEqual(["kept"]);
	});

	test("keeps the line breaks and bold of layers that match a message only loosely", async () => {
		const labels = [
			linkable("multiline", "frame-1", "Welcome\nback", "Welcome\nback"),
			linkable("bold", "frame-1", "Pay <strong>now</strong>", "Pay now"),
		];
		const { manager, stored, written } = linkManager(labels, [
			plainMessage("welcome", "Welcome back"),
			plainMessage("pay", "Pay now"),
		]);

		await manager.linkLabelsToMessages([
			{ label: labels[0], messageName: "welcome" },
			{ label: labels[1], messageName: "pay" },
		]);

		// the layers are linked as they are: no text is written to the canvas
		expect(written().map((update: any) => update.messageState.keepText)).toEqual([true, true]);
		// the flat (imported) texts take the layers' line breaks and formatting, not the other way round
		expect(stored.get("welcome")!.variants[0].pattern).toEqual([
			{ type: "Text", value: "Welcome\nback" },
		]);
		expect(stored.get("pay")!.variants[0].pattern).toEqual([
			{ type: "Text", value: "Pay <strong>now</strong>" },
		]);
	});

	test("never collapses a message that has line breaks of its own, nor one other layers show", async () => {
		const labels = [
			linkable("flat", "frame-1", "Welcome back"),
			linkable("used", "frame-1", "Pay\nnow", "Pay\nnow"),
			linkable("exact", "frame-1", "Hello world"),
			linkable("loose", "frame-1", "Hello\nworld", "Hello\nworld"),
		];
		const { manager, stored, written } = linkManager(labels, [
			plainMessage("welcome", "Welcome\nback"),
			plainMessage("pay", "Pay now"),
			plainMessage("hello", "Hello world"),
		]);
		// another layer shows "pay" already
		manager.localizedLabelMangerSandbox.getWithMessages = vi.fn(async (ids: string[]) =>
			ids.includes("pay") ? [{ nodeId: "elsewhere", messageId: "pay" }] : [],
		);

		await manager.linkLabelsToMessages([
			{ label: labels[0], messageName: "welcome" },
			{ label: labels[1], messageName: "pay" },
			{ label: labels[2], messageName: "hello" },
			{ label: labels[3], messageName: "hello" },
		]);

		expect(manager.messageStore.upsertMessage).not.toHaveBeenCalled();
		expect(stored.get("welcome")!.variants[0].pattern[0]).toEqual({
			type: "Text",
			value: "Welcome\nback",
		});
		// every layer keeps its own text
		expect(written().every((update: any) => update.messageState.keepText)).toBe(true);
	});

	test("a layer linked to a message with another text shows the message's text", async () => {
		const label = linkable("a", "frame-1", "Sign in");
		const { manager, written } = linkManager([label], [plainMessage("login.title", "Welcome")]);
		await manager.linkLabelsToMessages([{ label, messageName: "login.title" }]);
		expect(written()[0].messageState.keepText).toBe(false);
	});

	test("is one undo step: typing before it is closed first, the idle commit waits for it", async () => {
		vi.useFakeTimers();
		try {
			const label = linkable("a", "frame-1");
			const { manager } = linkManager([label], [plainMessage("login.sign_in", "Sign in")]);
			const commits: string[] = [];
			manager.localizedLabelMangerSandbox.commitUndo = vi.fn(async () => {
				commits.push("commit");
			});
			let finishWrite!: () => void;
			manager.localizedLabelMangerSandbox.updateLabelsProperties = vi.fn(async (updates: any[]) => {
				commits.push("write starts");
				await new Promise<void>((resolve) => {
					finishWrite = resolve;
				});
				commits.push("write ends");
				return updates.map(({ nodeId }: any) => ({ label: { nodeId } }));
			});
			// typing whose undo step is not closed yet
			manager.commitUndoWhenIdle(800);
			const linking = manager.linkLabelsToMessages([{ label, messageName: "login.sign_in" }]);
			await vi.advanceTimersByTimeAsync(0);
			// the idle commit fires while the link is written: it must not split it
			await vi.advanceTimersByTimeAsync(2000);
			finishWrite();
			await linking;
			expect(commits).toEqual(["commit", "write starts", "write ends", "commit"]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("LocalizedLabelManagerUI.toSandboxUpdate", () => {
	test("a link that keeps the layer's text writes no characters", () => {
		const { manager } = createManager();
		manager.cachedLocalisedLabels.a = linkable("a", "frame-1", "Welcome\nback");
		manager.messageStore = {
			getMessage: () => plainMessage("welcome", "Welcome back"),
			getRefLanugage: () => "en",
		};
		const update = manager.toSandboxUpdate("a", {
			messageState: { type: "linked", messageId: "welcome", parameterValues: {}, keepText: true },
			language: Locale.EN,
		});
		expect(update.characters).toBeUndefined();
		expect(update.ops).toBeUndefined();
		expect(update.messageState.messageId).toBe("welcome");
	});
});

describe("LocalizedLabelManagerUI bulk language switch", () => {
	test("the idle commit of typing cannot split a switch of several frames", async () => {
		vi.useFakeTimers();
		try {
			const { manager } = createManager();
			const commits: string[] = [];
			manager.localizedLabelMangerSandbox.commitUndo = vi.fn(async () => {
				commits.push("commit");
			});
			manager.setLabelLanguage = vi.fn(async () => {
				commits.push("label");
				await new Promise((resolve) => setTimeout(resolve, 600));
			});
			manager.commitUndoWhenIdle(800);
			const switching = manager.setFramesLanguage(["f1", "f2", "f3"], Locale.DE, {} as any);
			await vi.advanceTimersByTimeAsync(3000);
			await switching;
			expect(commits).toEqual(["commit", "label", "label", "label", "commit"]);
		} finally {
			vi.useRealTimers();
		}
	});
});

describe("LocalizedLabelManagerUI undo steps of bulk actions", () => {
	test("two bulk actions started together are two undo steps, other commits wait for them", async () => {
		const label = linkable("a", "frame-1");
		const { manager } = linkManager([label], [plainMessage("login.sign_in", "Sign in")]);
		const events: string[] = [];
		manager.localizedLabelMangerSandbox.commitUndo = vi.fn(async () => {
			events.push("commit");
		});
		manager.localizedLabelMangerSandbox.updateLabelsProperties = vi.fn(async (updates: any[]) => {
			events.push("link");
			await new Promise((resolve) => setTimeout(resolve, 20));
			return updates.map(({ nodeId }: any) => ({ label: { nodeId } }));
		});
		manager.setLabelLanguage = vi.fn(async () => {
			events.push("switch");
		});
		const linking = manager.linkLabelsToMessages([{ label, messageName: "login.sign_in" }]);
		const switching = manager.setFramesLanguage(["frame-2"], Locale.DE, {} as any);
		// a single change (e.g. a form added in the drawer) during the link: part of its step
		await new Promise((resolve) => setTimeout(resolve, 5));
		await manager.commitUndo();
		await Promise.all([linking, switching]);
		expect(events).toEqual(["link", "commit", "switch", "commit"]);
	});

	test("does not rewrite a message while not every page was read (other layers may show it)", async () => {
		const label = linkable("multiline", "frame-1", "Welcome\nback", "Welcome\nback");
		const { manager, stored, written } = linkManager(
			[label],
			[plainMessage("welcome", "Welcome back")],
		);
		manager.linksLoaded = false;
		await manager.linkLabelsToMessages([{ label, messageName: "welcome" }]);
		expect(stored.get("welcome")!.variants[0].pattern).toEqual([
			{ type: "Text", value: "Welcome back" },
		]);
		expect(written()[0].messageState.keepText).toBe(true);
	});
});

describe("a layer linked to a plural message", () => {
	const count = { type: "VariableReference" as const, name: "count" };
	// what the Inlang message format and i18next files import: the "other" form is a literal match
	const items: Message = {
		id: "checkout.items",
		nativeBundle: {
			id: "checkout.items",
			declarations: [
				{ type: "input-variable", name: "count" },
				{
					type: "local-variable",
					name: "countPlural",
					value: {
						type: "expression",
						arg: { type: "variable-reference", name: "count" },
						annotation: { type: "function-reference", name: "plural", options: [] },
					},
				},
			],
			messages: [],
		} as any,
		selectors: [{ type: "VariableReference", name: "countPlural" }],
		variants: [
			{ languageTag: "en", match: ["one"], pattern: [count, { type: "Text", value: " item" }] },
			{ languageTag: "en", match: ["other"], pattern: [count, { type: "Text", value: " items" }] },
			{ languageTag: "de", match: ["one"], pattern: [count, { type: "Text", value: " Artikel" }] },
			{
				languageTag: "de",
				match: ["other"],
				pattern: [count, { type: "Text", value: " Artikel" }],
			},
		],
	};

	function pluralManager(message: Message = items) {
		const { manager } = createManager();
		const label = {
			nodeId: "label-1",
			rootFrameId: "frame-2",
			language: "en",
			rootFrameLanguage: "en",
			messageLinkState: MessageLinkState.Linked,
			messageId: message.id,
			parameterValues: {} as Record<string, any>,
			currentPatternHTML: "2 items",
		};
		manager.cachedLocalisedLabels["label-1"] = label;
		manager.messageStore = {
			getMessage: () => structuredClone(message),
			getMessageByName: () => structuredClone(message),
			getRefLanugage: () => "en",
		};
		// the real conversion needs Quill (a DOM): it shows the text with the values filled in
		const conversions: { html: string; parameterValues: any }[] = [];
		vi.spyOn(UILocalizedLabel, "toTextOpsAndFillinsToPlaceholder").mockImplementation(
			(html: string, parameterValues: any) => {
				conversions.push({ html, parameterValues: structuredClone(parameterValues) });
				return {
					characters: html.replace(
						/<ph>(\w+)<\/ph>/g,
						(_match, name) => parameterValues[name].value,
					),
					ops: [],
					fillinsToPlaceholder: {},
				};
			},
		);
		return { manager, label, conversions };
	}
	const link = (manager: any, parameterValues: any = {}, extra: object = {}) =>
		manager.toSandboxUpdate("label-1", {
			messageState: { type: "linked", messageId: "checkout.items", parameterValues, ...extra },
			language: "en",
		});

	test("shows the catch-all form with an example count instead of going blank", () => {
		const { manager } = pluralManager();
		const update = link(manager);
		expect(update.characters).toBe("2 items");
		expect(update.messageState.parameterValues.count).toEqual({
			type: "string",
			value: "2",
			default: true,
		});
	});

	test("shows the form of the count stored on the layer", () => {
		const { manager } = pluralManager();
		expect(link(manager, { count: { type: "string", value: "1" } }).characters).toBe("1 item");
		expect(link(manager, { count: { type: "string", value: "7" } }).characters).toBe("7 items");
		// a layer linked before had the variable's name as its value
		expect(
			link(manager, { count: { type: "string", value: "count", default: true } }).characters,
		).toBe("2 items");
	});

	test("uses the same count in another language", () => {
		const { manager } = pluralManager();
		const update = manager.toSandboxUpdate("label-1", {
			messageState: {
				type: "linked",
				messageId: "checkout.items",
				parameterValues: { count: { type: "string", value: "1" } },
			},
			language: "de",
		});
		expect(update.characters).toBe("1 Artikel");
		expect(update.language).toBe("de");
	});

	test("a layer that is linked now keeps the number it shows", () => {
		const { manager, label } = pluralManager();
		Object.assign(label, { messageLinkState: MessageLinkState.Unset, messageId: undefined });
		const linkText = (html: string) => {
			label.currentPatternHTML = html;
			return link(manager);
		};
		const one = linkText("1 item");
		expect(one.characters).toBe("1 item");
		expect(one.messageState.parameterValues.count).toEqual({
			type: "string",
			value: "1",
			default: false,
		});
		expect(linkText("12 items").characters).toBe("12 items");
		// a text that is no form of the message shows the example count
		expect(linkText("Your cart").characters).toBe("2 items");
		// a layer that was linked before keeps the count it has
		Object.assign(label, {
			messageLinkState: MessageLinkState.Linked,
			messageId: "checkout.items",
		});
		expect(linkText("1 item").characters).toBe("2 items");
	});

	test("keeps the text of the layer when the message has no text to show", () => {
		const { manager } = pluralManager({ ...items, variants: [] });
		const update = link(manager);
		expect(update.characters).toBeUndefined();
		expect(update.ops).toBeUndefined();
		expect(update.language).toBe("en");
	});

	test("a text edited in the layer does not need the catch-all form of the message", () => {
		const { manager } = pluralManager();
		const update = link(
			manager,
			{ count: { type: "string", value: "1" } },
			{
				variantPatternHTML: "<ph>count</ph> pieces",
			},
		);
		expect(update.characters).toBe("1 pieces");
	});

	test("Update message writes the text of the layer into the form its count chooses", async () => {
		const { manager, label } = pluralManager();
		label.parameterValues = { count: { type: "string", value: "1", default: false } };
		label.currentPatternHTML = "<ph>count</ph> piece";
		manager.updateMessage = vi.fn(async () => {});
		await manager.createNewVersionFromLabelState(label as any);
		const [updated] = manager.updateMessage.mock.calls[0] as [Message];
		const text = (languageTag: string, form: string) =>
			updated.variants.find((v) => v.languageTag === languageTag && v.match[0] === form)?.pattern;
		expect(text("en", "one")).toEqual([count, { type: "Text", value: " piece" }]);
		expect(text("en", "other")).toEqual([count, { type: "Text", value: " items" }]);
		// no new variant with a match that has no selector
		expect(updated.variants).toHaveLength(4);
	});

	test("editing the count of the layer is one undo step and does not touch the message", async () => {
		const { manager, label } = pluralManager();
		label.parameterValues = { count: { type: "string", value: "2", default: true } };
		manager.updateLabelProperties = vi.fn(async () => {});
		manager.messageStore.upsertMessage = vi.fn();
		await manager.updateLabelVariable(label as any, "count", " 1 ");
		expect(manager.updateLabelProperties).toHaveBeenCalledWith("label-1", {
			messageState: {
				type: "linked",
				messageId: "checkout.items",
				parameterValues: { count: { type: "string", value: "1", default: false } },
			},
		});
		expect(manager.localizedLabelMangerSandbox.commitUndo).toHaveBeenCalledTimes(1);
		expect(manager.messageStore.upsertMessage).not.toHaveBeenCalled();

		// an empty field goes back to the example count (the next update fills it in again)
		await manager.updateLabelVariable(label as any, "count", "");
		expect(manager.updateLabelProperties).toHaveBeenLastCalledWith("label-1", {
			messageState: { type: "linked", messageId: "checkout.items", parameterValues: {} },
		});
	});
});
