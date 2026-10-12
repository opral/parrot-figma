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
	test("hydrates a project from a bulk message set", async () => {
		const messages = Array.from({ length: 30 }, (_, index) => ({
			...initial,
			id: `key-${index}`,
			variants: [
				{
					languageTag: "en",
					match: [],
					pattern: [{ type: "Text" as const, value: `Hello ${index}` }],
				},
			],
		}));
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages,
		});

		try {
			expect(session.getAll()).toEqual(messages);
		} finally {
			await session.close();
		}
	});

	test("hydrates a big file with several languages in chunks", async () => {
		const messages: Message[] = Array.from({ length: 450 }, (_, index) => ({
			...initial,
			id: `key-${index}`,
			variants: ["en", "de"].map((languageTag) => ({
				languageTag,
				match: [],
				pattern: [{ type: "Text" as const, value: `${languageTag} ${index}` }],
			})),
		}));
		// messages that are still being loaded are accepted while Lix starts
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en", "de"], modules: [] },
			messages: Promise.resolve(messages),
		});

		try {
			expect(session.getAll()).toEqual(messages);
			// everything also reached the Lix database
			await session.refreshFromProject();
			expect(session.getAll()).toHaveLength(450);
			expect(
				session
					.get("key-449")
					?.variants.map((variant) => variant.languageTag)
					.sort(),
			).toEqual(["de", "en"]);
			expect(session.get("key-449")?.variants[0]?.pattern).toHaveLength(1);
		} finally {
			await session.close();
		}
	});

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
	test("upserts and deletes many messages in batches (undo / redo of an import)", async () => {
		const make = (index: number, text: string): Message => ({
			...initial,
			id: `key-${index}`,
			variants: ["en", "de"].map((languageTag) => ({
				languageTag,
				match: [],
				pattern: [{ type: "Text" as const, value: `${languageTag} ${text} ${index}` }],
			})),
		});
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en", "de"], modules: [] },
			messages: [make(0, "old")],
		});

		try {
			const seen: string[] = [];
			session.subscribe("key-0", (message) => seen.push(message.id));
			// 450 = more than one chunk; key-0 exists already (replaced), the others are new
			const many = Array.from({ length: 450 }, (_, index) => make(index, "new"));
			await session.upsertMany(many);
			await session.refreshFromProject();
			expect(session.getAll()).toHaveLength(450);
			const sorted = (message: Message | undefined) =>
				message?.variants.map((v) => `${v.languageTag}: ${JSON.stringify(v.pattern)}`).sort();
			expect(sorted(session.get("key-0"))).toEqual(sorted(make(0, "new")));
			expect(sorted(session.get("key-449"))).toEqual(sorted(make(449, "new")));
			expect(seen).toEqual(["key-0"]);

			await session.deleteMany(many.slice(10).map((message) => message.id));
			await session.deleteMany(["unknown"]);
			await session.refreshFromProject();
			expect(session.getAll().map((message) => message.id)).toHaveLength(10);
			expect(session.get("key-449")).toBeUndefined();
		} finally {
			await session.close();
		}
	});
});
