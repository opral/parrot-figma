import { expect, test } from "vitest";
import MessageImporter from "./MessageImporter";
import { importWithPlugin } from "./InlangPluginImporter";
import { translationPlugins } from "../transfer/TranslationFormats";
import { mergeImportedMessage } from "../message/store/LegacyMessageBundleConverter";

test("a merged message (native bundle) counts a language it did not have as a new translation", async () => {
	const icu = translationPlugins.find((format) => format.label === "ICU MessageFormat")!.plugin;
	const read = async (locale: string, content: object) =>
		(
			await importWithPlugin({
				plugin: icu,
				fileName: `${locale}.json`,
				content: JSON.stringify(content),
				locale,
			})
		)[0];
	const english = await read("en", { hello: "Hello {name}" });
	const german = await read("de", { hello: "Hallo {name}" });
	const merged = mergeImportedMessage(english, german, "de");
	const store = { getMessageByName: (id: string) => (id === "hello" ? merged : undefined) } as any;

	const polish = await read("pl", { hello: "Cześć {name}" });
	const added = MessageImporter.getImportStatistics(store, [polish], "pl" as any);
	expect(added.newTranslations).toHaveLength(1);
	expect(added.changedTranslations).toHaveLength(0);

	const changed = MessageImporter.getImportStatistics(
		store,
		[await read("de", { hello: "Guten Tag {name}" })],
		"de" as any,
	);
	expect(changed.newTranslations).toHaveLength(0);
	expect(changed.changedTranslations).toHaveLength(1);
});
