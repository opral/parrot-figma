import { describe, expect, test } from "vitest";
import { isClickOutside } from "./OutsideClickHandler";

describe("isClickOutside", () => {
	test("treats a portaled menu as inside when its additional root contains the target", () => {
		const option = {} as Node;
		const portalMenu = {
			contains: (target: Node) => target === option,
		} as ParentNode;

		expect(isClickOutside(option, [null, portalMenu])).toBe(false);
	});

	test("treats targets outside all roots as outside clicks", () => {
		const option = {} as Node;
		const wrapper = { contains: () => false } as unknown as ParentNode;

		expect(isClickOutside(option, [wrapper])).toBe(true);
	});
});
