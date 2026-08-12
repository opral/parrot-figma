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
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async (id) => void applied.push(id),
			commitFrame,
			commitUndo,
			rollback: async (_snapshot) => undefined,
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
				capture: async () => undefined,
				lockMutations: async () => undefined,
				applyLabel: async (id) => {
					if (id === "2") throw new Error("font unavailable");
				},
				commitFrame,
				commitUndo,
				rollback: async (_snapshot) => undefined,
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
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async () => {
				events.push("first-start");
				await blocker;
				events.push("first-end");
			},
			commitFrame: async () => void events.push("first-frame"),
			commitUndo: async () => void events.push("first-undo"),
			rollback: async (_snapshot) => void events.push("first-rollback"),
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		const latest = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async () => void events.push("latest-label"),
			commitFrame: async () => void events.push("latest-frame"),
			commitUndo: async () => void events.push("latest-undo"),
			rollback: async (_snapshot) => void events.push("latest-rollback"),
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
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async () => undefined,
			commitFrame: async () => void (locale = "de"),
			commitUndo: async () => undefined,
			rollback: async (_snapshot) => undefined,
		});
		const second = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async () => {
				throw new Error("failed");
			},
			commitFrame: async () => void (locale = "fr"),
			commitUndo: async () => undefined,
			rollback: async (_snapshot) => undefined,
		});
		await first;
		await expect(second).rejects.toThrow("failed");
		expect(locale).toBe("de");
	});

	test("rolls back completed label mutations after a later failure", async () => {
		const coordinator = new FrameTranslationCoordinator();
		const state: string[] = [];
		const rollback = vi.fn(async () => void state.splice(0));
		await expect(
			coordinator.run({
				frameId: "a",
				labelIds: ["1", "2"],
				capture: async () => undefined,
				lockMutations: async () => undefined,
				applyLabel: async (id) => {
					if (id === "2") throw new Error("style failed");
					state.push(id);
				},
				commitFrame: async () => undefined,
				commitUndo: async () => undefined,
				rollback,
			}),
		).rejects.toThrow("style failed");
		expect(state).toEqual([]);
		expect(rollback).toHaveBeenCalledOnce();
	});

	test("serializes transactions across different frames", async () => {
		const coordinator = new FrameTranslationCoordinator();
		let release!: () => void;
		const blocker = new Promise<void>((resolve) => (release = resolve));
		const events: string[] = [];
		const first = coordinator.run({
			frameId: "a",
			labelIds: ["a-1"],
			capture: async () => void events.push("a-begin"),
			lockMutations: async () => undefined,
			applyLabel: async () => blocker,
			commitFrame: async () => undefined,
			commitUndo: async () => void events.push("a-commit"),
			rollback: async (_snapshot) => undefined,
		});
		await new Promise((resolve) => setTimeout(resolve, 0));
		const second = coordinator.run({
			frameId: "b",
			labelIds: [],
			capture: async () => void events.push("b-begin"),
			lockMutations: async () => undefined,
			applyLabel: async () => undefined,
			commitFrame: async () => undefined,
			commitUndo: async () => void events.push("b-commit"),
			rollback: async (_snapshot) => undefined,
		});
		expect(events).toEqual(["a-begin"]);
		release();
		await Promise.all([first, second]);
		expect(events).toEqual(["a-begin", "a-commit", "b-begin", "b-commit"]);
	});

	test("preserves the original error when rollback also fails", async () => {
		const coordinator = new FrameTranslationCoordinator();
		const original = new Error("translation failed");
		const failure = coordinator.run({
			frameId: "a",
			labelIds: ["1"],
			capture: async () => undefined,
			lockMutations: async () => undefined,
			applyLabel: async () => {
				throw original;
			},
			commitFrame: async () => undefined,
			commitUndo: async () => undefined,
			rollback: async (_snapshot) => {
				throw new Error("rollback failed");
			},
		});
		await expect(failure).rejects.toMatchObject({ cause: original });
	});
});
