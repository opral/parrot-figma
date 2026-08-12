import type { Message } from "../LegacyMessage";
import { Locale } from "../variants/Locale";
import { FigmaBundleStore, LEGACY_MESSAGE_PREFIX } from "./FigmaBundleStore";
import { bundleToLegacyMessage, legacyMessageToBundle } from "./LegacyMessageBundleConverter";
import { migrateLegacyMessagesToBundles } from "../../migrations/migrateLegacyMessagesToBundles";

export interface Config {
	refLanguage?: Locale;
	enabledLanguages?: Locale[];
}

const defaultStringFillinValue = "Loren Impsum";
const defaultDecimalFillinValue = 7;
const defaultFloatFillinValue = Math.PI;

export class InlangMessageStore {
	public proxyClassName = "InlangMessageStore";

	public static configDataKey = "prt_ic";

	/**
	 * we store a version map here:
	 * [
	 *  { name: 'v-1.0.0', description: '', id: string? },
	 * ]
	 */
	public static tagsDataKey = "prt_t";

	/**
	 * Legacy v1-message prefix retained only for migration discovery.
	 */
	public static messagePrefix = LEGACY_MESSAGE_PREFIX;

	private bundleStore?: FigmaBundleStore;

	messageIdToLabels = {} as {
		[messageId: string]: Set<string>;
	};

	constructor(asProxy: boolean) {
		if (!asProxy) {
			migrateLegacyMessagesToBundles(figma.root);
			this.bundleStore = new FigmaBundleStore({
				root: figma.root,
				documentChanges: figma,
			});
			this.bundleStore.subscribe((changedKeys) => {
				figma.ui.postMessage({
					target: "TranslationKeyStore",
					type: "cacheUpdate",
					changedKeys,
				});
			});
		}
	}

	getConfigSync() {
		const messageRaw = figma.root.getPluginData(InlangMessageStore.configDataKey);

		if (messageRaw === "" || !messageRaw) {
			return {
				refLanguage: undefined,
				enabledLanguages: [],
			} as Config;
		}

		return JSON.parse(messageRaw) as Config;
	}

	async getConfig() {
		return this.getConfigSync();
	}

	async setConfig(languageConfig: Config) {
		figma.root.setPluginData(InlangMessageStore.configDataKey, JSON.stringify(languageConfig));
	}

	async saveMessage(message: Message): Promise<void> {
		this.getBundleStore().put(legacyMessageToBundle(message));
	}

	async deleteMessage(id: string): Promise<void> {
		this.getBundleStore().delete(id);
	}

	async compareAndSwapMessage(expected: Message | undefined, replacement: Message | undefined) {
		const id = expected?.id ?? replacement?.id;
		if (!id) return false;
		if (JSON.stringify(this.getMessage(id)) !== JSON.stringify(expected)) return false;
		if (replacement) this.getBundleStore().put(legacyMessageToBundle(replacement));
		else this.getBundleStore().delete(id);
		return true;
	}

	async getMessageAsync(messageId: string) {
		return this.getMessage(messageId);
	}

	getMessage(messageId: string) {
		const bundle = this.getBundleStore().get(messageId);
		return bundle ? bundleToLegacyMessage(bundle) : undefined;
	}

	async load(): Promise<Message[]> {
		return this.getBundleStore().load().map(bundleToLegacyMessage);
	}

	async commitUndo() {
		return figma.commitUndo();
	}

	private getBundleStore() {
		if (!this.bundleStore) throw new Error("Figma bundle store is only available in the plugin");
		return this.bundleStore;
	}
}
