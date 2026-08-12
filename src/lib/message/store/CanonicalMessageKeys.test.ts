import { describe, expect, test } from "vitest";
import type { Message } from "../LegacyMessage";
import { FigmaBundleStore } from "./FigmaBundleStore";
import { legacyMessageToBundle } from "./LegacyMessageBundleConverter";
import { InlangV3Project } from "./InlangV3Project";
import MessageStoreMemory from "./MessageStoreMemory";
import {
	canonicalMessageKeySearchQuery,
	isCanonicalMessageKey,
	preserveCanonicalMessageKey,
} from "../canonicalMessageKey";

class FakeRoot {
	readonly id = "0:0";
	readonly data = new Map<string, string>();

	getPluginData(key: string) {
		return this.data.get(key) ?? "";
	}

	getPluginDataKeys() {
		return [...this.data.keys()];
	}

	setPluginData(key: string, value: string) {
		if (value === "") this.data.delete(key);
		else this.data.set(key, value);
	}
}

function message(id: string): Message {
	return {
		id,
		alias: {},
		selectors: [],
		variants: [
			{
				languageTag: "en",
				match: [],
				pattern: [{ type: "Text", value: `Value for ${id}` }],
			},
		],
	};
}

describe("canonical message keys", () => {
	test.each(["member.login_title", "member__login_title", "checkout-title", "日本語.見出し"])(
		"accepts and searches the exact typed key %s",
		(id) => {
			expect(preserveCanonicalMessageKey(id)).toBe(id);
			expect(isCanonicalMessageKey(id)).toBe(true);
			expect(canonicalMessageKeySearchQuery(id, "Label text")).toEqual({
				exactText: true,
				name: id,
				text: "Label text",
			});
		},
	);

	test("rejects only an empty key", () => {
		expect(isCanonicalMessageKey("")).toBe(false);
	});

	test.each(["member.login_title", "member__login_title", "checkout-title", "日本語.見出し"])(
		"preserves %s in Figma bundle storage",
		(id) => {
			const store = new FigmaBundleStore({ root: new FakeRoot() });
			store.put(legacyMessageToBundle(message(id)));
			expect(store.get(id)?.id).toBe(id);
		},
	);

	test("keeps dotted and double-underscore keys distinct across project refresh", async () => {
		const dotted = message("member.login_title");
		const underscored = message("member__login_title");
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [dotted, underscored],
		});
		try {
			await session.refreshFromProject();
			expect(
				session
					.getAll()
					.map(({ id }) => id)
					.sort(),
			).toEqual(["member.login_title", "member__login_title"]);
		} finally {
			await session.close();
		}
	});

	test("finds an existing canonical key when the layer text differs", async () => {
		const session = await InlangV3Project.open({
			settings: { baseLocale: "en", locales: ["en"], modules: [] },
			messages: [message("日本語.見出し"), message("x")],
		});
		try {
			const store = Object.create(MessageStoreMemory.prototype) as MessageStoreMemory;
			store.inlangProject = session;
			const result = store.findMessages(
				canonicalMessageKeySearchQuery("日本語.見出し", "Different layer text"),
			);
			expect(result.inNames).toEqual(new Set(["日本語.見出し"]));
			expect(result.matchingNames).toEqual(new Set());
			const shortResult = store.findMessages(canonicalMessageKeySearchQuery("x", "Different"));
			expect(shortResult.inNames).toEqual(new Set(["x"]));
		} finally {
			await session.close();
		}
	});
});
