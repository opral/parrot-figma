import { afterEach, expect, it, vi } from "vitest";
import { DocumentChanges } from "./DocumentChanges";
afterEach(() => vi.unstubAllGlobals());
it("registers the root event only after Figma confirms all pages have loaded, then reconciles missed changes", async () => {
	let finish!: () => void;
	const loadAllPagesAsync = vi.fn(
		() =>
			new Promise<void>((resolve) => {
				finish = resolve;
			}),
	);
	const on = vi.fn();
	const root = { id: "root" };
	vi.stubGlobal("figma", { root, loadAllPagesAsync, on });
	const changes = new DocumentChanges();
	const listener = vi.fn();
	changes.on("documentchange", listener);
	const ready = changes.activate();
	expect(on).not.toHaveBeenCalled();
	expect(changes.active).toBe(false);
	finish();
	await ready;
	expect(changes.active).toBe(true);
	expect(on).toHaveBeenCalledWith("documentchange", expect.any(Function));
	expect(listener).toHaveBeenCalledWith({
		documentChanges: [expect.objectContaining({ node: root, origin: "REMOTE" })],
	});
	await changes.activate();
	expect(loadAllPagesAsync).toHaveBeenCalledOnce();
});
it("retries after a page load failure without losing subscribers", async () => {
	const on = vi.fn();
	vi.stubGlobal("figma", {
		root: { id: "root" },
		on,
		loadAllPagesAsync: vi.fn().mockRejectedValueOnce(Error("offline")).mockResolvedValue(undefined),
	});
	const changes = new DocumentChanges();
	const listener = vi.fn();
	changes.on("documentchange", listener);
	await expect(changes.activate()).rejects.toThrow("offline");
	await changes.activate();
	expect(on).toHaveBeenCalledOnce();
	expect(listener).toHaveBeenCalledOnce();
});
