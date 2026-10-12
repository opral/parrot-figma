import {
	createVariant,
	getVariant,
	updateVariantPattern,
	type Message,
	type Pattern,
} from "../LegacyMessage";
import blake from "blakejs";
import { Locale } from "../variants/Locale";
import { Plural, getPluralFormsByLanguage } from "../variants/Plural";

import { NodeSelection } from "../../localizedlabels/LocalizedLabelManager";
import { Gender, genderList } from "../variants/Gender";
import { Config, InlangMessageStore } from "./InlangMessageStoreFigmaRoot";
import { MessageParameterValues } from "../MessageParameterValues";
import PlaceholderHelper from "../PlaceholderUtil";
import TranslatorMachine from "../../translationprovider/TranslatorMachine";
import { MachineTranslationUnavailableError } from "../../translationprovider/MachineTranslationContact";
import FigmaUtil from "../../../shared/FigmaUtil";
import { InlangV3Project } from "./InlangV3Project";

export type SearchQuery = {
	selected?: "FRAME" | "LABEL" | undefined;
	hasLabel?: string[] | undefined;
	oneLabelOf?: string[] | undefined;
	unverified?: boolean | undefined;
	missingTranslation?: boolean | undefined;
	/** with missingTranslation: only this language counts - otherwise any configured language */
	missingTranslationLanguage?: Locale | undefined;
	/** translations whose variables, markup or forms do not match the reference language */
	translationProblems?: boolean | undefined;
	name?: string | undefined;
	nameAtEnd?: boolean | undefined;
	text?: string | undefined;
	exactText?: boolean | undefined;
	searchString?: string | undefined;
};

export type SearchResult = {
	inNames: Set<string>;
	inText: Set<string>;
	withMissingVariants: Set<string>;
	withMissingVariantsPerLanguage: {
		[language in Locale]?: Set<string>;
	};
	withProblems: Set<string>;
	withMissingReview: Set<string>;
	matchingNames: Set<string>;
	referencedInFrame: Set<string>;
	referencedInLabels: Set<string>;
	matches: {
		[messageId: string]: {
			messageNameMatch: { start: number; length: number } | undefined;
			textMatches: {
				[language in Locale]?: {
					[gender in Gender]?: { [plural in Plural]?: { start: number; length: number } };
				};
			};
		};
	};
};

export default class MessageStoreMemory extends EventTarget {
	config: Config | undefined;

	inlangProject: InlangV3Project | undefined;

	parentKeyStore: InlangMessageStore;

	figmaRemote: FigmaUtil;

	constructor(parentKeyStore: InlangMessageStore, figmaRemote: FigmaUtil) {
		super();
		this.parentKeyStore = parentKeyStore;
		this.figmaRemote = figmaRemote;

		window.addEventListener("message", (event: MessageEvent) => {
			if (event.data.pluginMessage.target === "TranslationKeyStore") {
				if (event.data.pluginMessage.type === "cacheUpdate") {
					this.processCacheUpdate(event.data.pluginMessage.changedKeys);
				}
			}
		});
	}

	public async updateMessageLinks(messageIds: string[]) {
		// TODO #22 CACHING rethink message links
		/*
    const changes = {
      updated: [] as string[],
      changedKeys: messageIds,
    };

    for (const updatedKeyLink of messageIds) {
      const message = await this.parentKeyStore.getMessageAsync(updatedKeyLink);
      if (message) {
        this.upsertCache(message);
      }
    }

    const event = new CustomEvent<any>(MessageStoreMemory.updateEventName, { detail: changes });
    this.dispatchEvent(event);
    */
	}

	subscribeMessage(messageId: string, cb: (message: Message) => void) {
		return this.inlangProject?.subscribe(messageId, cb);
	}

	static UPDATE_EVENT = "updated";

	private async processCacheUpdate(changedMessages: {
		deleted: string[];
		added: string[];
		updated: string[];
	}) {
		const changes = {
			deleted: [] as string[],
			updated: [] as string[],
			added: [] as string[],
			changedKeys: [] as string[],
		};

		// An undo / redo of an import changes thousands of messages: handle them in batches, not one by one.
		await this.inlangProject?.deleteMany(changedMessages.deleted);
		changes.deleted.push(...changedMessages.deleted);
		changes.changedKeys.push(...changedMessages.deleted);

		const changedIds = [...changedMessages.updated, ...changedMessages.added];
		const freshMessages = await this.parentKeyStore.getMessagesAsync(changedIds);
		for (const messageId of changedIds) {
			if (!freshMessages[messageId]) {
				throw new Error(`fresh message does not exist... [${messageId}]`);
			}
		}
		await this.inlangProject?.upsertMany(changedIds.map((messageId) => freshMessages[messageId]!));
		changes.updated.push(...changedMessages.updated);
		changes.added.push(...changedMessages.added);
		changes.changedKeys.push(...changedIds);

		const event = new CustomEvent<any>(MessageStoreMemory.UPDATE_EVENT, { detail: changes });
		this.dispatchEvent(event);
	}

	getLanugages(): Locale[] | undefined {
		return this.config!.enabledLanguages;
	}

	/**
	 * The languages in the one order every view uses: the reference language first, then the target
	 * languages in the order of the Setup tab.
	 */
	getOrderedLanguages(): Locale[] {
		const refLanguage = this.config?.refLanguage;
		const targets = (this.config?.enabledLanguages ?? []).filter((l) => l !== refLanguage);
		return [...new Set([...(refLanguage ? [refLanguage] : []), ...targets])];
	}

	async setLanguages(languages: Locale[]) {
		const parentConfig = await this.parentKeyStore.getConfig();
		parentConfig.enabledLanguages = languages;
		this.config!.enabledLanguages = languages;

		await this.parentKeyStore.setConfig(parentConfig);

		// forwared languages to inlang project - if initialzied already
		await this.inlangProject?.setSettings({
			baseLocale: this.config!.refLanguage!,
			locales: languages as string[],
			modules: [],
		});
	}

	getRefLanugage(): Locale | undefined {
		return this.config!.refLanguage;
	}

	async setRefLanguage(language: Locale) {
		const parentConfig = await this.parentKeyStore.getConfig();
		this.config!.refLanguage = language;
		parentConfig.refLanguage = language;

		await this.parentKeyStore.setConfig(parentConfig);

		// forwared ref language to inlang project - if initialzied already
		await this.inlangProject?.setSettings({
			baseLocale: language,
			locales: this.config!.enabledLanguages as string[],
			modules: [],
		});
	}

	getMessage(id: string): Message | undefined {
		return this.inlangProject!.get(id);
	}

	getMessageByName(messageName: string): Message | undefined {
		return this.inlangProject!.get(messageName);
	}

	static toSearchString(searchQuery: SearchQuery): string {
		let searchString = "";
		if (searchQuery.selected === "FRAME") {
			searchString += "selected:FRAME ";
		}

		if (searchQuery.selected === "LABEL") {
			searchString += "selected:LABEL ";
		}

		if (searchQuery.hasLabel && searchQuery.hasLabel.length > 0) {
			searchString += `label:${searchQuery.hasLabel.join(" label:")} `;
		}

		if (searchQuery.oneLabelOf && searchQuery.oneLabelOf.length > 0) {
			searchString += `one_label_of:${searchQuery.oneLabelOf.join(",")} `;
		}

		if (searchQuery.unverified !== undefined) {
			searchString += `unverified:${searchQuery.unverified ? "true" : "false"} `;
		}

		if (searchQuery.missingTranslation === true && searchQuery.missingTranslationLanguage) {
			searchString += `missing_translation:${searchQuery.missingTranslationLanguage} `;
		} else if (searchQuery.missingTranslation !== undefined) {
			searchString += `missing_translation:${searchQuery.missingTranslation ? "true" : "false"} `;
		}

		if (searchQuery.translationProblems !== undefined) {
			searchString += `problems:${searchQuery.translationProblems ? "true" : "false"} `;
		}

		if (searchQuery.exactText === true) {
			searchString += "exact_text:true ";
		}

		if (searchQuery.name !== undefined) {
			searchString += `name:${searchQuery.name}`;
			if (!searchQuery.nameAtEnd) {
				searchString += " ";
			}
		}

		searchString += searchQuery.text;

		return searchString;
	}

	static toQueryObject(searchString: string): SearchQuery {
		const searchQueryObj = {
			selected: undefined,
			hasLabel: [],
			oneLabelOf: [],
			verified: undefined,
			name: undefined,
			nameAtEnd: false,
			text: "",
			exactText: false,
			searchString,
		} as SearchQuery;

		let processedInputString = searchString;

		// extract the text surrounded by quotest first:
		const textInQuotesRe = /"((?:[^"\\]|\\.)*)"(?![^\\]*\\)/g;
		const quotedTextMatches = processedInputString.match(textInQuotesRe);

		if (quotedTextMatches) {
			for (const quotedTextMatch of quotedTextMatches) {
				searchQueryObj.text += quotedTextMatch;
				processedInputString = searchString.split(quotedTextMatch).join("");
			}
		}

		// extract and remove all filters
		const filterRe = /((\b\w+:[^\s]+))\s/g;
		const filterMatches = processedInputString.match(filterRe);
		const filters = [] as string[];

		if (filterMatches) {
			for (const filterMatch of filterMatches!.sort((match) => match.length)) {
				const filterParts = filterMatch.split(" ").join("").split(":");
				if (filterParts[0] === "selected") {
					if (filterParts[1] === "FRAME") {
						searchQueryObj.selected = "FRAME";
					} else if (filterParts[1] === "LABEL") {
						searchQueryObj.selected = "LABEL";
					}
				} else if (filterParts[0] === "label" && filterParts.length > 1) {
					searchQueryObj.hasLabel!.push(filterParts[1]);
				} else if (filterParts[0] === "one_label_of" && filterParts.length > 1) {
					searchQueryObj.oneLabelOf = searchQueryObj.oneLabelOf!.concat(filterParts[1].split(","));
				} else if (filterParts[0] === "missing_translation" && filterParts.length > 1) {
					// missing_translation:true|false or missing_translation:<language>
					searchQueryObj.missingTranslation = filterParts[1] !== "false";
					if (filterParts[1] !== "true" && filterParts[1] !== "false") {
						searchQueryObj.missingTranslationLanguage = filterParts[1] as Locale;
					}
				} else if (filterParts[0] === "problems" && filterParts.length > 1) {
					searchQueryObj.translationProblems = filterParts[1] !== "false";
				} else if (filterParts[0] === "unverified" && filterParts.length > 1) {
					searchQueryObj.unverified = filterParts[1] === "true";
				} else if (filterParts[0] === "exact_text" && filterParts.length > 1) {
					searchQueryObj.exactText = filterParts[1] === "true";
				} else if (filterParts[0] === "name" && filterParts.length > 1) {
					searchQueryObj.name = filterParts.slice(1).join(":");
				} else {
					continue;
				}

				filters.push(filterMatch.split(" ").join(""));
				processedInputString = processedInputString.split(filterMatch).join("");
			}
		}

		if (!searchQueryObj.name) {
			// the regex expects a leading space - if we haven't found the name filter yet - try to find it at
			// the very end

			const nameAtTheEnd = /name:([^\s]+)$/g;
			const matches = processedInputString.match(nameAtTheEnd);
			if (matches) {
				searchQueryObj.name = matches[0].slice("name:".length);
				processedInputString = processedInputString.split(matches[0]).join("");
				searchQueryObj.nameAtEnd = true;
			}
		}

		// extract the rest as text if none was found previously
		if (searchQueryObj.text === "") {
			searchQueryObj.text = processedInputString;
		}

		return searchQueryObj;
	}

	/**
	 * what do we want to search
	 * "emission"
	 *  - all messageNames with "emission" in their name
	 * or
	 *  - all messageNames with "emission" in their text
	 * or
	 *  - all messageNames with a tag called "emmission"
	 *
	 * name:emision
	 *  - all messageNames with emmision in their name
	 *    - asterix not adding a lot of value
	 *
	 * text:"emision"
	 *  - all messageNames with emmision in thair text
	 *
	 * "translation:missing:de"
	 * "translation:complete"
	 *
	 * "one_tag_of:tag_a,tag_b,"
	 * "tag:tag_a"
	 *
	 * "verified:true"
	 *
	 *
	 * " verified:true "
	 *
	 * messageNames:asdasd_asdasd_asd
	 *
	 * all filter but text have no space, and a leading no space name spearated by colon
	 *
	 *
	 */
	findMessages(query: SearchQuery, selection?: NodeSelection): SearchResult {
		const results = {
			inNames: new Set<string>(),
			inText: new Set<string>(),
			withMissingVariants: new Set<string>(),
			withMissingVariantsPerLanguage: {} as {
				[language in Locale]?: Set<string>;
			},
			withProblems: new Set<string>(),
			withMissingReview: new Set<string>(),
			matchingNames: new Set<string>(),
			referencedInFrame: new Set<string>(),
			referencedInLabels: new Set<string>(),
			matches: {} as {
				[name: string]: {
					messageNameMatch: { start: number; length: number } | undefined;
					textMatches: {
						[language: string]: { [matches: string]: { start: number; length: number } };
					};
				};
			},
		};

		if (selection) {
			Object.values(selection).forEach((selectedNode) => {
				if (selectedNode.messageId !== undefined) {
					if (!selectedNode.directSelection) {
						results.referencedInLabels.add(selectedNode.messageId);
					}
					results.referencedInFrame.add(selectedNode.messageId);
				}
			});
		}

		if (!this.inlangProject) {
			return results;
		}

		// prepared by the translation checks: no message is checked here
		const missing =
			query.missingTranslation === undefined
				? undefined
				: this.inlangProject.checks.missing(query.missingTranslationLanguage);
		const problems =
			query.translationProblems === undefined ? undefined : this.inlangProject.checks.problems();

		for (const message of this.inlangProject!.getAllReadonly()) {
			if (missing?.has(message.id)) results.withMissingVariants.add(message.id);
			if (problems?.has(message.id)) results.withProblems.add(message.id);

			if (query.text === undefined || query.text === "") {
				results.matchingNames.add(message.id);
			} else {
				for (const messageVariant of message.variants) {
					const patternsLower = messageVariant.pattern
						.map((pattern) => {
							if (pattern.type === "Text") {
								return pattern.value.toLowerCase();
							}
							if (pattern.type === "VariableReference") {
								return pattern.name.toLowerCase();
							}
							return "";
						})
						.join("");

					const matchStartText = patternsLower.indexOf(query.text.toLowerCase());

					if (matchStartText !== -1) {
						if (!results.matches[message.id]) {
							results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
						}

						if (!results.matches[message.id].textMatches![messageVariant.languageTag]) {
							results.matches[message.id].textMatches![messageVariant.languageTag]! = {};
						}

						if (!results.matches[message.id].textMatches![messageVariant.languageTag]!["*"]) {
							results.inText.add(message.id);
							results.matchingNames.add(message.id);
							results.matches[message.id].textMatches![messageVariant.languageTag]!["*"] = {
								start: matchStartText,
								length: query.text.length,
							};
						}
					}
				}
			}

			if (query.name) {
				if (query.name !== "*") {
					const mameMatchStart = message.id.toLowerCase().indexOf(query.name.toLowerCase());

					if (mameMatchStart === 0) {
						if (!results.matches[message.id]) {
							results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
						}
						results.matches[message.id].messageNameMatch = {
							start: mameMatchStart,
							length: query.name.length,
						};
						results.inNames.add(message.id);
					} else {
						results.matchingNames.delete(message.id);
					}
				}
			} else if (query.text !== undefined && query.text !== "") {
				const nameMatchStart = message.id.toLowerCase().indexOf(query.text.toLowerCase());
				if (nameMatchStart !== -1) {
					if (!results.matches[message.id]) {
						results.matches[message.id] = { textMatches: {}, messageNameMatch: undefined };
					}
					results.matches[message.id].messageNameMatch = {
						start: nameMatchStart,
						length: query.text.length,
					};
					results.inNames.add(message.id);
					results.matchingNames.add(message.id);
				}
			}
		}

		results.withMissingReview = new Set(
			[...results.withMissingReview].filter((x) => results.matchingNames.has(x)),
		);
		results.withMissingVariants = new Set(
			[...results.withMissingVariants].filter((x) => results.matchingNames.has(x)),
		);
		results.withProblems = new Set(
			[...results.withProblems].filter((x) => results.matchingNames.has(x)),
		);

		if (query.missingTranslation === true) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => results.withMissingVariants.has(x)),
			);
		} else if (query.missingTranslation === false) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => !results.withMissingVariants.has(x)),
			);
		}

		if (query.translationProblems === true) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => results.withProblems.has(x)),
			);
		} else if (query.translationProblems === false) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => !results.withProblems.has(x)),
			);
		}

		if (query.unverified === true) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => results.withMissingReview.has(x)),
			);
		} else if (query.unverified === false) {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => !results.withMissingReview.has(x)),
			);
		}

		if (query.selected === "FRAME") {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => results.referencedInFrame.has(x)),
			);
		} else if (query.selected === "LABEL") {
			results.matchingNames = new Set(
				[...results.matchingNames].filter((x) => results.referencedInLabels.has(x)),
			);
		}

		// in case we have no specific we want to suggest specific like
		// - matches in messageNames (n)
		// - matches in text (n)
		// - with missing messages (n)
		// - with missing review (n)
		return results;
	}

	getAllMessages() {
		return this.inlangProject?.getAllReadonly();
	}

	/** Messages without text in the language, or in any language (Inlang's translation checks). */
	countMissing(language?: Locale): number {
		return this.inlangProject?.checks.missing(language).size ?? 0;
	}

	/** Messages whose variables, markup or forms do not match the reference language. */
	countProblems(language?: Locale): number {
		return this.inlangProject?.checks.problems(language).size ?? 0;
	}

	/** The translation checks of a message (Inlang `checkBundle` diagnostics), reference language first. */
	getDiagnostics(messageId: string) {
		return this.inlangProject?.checks.get(messageId) ?? [];
	}

	async createTag() {
		/* TODO #17 versioning we skip this in inlang for now
    // TODO #18 we update the messages here - shouldn't we wait for the messaage bus instead?
    const tagId = this.historyTags.length;
    for (const messageId of Object.keys(this.messages)) {
      this.messages[messageId].historyTags[tagId] = this.messages[messageId].latestVersion;
    }

    this.historyTags[tagId] = await this.parentKeyStore.createTag(tagId, title, description);
    return this.historyTags[tagId];
    */
	}

	async upsertMessage(message: Message, _defaultParameters: MessageParameterValues) {
		// TODO #18 variables - store the default parameters for this message ( we no longer store them in the message it self )
		const previous = this.inlangProject?.get(message.id);
		await this.parentKeyStore.saveMessage(message);
		try {
			await this.inlangProject?.upsert(message);
		} catch (error) {
			if (previous) await this.parentKeyStore.saveMessage(previous);
			else await this.parentKeyStore.deleteMessage(message.id);
			throw error;
		}

		const changes = {
			deleted: [] as string[],
			updated: [] as string[],
			added: [] as string[],
			changedKeys: [] as string[],
		};

		changes.changedKeys.push(message.id);
		(previous ? changes.updated : changes.added).push(message.id);

		// make sure the event is fired after the messages returned the updated message
		setTimeout(() => {
			const event = new CustomEvent<any>(MessageStoreMemory.UPDATE_EVENT, { detail: changes });
			this.dispatchEvent(event);
		}, 1);

		return this.getMessage(message.id!)!;
	}

	async deleteMessage(id: string) {
		const previous = this.inlangProject?.get(id);
		await this.parentKeyStore.deleteMessage(id);
		try {
			await this.inlangProject?.delete(id);
		} catch (error) {
			if (previous) await this.parentKeyStore.saveMessage(previous);
			throw error;
		}

		// views listing the messages (e.g. the Messages tab) have to drop the deleted row
		this.dispatchEvent(
			new CustomEvent<any>(MessageStoreMemory.UPDATE_EVENT, {
				detail: { deleted: [id], updated: [], added: [], changedKeys: [id] },
			}),
		);
	}

	private async loadInlangProject() {
		await this.inlangProject?.close();
		// Lix starts while the messages are transferred from the plugin
		const messages = this.parentKeyStore.load();
		this.inlangProject = await InlangV3Project.open({
			settings: {
				baseLocale: this.config!.refLanguage!,
				locales: this.config!.enabledLanguages as string[],
				modules: [],
			},
			messages,
		});
		const inlangProjectSettings = await this.inlangProject.settings();
		await this.figmaRemote.setRootPluginData(
			"inlangProjectSettings",
			JSON.stringify(inlangProjectSettings),
		);
		const numberOfLinkedMessages = this.inlangProject.getAllReadonly().length.toString();
		await this.figmaRemote.setRootPluginData("numberOfMessages", numberOfLinkedMessages ?? "0");
	}

	async load(): Promise<Readonly<Message[]>> {
		this.config = await this.parentKeyStore.getConfig();

		if (this.config?.refLanguage === undefined) {
			return [];
		}

		await this.loadInlangProject();
		return this.inlangProject!.getAll();
	}

	// wrapper methods to centralize the integration of inlang in case of api changes

	static hasVariant(message: Message, targetLanguage: Locale, match?: string[]) {
		const variant = getVariant(message, { where: { languageTag: targetLanguage, match } });
		return variant !== undefined;
	}

	static hasTranslationInVariant(message: Message, targetLanguage: Locale, match?: string[]) {
		const variant = getVariant(message, { where: { languageTag: targetLanguage, match } });
		return variant !== undefined && variant.pattern.length > 0;
	}

	// static isVariantsTranslationOutdated(
	//   message: Message,
	//   sourceLanguage: Locale,
	//   targetLanguage: Locale,
	//   match?: string[],
	// ) {
	//   const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(message, sourceLanguage, match);
	//   const currentVariant = getVariant(message, { where: { languageTag: targetLanguage, match } });

	//   if (!currentVariant || blake.blake2sHex(sourceVariantPatternHTML) !== (currentVariant as any).translationSrcHash) {
	//     return true;
	//   }

	//   return false;
	// }

	static upsertVariantPatternHtml(
		message: Message,
		sourceLanguage: Locale | undefined,
		language: Locale,
		match: string[],
		patternHtml: string,
	) {
		// const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(message, sourceLanguage, match);
		const currentVariantClone = getVariant(message, { where: { languageTag: language, match } });
		// let variantPatternHTMLHash = '';
		let messageClone: Message;

		if (currentVariantClone) {
			// variantPatternHTMLHash = (blake.blake2sHex(sourceVariantPatternHTML));
			// XXX find the variant using language an pattern to be able to mutate it in place
			messageClone = updateVariantPattern(message, {
				where: { languageTag: language, match },
				data: MessageStoreMemory.patternHtmlToPattern(patternHtml),
			}).data!;
		} else {
			const tranlatedVariant = {
				languageTag: language,
				match,
				pattern: MessageStoreMemory.patternHtmlToPattern(patternHtml),
			};
			// add properties to variant
			// (tranlatedVariant as any).translationSrcHash = (blake.blake2sHex(sourceVariantPatternHTML));
			messageClone = createVariant(message, { data: tranlatedVariant }).data!;
		}

		// const updatedVariantClone = getVariant(message, { where: { languageTag: language, selectors: match } });
		// XXX this is uses json stringify on the variant to check if equal - sdk will change anyway and we change this
		// const mutableVariant = message.variants.find((variant) => variant.languageTag === updatedVariantClone?.languageTag && JSON.stringify(variant.match) === JSON.stringify(updatedVariantClone.match));
		// (mutableVariant as any).translationSrcHash = variantPatternHTMLHash;

		return messageClone;
	}

	static ongoingTranslationPromises = {} as {
		[messageId: string]: Promise<Message>;
	};

	static canTranslate(
		message: Message,
		sourceLanguage: Locale,
		targetLanguage: Locale,
		match: string[],
	) {
		// reasons:

		// TODO #35 target language not supported
		// TODO #35 source language not supported

		// source language not set in Message
		const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(
			message,
			sourceLanguage,
			match,
		);
		if (sourceVariantPatternHTML === undefined || sourceVariantPatternHTML === "") {
			return false;
		}
		return true;
	}

	static async upsertUsingAutoTranslateMessage(
		translator: TranslatorMachine,
		message: Message,
		sourceLanguage: Locale,
		targetLanguage: Locale,
		match: string[],
		triggersCTA: boolean,
	) {
		// // we combine multiple translaition promises of the same message that happen in a batch
		// if (MessageStoreMemory.ongoingTranslationPromises[message.id] !== undefined) {
		//   return MessageStoreMemory.ongoingTranslationPromises[message.id];
		// }
		//
		const sourceVariantPatternHTML = MessageStoreMemory.htmlForPattern(
			message,
			sourceLanguage,
			match,
		);
		// nothing to translate from: the text keeps its current text like any other untranslated text
		if (sourceVariantPatternHTML === undefined) throw new MachineTranslationUnavailableError();

		const translatedPattern = await translator.translate(
			sourceVariantPatternHTML,
			sourceLanguage as Locale,
			targetLanguage,
			triggersCTA,
		);

		// delete MessageStoreMemory.ongoingTranslationPromises[message.id];
		return this.upsertVariantPatternHtml(
			message,
			sourceLanguage,
			targetLanguage,
			match,
			translatedPattern!,
		);
	}

	static patternHtmlToPattern(patternHtml: string): Pattern {
		const result = [] as Pattern;

		const placeholders = PlaceholderHelper.extractPlaceholdersFromPatterHTML(patternHtml);

		let lastExtractionEnd = 0;

		for (const placeholder of placeholders) {
			if (placeholder.start > lastExtractionEnd) {
				result.push({
					type: "Text",
					value: patternHtml.substring(lastExtractionEnd, placeholder.start),
				});
			}
			result.push({
				type: "VariableReference",
				name: placeholder.placeholder.name,
			});
			lastExtractionEnd = placeholder.start + placeholder.length;
		}

		if (patternHtml.length > lastExtractionEnd) {
			result.push({
				type: "Text",
				value: patternHtml.substring(lastExtractionEnd, patternHtml.length),
			});
		}

		return result;
	}

	static patternToHtml(patterns: Pattern) {
		let html = "";
		// 8 inlang rich text - support other patterns or get rid of html representation
		for (const pattern of patterns) {
			if (pattern.type === "Text") {
				html += pattern.value;
			} else if (pattern.type === "VariableReference") {
				html += `<ph>${pattern.name}</ph>`;
			}
		}

		return html;
	}

	static htmlInLangugage(message: Message, language: string) {
		let html = undefined as string | undefined;

		const variantInLanguage = message.variants.find((variant) => variant.languageTag === language);
		if (variantInLanguage) {
			// TODO #18 inlang rich text - support other patterns or get rid of html representation
			for (const pattern of variantInLanguage.pattern) {
				if (pattern.type === "Text") {
					if (html === undefined) {
						html = "";
					}
					html += pattern.value;
				}
			}
		}

		return html;
	}

	static htmlForPattern(message: Message, languageTag: string, match?: string[]) {
		const variant = getVariant(message, { where: { languageTag, match } });
		if (!variant) {
			return undefined;
		}
		return this.patternToHtml(variant!.pattern);
	}

	/**
	 * The text a text layer shows for a language: the translation if there is one, otherwise (missing,
	 * cleared, or a machine translation that failed) the text of the fallback language - normally
	 * the reference language, else any text the message has - so a layer never ends up blank only
	 * because a translation is missing.
	 */
	static htmlForPatternWithFallback(
		message: Message,
		languageTag: string,
		fallbackLanguageTag: string | undefined,
		match?: string[],
	) {
		const html = this.htmlForPattern(message, languageTag, match);
		if ((html === undefined || html === "") && fallbackLanguageTag !== undefined) {
			const fallbackHtml = this.htmlForPattern(message, fallbackLanguageTag, match);
			if (fallbackHtml) {
				return fallbackHtml;
			}
			// A message created from a layer in a non-reference frame has no reference text: show the text
			// that exists instead of blanking the layer.
			for (const variant of message.variants) {
				const existingHtml = this.htmlForPattern(message, variant.languageTag, match);
				if (existingHtml) {
					return existingHtml;
				}
			}
			return fallbackHtml ?? html;
		}
		return html;
	}

	static getBestExistingVariant(
		message: Message,
		languageTag: string,
		fallbackLanguageTags: string[],
		match?: string[],
	) {
		const variant = getVariant(message, { where: { languageTag, match } });
		if (!variant) {
			for (const fallbackLanguageTag of fallbackLanguageTags) {
				const fallbackVariant = getVariant(message, {
					where: { languageTag: fallbackLanguageTag, match },
				});
				if (fallbackVariant !== undefined) {
					return fallbackVariant;
				}
			}
		}
		return variant;
	}

	static refLanguageHash(message: Message, language: string, match?: string[]) {
		const variant = getVariant(message, { where: { languageTag: language, match } });
		if (variant) {
			return (variant as any).refLanguageHash as string;
		}

		return undefined;
	}
}
