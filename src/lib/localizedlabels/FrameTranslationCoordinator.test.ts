import { describe, expect, test, vi } from "vitest";
import { FrameTranslationCoordinator } from "./FrameTranslationCoordinator";

describe("FrameTranslationCoordinator", () => {
	test("uses the snapshotted targets and commits once", async () => {
		const coordinator = new FrameTranslationCoordinator();
		const applied: string[] = [];
		const commitFrame = vi.fn(async () => undefined);
		const commitUndo = vi.fn(async () => undefined);
		await coordinator.run({
			frameId: "a",
			labelIds: ["a-1", "a-2"],
			applyLabel: async (id) => void applied.push(id),
			commitFrame,
			commitUndo,
		});
		expect(applied).toEqual(["a-1", "a-2"]);
		expect(commitFrame).toHaveBeenCalledOnce();
		expect(commitUndo).toHaveBeenCalledOnce();
	});

	test("does not record frame locale or undo after failure", async () => {
		const coordinator = new FrameTranslationCoordinator();
		const commitFrame = vi.fn(async () => undefined);
		const commitUndo = vi.fn(async () => undefined);
		await expect(
			coordinator.run({
				frameId: "a",
				labelIds: ["1", "2"],
				applyLabel: async (id) => {
					if (id === "2") throw new Error("font unavailable");
				},
				commitFrame,
				commitUndo,
			}),
		).rejects.toThrow("font unavailable");
		expect(commitFrame).not.toHaveBeenCalled();
		expect(commitUndo).not.toHaveBeenCalled();
	});

	test("does not interleave a newer request with an in-flight mutation", async () => {
		const coordinator = new FrameTranslationCoordinator();
		let release!: () => void;
		const blocker = new Promise<void>((resolve) => (release = resolve));
		const events: string[] = [];
		const first = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			applyLabel: async () => {
				events.push("first-start");
				await blocker;
				events.push("first-end");
			},
			commitFrame: async () => void events.push("first-frame"),
			commitUndo: async () => void events.push("first-undo"),
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		const latest = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			applyLabel: async () => void events.push("latest-label"),
			commitFrame: async () => void events.push("latest-frame"),
			commitUndo: async () => void events.push("latest-undo"),
		});
		expect(events).toEqual(["first-start"]);
		release();
		await Promise.all([first, latest]);
		expect(events).toEqual([
			"first-start",
			"first-end",
			"first-frame",
			"first-undo",
			"latest-label",
			"latest-frame",
			"latest-undo",
		]);
	});

	test("keeps the prior coherent frame state when the next request fails", async () => {
		const coordinator = new FrameTranslationCoordinator();
		let locale = "en";
		const first = coordinator.run({
			frameId: "a",
			labelIds: [],
			applyLabel: async () => undefined,
			commitFrame: async () => void (locale = "de"),
			commitUndo: async () => undefined,
		});
		const second = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			applyLabel: async () => {
				throw new Error("failed");
			},
			commitFrame: async () => void (locale = "fr"),
			commitUndo: async () => undefined,
		});
		await first;
		await expect(second).rejects.toThrow("failed");
		expect(locale).toBe("de");
	});
});
