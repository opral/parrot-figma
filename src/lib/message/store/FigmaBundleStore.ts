import type { BundleNested } from "@inlang/sdk/browser";

export type { BundleNested } from "@inlang/sdk/browser";

export const FIGMA_BUNDLE_PREFIX = "prt_ib__";
export const FIGMA_BUNDLE_MIGRATION_KEY = "prt_ib_migration_v1";
export const LEGACY_MESSAGE_PREFIX = "prt_im__";

const MAX_PLUGIN_DATA_BYTES = 100_000;

const LOCAL_CHANGE_CHECK_DELAY_MS = 300;

function encodeUtf8(value: string): Uint8Array {
	const bytes: number[] = [];
	for (const character of value) {
		const codePoint = character.codePointAt(0)!;
		if (codePoint <= 0x7f) {
			bytes.push(codePoint);
		} else if (codePoint <= 0x7ff) {
			bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
		} else if (codePoint <= 0xffff) {
			bytes.push(
				0xe0 | (codePoint >> 12),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
		} else {
			bytes.push(
				0xf0 | (codePoint >> 18),
				0x80 | ((codePoint >> 12) & 0x3f),
				0x80 | ((codePoint >> 6) & 0x3f),
				0x80 | (codePoint & 0x3f),
			);
		}
	}
	return Uint8Array.from(bytes);
}

export type BundleSelector = BundleNested["messages"][number]["selectors"][number];
export type BundlePatternElement =
	BundleNested["messages"][number]["variants"][number]["pattern"][number];

export type BundleChangeSet = {
	added: string[];
	updated: string[];
	deleted: string[];
};

type PluginDataRoot = Pick<
	DocumentNode,
	"id" | "getPluginData" | "getPluginDataKeys" | "setPluginData"
>;

type DocumentChangeSource = {
	on(type: "documentchange", callback: (event: any) => void): void;
	off?(type: "documentchange", callback: (event: any) => void): void;
};

export class FigmaBundleStore {
	private readonly root: PluginDataRoot;

	private readonly documentChanges?: DocumentChangeSource;

	private readonly listeners = new Set<(changes: BundleChangeSet) => void>();

	/** The stored JSON of every bundle - comparing the strings is far cheaper than hashing them. */
	private stored = new Map<string, string>();

	/** Local plugin-data changes are checked once when they stop coming (see `scheduleLocalChangeCheck`). */
	private localChangeTimer: ReturnType<typeof setTimeout> | undefined;

	private readonly handleDocumentChange = (event: any) => {
		if (!event.documentChanges.some((change: any) => this.isRemoteRootPluginDataChange(change))) {
			if (event.documentChanges.some((change: any) => this.isRootPluginDataChange(change))) {
				this.scheduleLocalChangeCheck();
			}
			return;
		}

		this.refreshAndNotify(true);
	};

	private refreshAndNotify(validate: boolean) {
		try {
			const changes = this.refreshHashes(validate);
			if (changes.added.length || changes.updated.length || changes.deleted.length) {
				for (const listener of this.listeners) listener(changes);
			}
		} catch (error) {
			console.error("Failed to apply a remote Parrot bundle update", error);
		}
	}

	/**
	 * Cmd+Z / Cmd+Shift+Z change the plugin data of the document without this store writing it. The
	 * writes of this store are already remembered in `stored`, so a difference means the data was
	 * changed from the outside (an undo/redo) and whoever holds a copy has to follow. Reading every
	 * bundle is not free for big files and a language switch writes plugin data many times: check once
	 * the changes stopped coming.
	 */
	private scheduleLocalChangeCheck() {
		clearTimeout(this.localChangeTimer);
		this.localChangeTimer = setTimeout(() => {
			this.localChangeTimer = undefined;
			this.refreshAndNotify(false);
		}, LOCAL_CHANGE_CHECK_DELAY_MS);
	}

	constructor(args: { root: PluginDataRoot; documentChanges?: DocumentChangeSource }) {
		this.root = args.root;
		this.documentChanges = args.documentChanges;
		// A big file has thousands of bundles and the sandbox shares Figma's main thread: only remember
		// what is stored now. Validation happens when the bundles are loaded.
		this.refreshHashes(false);
		this.documentChanges?.on("documentchange", this.handleDocumentChange);
	}

	dispose() {
		clearTimeout(this.localChangeTimer);
		this.documentChanges?.off?.("documentchange", this.handleDocumentChange);
		this.listeners.clear();
	}

	subscribe(listener: (changes: BundleChangeSet) => void) {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	get(bundleId: string): BundleNested | undefined {
		const raw = this.root.getPluginData(this.key(bundleId));
		if (!raw) return undefined;
		return parseBundle(raw, bundleId);
	}

	load(): BundleNested[] {
		return this.bundleKeys()
			.map((key) => parseBundle(this.root.getPluginData(key), this.idFromKey(key)))
			.sort((left, right) => left.id.localeCompare(right.id));
	}

	put(bundle: BundleNested) {
		const raw = serializeBundle(bundle);
		this.root.setPluginData(this.key(bundle.id), raw);
		this.stored.set(bundle.id, raw);
	}

	delete(bundleId: string) {
		this.root.setPluginData(this.key(bundleId), "");
		this.stored.delete(bundleId);
	}

	private refreshHashes(validate: boolean): BundleChangeSet {
		const next = new Map<string, string>();
		const added: string[] = [];
		const updated: string[] = [];

		for (const key of this.bundleKeys()) {
			const id = this.idFromKey(key);
			const raw = this.root.getPluginData(key);
			if (validate) parseBundle(raw, id);
			next.set(id, raw);
			if (!this.stored.has(id)) added.push(id);
			else if (this.stored.get(id) !== raw) updated.push(id);
		}

		const deleted = [...this.stored.keys()].filter((id) => !next.has(id));
		this.stored = next;
		return { added, updated, deleted };
	}

	private bundleKeys() {
		return this.root
			.getPluginDataKeys()
			.filter((key) => key.startsWith(FIGMA_BUNDLE_PREFIX))
			.sort();
	}

	private key(bundleId: string) {
		return FIGMA_BUNDLE_PREFIX + bundleId;
	}

	private idFromKey(key: string) {
		return key.slice(FIGMA_BUNDLE_PREFIX.length);
	}

	private isRootPluginDataChange(change: any) {
		return (
			change.type === "PROPERTY_CHANGE" &&
			change.node.id === this.root.id &&
			change.properties.includes("pluginData")
		);
	}

	private isRemoteRootPluginDataChange(change: any) {
		return change.origin === "REMOTE" && this.isRootPluginDataChange(change);
	}
}

export function serializeBundle(bundle: BundleNested): string {
	validateBundleNested(bundle);
	const raw = JSON.stringify(bundle);
	if (encodeUtf8(raw).byteLength > MAX_PLUGIN_DATA_BYTES) {
		throw new Error(
			`Bundle "${bundle.id}" exceeds Figma's ${MAX_PLUGIN_DATA_BYTES} byte plugin-data limit`,
		);
	}
	return raw;
}

export function parseBundle(raw: string, expectedId?: string): BundleNested {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch (cause) {
		throw new Error(`Stored Parrot bundle is not valid JSON`, { cause });
	}
	validateBundleNested(value);
	if (expectedId !== undefined && value.id !== expectedId) {
		throw new Error(`Bundle key "${expectedId}" contains bundle "${value.id}"`);
	}
	return value;
}

export function validateBundleNested(value: unknown): asserts value is BundleNested {
	if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
		throw new Error("Bundle must have a non-empty id");
	}
	if (!Array.isArray(value.declarations) || !Array.isArray(value.messages)) {
		throw new Error(`Bundle "${value.id}" is missing declarations or messages`);
	}
	for (const declaration of value.declarations) {
		if (!validDeclaration(declaration)) {
			throw new Error(`Bundle "${value.id}" contains an invalid declaration`);
		}
	}

	const declarationNames = new Set(value.declarations.map((d) => d.name));
	if (declarationNames.size !== value.declarations.length)
		throw new Error("Variable names must be unique");
	function checkReferences(node: unknown): void {
		if (Array.isArray(node)) {
			node.forEach(checkReferences);
			return;
		}
		if (!isRecord(node)) return;
		if (node.type === "variable-reference" && !declarationNames.has(node.name)) {
			throw new Error(`Variable "${node.name}" is still referenced and needs a declaration.`);
		}
		Object.values(node).forEach(checkReferences);
	}
	checkReferences(value.declarations);
	checkReferences(value.messages);

	const messageIds = new Set<string>();
	for (const message of value.messages) {
		if (
			!isRecord(message) ||
			typeof message.id !== "string" ||
			message.bundleId !== value.id ||
			typeof message.locale !== "string" ||
			!Array.isArray(message.selectors) ||
			!Array.isArray(message.variants)
		) {
			throw new Error(`Bundle "${value.id}" contains an invalid message`);
		}
		if (messageIds.has(message.id)) throw new Error(`Duplicate message id "${message.id}"`);
		messageIds.add(message.id);

		const selectorNames = message.selectors.map((selector) => {
			if (
				!isRecord(selector) ||
				selector.type !== "variable-reference" ||
				typeof selector.name !== "string"
			) {
				throw new Error(`Message "${message.id}" contains an invalid selector`);
			}
			return selector.name;
		});

		const variantIds = new Set<string>();
		for (const variant of message.variants) {
			if (
				!isRecord(variant) ||
				typeof variant.id !== "string" ||
				variant.messageId !== message.id ||
				!Array.isArray(variant.matches) ||
				!Array.isArray(variant.pattern)
			) {
				throw new Error(`Message "${message.id}" contains an invalid variant`);
			}
			if (variantIds.has(variant.id)) throw new Error(`Duplicate variant id "${variant.id}"`);
			variantIds.add(variant.id);

			const matchKeys = variant.matches.map((match) => {
				if (
					!isRecord(match) ||
					typeof match.key !== "string" ||
					(match.type !== "literal-match" && match.type !== "catchall-match") ||
					(match.type === "literal-match" && typeof match.value !== "string")
				) {
					throw new Error(`Variant "${variant.id}" contains an invalid match`);
				}
				return match.key;
			});
			if (
				matchKeys.length !== selectorNames.length ||
				selectorNames.some((name) => !matchKeys.includes(name)) ||
				new Set(matchKeys).size !== matchKeys.length
			) {
				throw new Error(`Variant "${variant.id}" must match every selector exactly once`);
			}
			if (!variant.pattern.every(validPatternElement)) {
				throw new Error(`Variant "${variant.id}" contains an invalid pattern`);
			}
		}
	}
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Match the SDK pattern schema without loading its worker runtime in Figma's sandbox.
function validArgument(value: unknown): boolean {
	return (
		isRecord(value) &&
		((value.type === "variable-reference" && typeof value.name === "string") ||
			(value.type === "literal" && typeof value.value === "string"))
	);
}
function validOptions(value: unknown): boolean {
	return (
		Array.isArray(value) &&
		value.every(
			(option) =>
				isRecord(option) && typeof option.name === "string" && validArgument(option.value),
		)
	);
}
function validAnnotation(value: unknown): boolean {
	return (
		value === undefined ||
		(isRecord(value) &&
			value.type === "function-reference" &&
			typeof value.name === "string" &&
			validOptions(value.options))
	);
}
function validExpression(value: unknown): boolean {
	return (
		isRecord(value) &&
		value.type === "expression" &&
		validArgument(value.arg) &&
		validAnnotation(value.annotation)
	);
}
function validDeclaration(value: unknown): boolean {
	return (
		isRecord(value) &&
		typeof value.name === "string" &&
		(value.type === "input-variable"
			? validAnnotation(value.annotation)
			: value.type === "local-variable" && validExpression(value.value))
	);
}
function validPatternElement(value: unknown): boolean {
	if (!isRecord(value)) return false;
	if (value.type === "text") return typeof value.value === "string";
	if (value.type === "expression") return validExpression(value);
	return (
		["markup-start", "markup-end", "markup-standalone"].includes(value.type) &&
		typeof value.name === "string" &&
		(value.options === undefined || validOptions(value.options)) &&
		(value.attributes === undefined ||
			(Array.isArray(value.attributes) &&
				value.attributes.every(
					(attribute) =>
						isRecord(attribute) &&
						typeof attribute.name === "string" &&
						(attribute.value === true ||
							(isRecord(attribute.value) &&
								attribute.value.type === "literal" &&
								typeof attribute.value.value === "string")),
				)))
	);
}
