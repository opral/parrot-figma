// import { MessageStoreFigmaRoot } from '../message/store/MessageStoreFigmaRoot';

import { Gender } from "../message/variants/Gender";
import { Plural } from "../message/variants/Plural";

import { InlangMessageStore } from "../message/store/InlangMessageStoreFigmaRoot";
import { MARKER_CHARACTER } from "../localizedlabels/LocalizedLabelManager";
import PlaceholderHelper from "../message/PlaceholderUtil";
import { MessageParameterValues } from "../message/MessageParameterValues";
import FigmaUtil from "../../shared/FigmaUtil";

// plugin data key of a label's parameter values - see LocalizedLabelManager.parameterValuesKey
const PARAMETER_VALUES_KEY = "pv";

export default class MigrationManager {
	private lastMigrationKey = "parrot_migration_executed";

	private figmaUtil: FigmaUtil;

	constructor(figmaUtil: FigmaUtil) {
		this.figmaUtil = figmaUtil;
	}

	public migrate() {
		const lastMigration = figma.root.getPluginData(this.lastMigrationKey);
		for (const migration of this.migrations) {
			if (this.isMigrationNeeded(lastMigration, migration.version)) {
				if (migration.migrate(migration.version)) {
					this.setPluginData(figma.root, this.lastMigrationKey, migration.version);
				}
			}
		}
	}

	private migrations = [
		{
			version: "0.10.71",

			migrate: (version: string) => {
				// CONFIG - migrate legacy config to new conifig
				const legacyConfigDataKey = "prt_c";
				const configDataKey = "prt_ic";

				const legacyConfigRaw = figma.root.getPluginData(legacyConfigDataKey);

				if (legacyConfigRaw === "") {
					// file is not yet configured for parrot - skip migration
				return true;
				}
				const config = JSON.parse(legacyConfigRaw);

				if (config.baseLanguage) {
					config.refLanguage = config.baseLanguage;
					delete config.baseLanguage;
					this.setPluginData(figma.root, configDataKey, JSON.stringify(config));
					this.setPluginData(figma.root, legacyConfigDataKey, "");
				}


				const patternHtmlToPattern = (patternHtml: string): any[] => {
					const result = [] as any[];

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
				};

				const migrateParrotMessageToInlangMessage = (legacyParrotMessage: any) => {
					const migratedMessage = {
						id: legacyParrotMessage.name,
						selectors: [],
						variants: [],
					} as any;

					// We didn't support gender nor plurals - its save to only migrate one variant
					for (const [language, genders] of Object.entries(legacyParrotMessage.variants)) {
						const neutralVariant = {
							languageTag: language,
							match: [],
							pattern: [],
						} as any;

						const textPreviousMigration = (genders as any)[Gender.NEUTRAL]?.[Plural.OTHER]?.text;
						if (textPreviousMigration) {
							neutralVariant.pattern = patternHtmlToPattern(textPreviousMigration);
							migratedMessage.variants.push(neutralVariant);
						}
					}

					return migratedMessage.variants.length > 0 ? migratedMessage : undefined;
				};

				// remove prt_t - tag data
				this.setPluginData(figma.root, "prt_t", "");

				// prt_m__{msg_id} -> prt_im__[msg_name]
				const messagePrefixOld = "prt_m__";

				// message history prefix
				const messageHistoryPrefix = "prt_mh_";

				// MESSAGE migrations
				const legacyIdToNameMap = {} as any;
				const allRootDataKeys = figma.root.getPluginDataKeys();
				for (const rootDataKey of allRootDataKeys) {
					// remove prt_mh_*
					if (rootDataKey.startsWith(messageHistoryPrefix)) {
						this.setPluginData(figma.root, rootDataKey, "");
					}

					if (rootDataKey.startsWith(messagePrefixOld)) {
						const messageId = rootDataKey.substring(messagePrefixOld.length);
						const legacyMessage = JSON.parse(figma.root.getPluginData(rootDataKey)) as any;

						if (legacyMessage.ref !== undefined) {
							// skip referencing messages - edgecase can be fixed by the usere easyly
						} else {
							const inlangMessage = migrateParrotMessageToInlangMessage(legacyMessage);
							if (inlangMessage) {
								this.setPluginData(
									figma.root,
									InlangMessageStore.messagePrefix + inlangMessage.id,
									JSON.stringify(inlangMessage),
								);
								// remove prt_m__{msg_id}
								this.setPluginData(figma.root, rootDataKey, "");
								legacyIdToNameMap[messageId] = inlangMessage.id;
							}
						}
					}
				}

				// LABEL migrations

				// lets not overcomplicate the migration - just mapp it to value + signalCharacter
				// {"what":{"value":"message"}} -> '{"message":{"name":"what","named":false}}'
				const migrateFillins = (legacyFillins: any) => {
					const fillinsToPlaceholder = {} as { [fillinValue: string]: any };
					const parameterValues = {} as MessageParameterValues;
					for (const [fillinName, fillinObj] of Object.entries(legacyFillins)) {
						const fillinValue = (fillinObj as any).value;
						fillinsToPlaceholder[fillinValue + MARKER_CHARACTER] = {
							name: fillinName,
							named: true,
							specifiedArgumentPosition: undefined,
						};
						parameterValues[fillinName] = { type: "string", value: fillinValue, default: false };
					}
					return { fillinsToPlaceholder, parameterValues };
				};

				const textNodesWitAnonymMessageToMigrate = (figma.root as any).findAllWithCriteria({
					pluginData: {
						keys: ["am"],
					},
				}) as TextNode[];

				for (const textNodeWitAnonymMessageToMigrate of textNodesWitAnonymMessageToMigrate) {
					if (textNodeWitAnonymMessageToMigrate.getPluginData("mi") !== "") {
						continue; // skip labels that have a message reference
					}


					// drop plural and gender properties in favour of future parameter
					this.setPluginData(textNodeWitAnonymMessageToMigrate, "mp", "");
					this.setPluginData(textNodeWitAnonymMessageToMigrate, "mg", "");
					// reset mv - former message version
					this.setPluginData(textNodeWitAnonymMessageToMigrate, "mt", "");

					const anonymousMessage = JSON.parse(
						textNodeWitAnonymMessageToMigrate.getPluginData("am"),
					);

					// migrate old anonymouse message
					const inlangMessage = migrateParrotMessageToInlangMessage(anonymousMessage);
					this.setPluginData(
						textNodeWitAnonymMessageToMigrate,
						"iam",
						JSON.stringify(inlangMessage),
					);
					this.setPluginData(textNodeWitAnonymMessageToMigrate, "am", "");

					const fillinRaw = textNodeWitAnonymMessageToMigrate.getPluginData("fi");
					if (fillinRaw !== "") {
						const legacyFillin = JSON.parse(fillinRaw);
						const fillinToPlaceholder = migrateFillins(legacyFillin);
						this.setPluginData(
							textNodeWitAnonymMessageToMigrate,
							"fitp",
							JSON.stringify(fillinToPlaceholder.fillinsToPlaceholder),
						);
						this.setPluginData(
							textNodeWitAnonymMessageToMigrate,
							PARAMETER_VALUES_KEY,
							JSON.stringify(fillinToPlaceholder.parameterValues),
						);
						this.setPluginData(textNodeWitAnonymMessageToMigrate, "fi", "");
					}
				}

				// go through all textnodes with references to messages and update to slot 0
				const textNodesWithReferenceToMigrate = (figma.root as any).findAllWithCriteria({
					pluginData: {
						keys: ["mi"],
					},
				}) as TextNode[];

				for (const textNodeWithReferenceToMigrate of textNodesWithReferenceToMigrate) {
					const legacyMessageId = textNodeWithReferenceToMigrate.getPluginData("mi");
					const messageName = legacyIdToNameMap[legacyMessageId];
					if (messageName) {
						this.setPluginData(textNodeWithReferenceToMigrate, "mn", messageName);
						this.setPluginData(textNodeWithReferenceToMigrate, `mn_${messageName}`, messageName);
					}


					// reset old mi - message id proerty
					this.setPluginData(textNodeWithReferenceToMigrate, "mi", "");
					// reset mp - plural no longer used - parameters in the future
					this.setPluginData(textNodeWithReferenceToMigrate, "mp", "");
					// reset mg - gender no longer used - parameters in the future
					this.setPluginData(textNodeWithReferenceToMigrate, "mg", "");
					// reset mt - former key/message type - the type of a label is now derived by its properties
					this.setPluginData(textNodeWithReferenceToMigrate, "mt", "");
					// reset mv - former message version
					this.setPluginData(textNodeWithReferenceToMigrate, "mt", "");

					// migrate old anonymouse message
					this.setPluginData(textNodeWithReferenceToMigrate, "am", "");

					const fillinRaw = textNodeWithReferenceToMigrate.getPluginData("fi");
					if (fillinRaw !== "") {
						const legacyFillin = JSON.parse(fillinRaw);
						const fillinToPlaceholder = migrateFillins(legacyFillin);

						this.setPluginData(
							textNodeWithReferenceToMigrate,
							"fitp",
							JSON.stringify(fillinToPlaceholder.fillinsToPlaceholder),
						);
						this.setPluginData(
							textNodeWithReferenceToMigrate,
							PARAMETER_VALUES_KEY,
							JSON.stringify(fillinToPlaceholder.parameterValues),
						);
						this.setPluginData(textNodeWithReferenceToMigrate, "fi", "");
					}
				}

					return true;
			},
		},
		{
			version: "0.10.101",

			// The 0.10.71 migration stored the fill-in values of migrated labels below the literal key
			// "parameterValuesKey" instead of "pv". The labels then forgot their values ("Welcome Anna!"
			// became "Welcome name!" after switching the language). Move the values to the right key.
			migrate: () => {
				const labelsWithMisplacedValues = (figma.root as any).findAllWithCriteria({
					pluginData: {
						keys: ["parameterValuesKey"],
					},
				}) as TextNode[];
				for (const label of labelsWithMisplacedValues) {
					const misplacedValues = label.getPluginData("parameterValuesKey");
					const currentValues = label.getPluginData(PARAMETER_VALUES_KEY);
					// do not overwrite values the user entered after the broken migration
					const hasUserValues =
						currentValues !== "" &&
						Object.values(JSON.parse(currentValues)).some((value: any) => value.default === false);
					if (misplacedValues !== "" && !hasUserValues) {
						this.setPluginData(label, PARAMETER_VALUES_KEY, misplacedValues);
					}
					this.setPluginData(label, "parameterValuesKey", "");
				}
				return true;
			},
		},
	];

	private setPluginData(node: BaseNodeMixin, dataKey: string, data: string) {
		console.log(`[${node.id}] setting ${dataKey} to ]${data}[`);
		node.setPluginData(dataKey, data);
	}

	private isMigrationNeeded(lastMigrationVersion: string, migrationVersion: string) {
		if (lastMigrationVersion === "") {
			return true;
		}

		const [majorMigrated, minorMigrated, figmaMigrated] = lastMigrationVersion.split(".");
		const [majorMigration, minorMigration, figmaMigration] = migrationVersion.split(".");

		if (parseInt(majorMigrated, 10) < parseInt(majorMigration, 10)) {
			return true;
		}

		if (parseInt(majorMigrated, 10) > parseInt(majorMigration, 10)) {
			return false;
		}

		if (parseInt(majorMigrated, 10) === parseInt(majorMigration, 10)) {
			if (parseInt(minorMigrated, 10) < parseInt(minorMigration, 10)) {
				return true;
			}

			if (parseInt(minorMigrated, 10) > parseInt(minorMigration, 10)) {
				return false;
			}

			if (parseInt(minorMigrated, 10) === parseInt(minorMigration, 10)) {
				if (parseInt(figmaMigrated, 10) < parseInt(figmaMigration, 10)) {
					return true;
				}

				return false;
			}
		}
	}
}
