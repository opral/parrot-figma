import blake from "blakejs";
import type { BundleNested } from "@inlang/sdk/browser";

export type { BundleNested } from "@inlang/sdk/browser";

export const FIGMA_BUNDLE_PREFIX = "prt_ib__";
export const FIGMA_BUNDLE_MIGRATION_KEY = "prt_ib_migration_v1";
export const LEGACY_MESSAGE_PREFIX = "prt_im__";

const MAX_PLUGIN_DATA_BYTES = 100_000;

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

	private hashes = new Map<string, string>();

	private readonly handleDocumentChange = (event: any) => {
		if (!event.documentChanges.some((change: any) => this.isRemoteRootPluginDataChange(change))) {
			return;
		}

		try {
			const changes = this.refreshHashes();
			if (changes.added.length || changes.updated.length || changes.deleted.length) {
				for (const listener of this.listeners) listener(changes);
			}
		} catch (error) {
			console.error("Failed to apply a remote Parrot bundle update", error);
		}
	};

	constructor(args: { root: PluginDataRoot; documentChanges?: DocumentChangeSource }) {
		this.root = args.root;
		this.documentChanges = args.documentChanges;
		this.refreshHashes();
		this.documentChanges?.on("documentchange", this.handleDocumentChange);
	}

	dispose() {
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
		this.hashes.set(bundle.id, hash(raw));
	}

	delete(bundleId: string) {
		this.root.setPluginData(this.key(bundleId), "");
		this.hashes.delete(bundleId);
	}

	private refreshHashes(): BundleChangeSet {
		const next = new Map<string, string>();
		const added: string[] = [];
		const updated: string[] = [];

		for (const key of this.bundleKeys()) {
			const id = this.idFromKey(key);
			const raw = this.root.getPluginData(key);
			parseBundle(raw, id);
			const nextHash = hash(raw);
			next.set(id, nextHash);
			if (!this.hashes.has(id)) added.push(id);
			else if (this.hashes.get(id) !== nextHash) updated.push(id);
		}

		const deleted = [...this.hashes.keys()].filter((id) => !next.has(id));
		this.hashes = next;
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

	private isRemoteRootPluginDataChange(change: any) {
		return (
			change.origin === "REMOTE" &&
			change.type === "PROPERTY_CHANGE" &&
			change.node.id === this.root.id &&
			change.properties.includes("pluginData")
		);
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
		if (!isDeclaration(declaration)) {
			throw new Error(`Bundle "${value.id}" contains an invalid declaration`);
		}
	}

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
			for (const element of variant.pattern) {
				if (!isPatternElement(element)) {
					throw new Error(`Variant "${variant.id}" contains an invalid pattern`);
				}
			}
		}
	}
}

function isDeclaration(value: unknown) {
	if (!isRecord(value) || typeof value.name !== "string") return false;
	if (value.type === "input-variable") {
		return value.annotation === undefined || isFunctionReference(value.annotation);
	}
	return value.type === "local-variable" && isExpression(value.value);
}

function isPatternElement(value: unknown) {
	if (!isRecord(value)) return false;
	if (value.type === "text") return typeof value.value === "string";
	if (value.type === "expression") return isExpression(value);
	if (
		value.type === "markup-start" ||
		value.type === "markup-end" ||
		value.type === "markup-standalone"
	) {
		return (
			typeof value.name === "string" &&
			(value.options === undefined ||
				(Array.isArray(value.options) && value.options.every(isOption))) &&
			(value.attributes === undefined ||
				(Array.isArray(value.attributes) && value.attributes.every(isAttribute)))
		);
	}
	return false;
}

function isExpression(value: unknown) {
	return (
		isRecord(value) &&
		value.type === "expression" &&
		isExpressionArgument(value.arg) &&
		(value.annotation === undefined || isFunctionReference(value.annotation))
	);
}

function isExpressionArgument(value: unknown) {
	return (
		isRecord(value) &&
		((value.type === "variable-reference" && typeof value.name === "string") ||
			(value.type === "literal" && typeof value.value === "string"))
	);
}

function isFunctionReference(value: unknown) {
	return (
		isRecord(value) &&
		value.type === "function-reference" &&
		typeof value.name === "string" &&
		Array.isArray(value.options) &&
		value.options.every(isOption)
	);
}

function isOption(value: unknown) {
	return isRecord(value) && typeof value.name === "string" && isExpressionArgument(value.value);
}

function isAttribute(value: unknown) {
	return (
		isRecord(value) &&
		typeof value.name === "string" &&
		(value.value === true ||
			(isRecord(value.value) &&
				value.value.type === "literal" &&
				typeof value.value.value === "string"))
	);
}

function hash(raw: string) {
	return blake.blake2sHex(encodeUtf8(raw));
}

function isRecord(value: unknown): value is Record<string, any> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
