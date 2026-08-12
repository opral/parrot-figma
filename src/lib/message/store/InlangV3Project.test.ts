import { describe, expect, test } from "vitest";
import type { Message } from "../LegacyMessage";
import { InlangV3Project } from "./InlangV3Project";

const initial: Message = {
	id: "welcome",
	alias: {},
	selectors: [],
	variants: [
		{
			languageTag: "en",
			match: [],
			pattern: [{ type: "Text", value: "Hello" }],
		},
	],
};

describe("InlangV3Project", () => {
	test("owns a Lix project session and replaces nested bundles", async () => {
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en", "de"], modules: [] },
			messages: [initial],
		});

		try {
			expect(session.get("welcome")).toEqual(initial);

			const updated: Message = {
				...initial,
				variants: [
					{
						languageTag: "de",
						match: [],
						pattern: [{ type: "Text", value: "Hallo" }],
					},
				],
			};
			await session.upsert(updated);
			await session.refreshFromProject();
			expect(session.get("welcome")).toEqual(updated);

			await session.delete("welcome");
			expect(session.getAll()).toEqual([]);
			expect(await session.settings()).toMatchObject({
				baseLocale: "en",
				locales: ["en", "de"],
			});
		} finally {
			await session.close();
		}
	});
});
