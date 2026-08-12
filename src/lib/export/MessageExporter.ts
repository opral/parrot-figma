import { Locale } from "../message/variants/Locale";
import MessageStoreMemory from "../message/store/MessageStoreMemory";

export const EXPORT_TARGETS = {
	i18next: {
		pluginKey: "plugin.inlang.i18next",
		fileType: "application/json",
	},
	"android-xml": {
		pluginKey: "plugin.inlang.android",
		fileType: "application/xml",
	},
	"apple-strings": {
		pluginKey: "plugin.inlang.apple-strings",
		fileType: "text/plain",
	},
	"apple-xcstrings": {
		pluginKey: "plugin.inlang.apple-xcstrings",
		fileType: "application/json",
	},
} as const;

export type ExportTarget = keyof typeof EXPORT_TARGETS;

export default class MessageExporter {
	static async export(messageStore: MessageStoreMemory, language: Locale, format: string) {
		if (!(format in EXPORT_TARGETS)) return undefined;
		const target = EXPORT_TARGETS[format as ExportTarget];
		const files = await messageStore.exportFiles(target.pluginKey, language);
		if (files.length === 0) return undefined;
		if (files.length > 1)
			throw new Error(
				`${files.length} files were generated for ${language}; multi-file downloads are not supported yet`,
			);
		const file = files[0]!;
		return {
			fileName: exportFileName(file.name, language, format as ExportTarget),
			fileType: target.fileType,
			content: new TextDecoder().decode(file.content),
		};
	}
}

function exportFileName(name: string, locale: string, target: ExportTarget) {
	const normalized = name.replace(/\\/g, "/");
	const leaf = normalized.slice(normalized.lastIndexOf("/") + 1);
	if (target === "apple-strings" && leaf === "Localizable.strings") {
		return `${locale}.strings`;
	}
	return leaf;
}
