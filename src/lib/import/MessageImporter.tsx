import {
	legacyMessageToBundle,
	mergeImportedMessage,
	sameDeclarations,
	stableStringify,
} from "../message/store/LegacyMessageBundleConverter";
import type { Message } from "../message/LegacyMessage";
import { isBlankHtmlPattern } from "../message/editor/HtmlText";
import MessageStoreMemory from "../message/store/MessageStoreMemory";

import AppleStringsFileImporter from "./AppleStringsFileImporter";
import AndroidXMLImporter from "./AndroidXmlImporter";

import { ImportMessage } from "./ImportMessage";
import LocalizedLabelManagerUI from "../localizedlabels/LocalizedLabelManagerUI";
import I18NextKeyValueImporter from "./I18Next";
import { Gender } from "../message/variants/Gender";
import { Locale } from "../message/variants/Locale";

export enum ImportType {
	UNSUPPORTED = "not supported",
	INLANG_PLUGIN = "inlang plugin",
	IOS_STRINGS = "iOS Strings File",
	ANDROID_XML = "Android resource XML",
	L18N_JSON = "l18next JSON",
}

export type ImportResult = {
	fileName: string;
	formatName?: string;
	type: ImportType;
	messages: Message[] | undefined;
	language: Locale;
};

export default class MessageImporter {
	/**
	 * What an import of a language changes, counted per message (the "Review import" drawer): new
	 * messages, translations the language did not have (no text, or only empty forms - what the
	 * Messages tab calls missing) and changed translations (a form changed, added or removed).
	 */
	static getImportStatistics(
		messageStore: MessageStoreMemory,
		importMessages: Message[],
		language: Locale,
	) {
		const changedMessages = {
			language,
			newMessages: [] as Message[],
			newTranslations: [] as Message[],
			changedTranslations: [] as Message[],
		};

		for (const messageToImport of importMessages) {
			const diff = this.getDiff(messageStore, messageToImport, language);
			if (diff.type === "new") changedMessages.newMessages.push(messageToImport);
			else if (diff.type === "newTranslation")
				changedMessages.newTranslations.push(messageToImport);
			else if (diff.type === "changedTranslation")
				changedMessages.changedTranslations.push(messageToImport);
		}

		return changedMessages;
	}

	/**
	 * Compares the language of the stored message with the language after the import (the same merge
	 * the import writes): forms by their matches, so removed forms count too, for plain and Inlang
	 * messages alike.
	 */
	static getDiff(
		messageStore: MessageStoreMemory,
		importMessage: Message,
		language: Locale,
	): { type: "equal" | "new" | "newTranslation" | "changedTranslation" } {
		const currentMessage = messageStore.getMessageByName(importMessage.id);
		if (!currentMessage) {
			return { type: "new" };
		}
		let current: ReturnType<typeof legacyMessageToBundle>;
		let incoming: ReturnType<typeof legacyMessageToBundle>;
		try {
			current = legacyMessageToBundle(currentMessage);
			incoming = legacyMessageToBundle(
				mergeImportedMessage(currentMessage, importMessage, language),
			);
		} catch {
			// the import reports why it cannot merge this message
			return { type: "changedTranslation" };
		}
		const before = languageForms(current, language);
		const after = languageForms(incoming, language);
		if (
			stableStringify(before) === stableStringify(after) &&
			sameDeclarations(current.declarations, incoming.declarations)
		)
			return { type: "equal" };
		// no form, or only blank ones (`&nbsp;`, line breaks): what the translation checks call missing
		const hadText = before.some((form) => !isBlankHtmlPattern(form.pattern));
		return { type: hadText ? "changedTranslation" : "newTranslation" };
	}

	static processFile(fileName: string, content: string, language: Locale): ImportResult {
		// console.log(`processing file${fileName} content: ${content}`);

		const results = {
			fileName,
			type: ImportType.UNSUPPORTED,
			messages: undefined as Message[] | undefined,
			language,
		};

		let importObject = AppleStringsFileImporter.toImportObject(fileName, content, language);
		if (importObject) {
			results.type = ImportType.IOS_STRINGS;
			results.messages = importObject;
			return results;
		}

		importObject = AndroidXMLImporter.toImportObject(fileName, content, language);
		if (importObject) {
			results.type = ImportType.ANDROID_XML;
			results.messages = importObject;
			return results;
		}

		importObject = I18NextKeyValueImporter.toImportObject(fileName, content, language);
		if (importObject) {
			results.type = ImportType.L18N_JSON;
			results.messages = importObject;
			return results;
		}

		return results;
	}
}

/* const changedKeys = {
      added: [] as TranslationKey[],
      updated: [] as TranslationKey[],
      deleted: [] as TranslationKey[],
    };

    for (const key of Object.keys(result)) {
      // console.log('processing key ' + key);
      const lang = language as Language;
      const currentKey = this.getKey(key);
      if (!currentKey) {
        const createdKey = await this.createKey(key, [{
          language: lang, plural: Plural.OTHER, text: result[key], skip: false,
        }], false);
        changedKeys.added.push(createdKey);
      } else if (currentKey!.messages[lang]?.other?.text !== result[key]) {
        const skip = currentKey!.messages[lang]?.other?.skip ?? false;
        const updatedKey = await this.updateKey(key, [{
          language: lang, plural: Plural.OTHER, text: result[key], skip,
        }]);
        changedKeys.updated.push(updatedKey);
      } else {
        // console.log('skipping '+ key + ' text is equal');
        // eslint-disable-next-line no-continue
        continue;
      }
    }

    figma.commitUndo();

    if (changedKeys.added.length > 0
      || changedKeys.updated.length > 0) {
      figma.ui.postMessage({
        target: 'TranslationKeyStore',
        type: 'cacheUpdate',
        changedKeys,
      });
    } */

type Bundle = ReturnType<typeof legacyMessageToBundle>;

/** The forms of a language, by their matches (selector order and ids do not matter). */
function languageForms(bundle: Bundle, language: string) {
	return bundle.messages
		.filter((message) => message.locale === language)
		.flatMap((message) =>
			message.variants.map((variant) => ({
				selectors: message.selectors.map((selector) => selector.name).sort(),
				matches: [...variant.matches].sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)),
				pattern: variant.pattern,
			})),
		)
		.sort((a, b) => {
			const x = stableStringify(a.matches);
			const y = stableStringify(b.matches);
			return x < y ? -1 : x > y ? 1 : 0;
		});
}
