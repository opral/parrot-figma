import { afterEach, expect, it, vi } from "vitest";
import FigmaUtil from "./FigmaUtil";
afterEach(() => vi.unstubAllGlobals());
it("switches to the first target page before selection and excludes targets from other pages", async () => {
	const page: any = { id: "page", type: "PAGE", selection: [] };
	const other: any = { id: "other", type: "PAGE" };
	const first = { id: "first", type: "TEXT", parent: page };
	const second = { id: "second", type: "TEXT", parent: other };
	const figmaMock = {
		currentPage: other,
		getNodeByIdAsync: vi.fn(async (id: string) =>
			id === "first" ? first : id === "second" ? second : null,
		),
		setCurrentPageAsync: vi.fn(async (next: any) => {
			figmaMock.currentPage = next;
		}),
	};
	vi.stubGlobal("figma", figmaMock);
	await new FigmaUtil().selectNodes(["missing", "first", "second", "first"]);
	expect(figmaMock.setCurrentPageAsync).toHaveBeenCalledOnce();
	expect(page.selection).toEqual([first]);
	expect(figmaMock.getNodeByIdAsync).toHaveBeenCalledTimes(3);
});
