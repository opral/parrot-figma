import type { Message } from "../message/LegacyMessage";
import {
	FIGMA_BUNDLE_MIGRATION_KEY,
	FIGMA_BUNDLE_PREFIX,
	LEGACY_MESSAGE_PREFIX,
	parseBundle,
	serializeBundle,
	validateBundleNested,
} from "../message/store/FigmaBundleStore";
import {
	bundleToLegacyMessage,
	legacyMessageToBundle,
} from "../message/store/LegacyMessageBundleConverter";

type PluginDataRoot = Pick<DocumentNode, "getPluginData" | "getPluginDataKeys" | "setPluginData">;

export type BundleMigrationResult = {
	status: "already-migrated" | "migrated";
	migratedBundles: number;
};

export function migrateLegacyMessagesToBundles(root: PluginDataRoot): BundleMigrationResult {
	const legacyKeys = root
		.getPluginDataKeys()
		.filter((key) => key.startsWith(LEGACY_MESSAGE_PREFIX))
		.sort();
	if (legacyKeys.length === 0) {
		const alreadyMigrated = root.getPluginData(FIGMA_BUNDLE_MIGRATION_KEY) !== "";
		if (!alreadyMigrated) {
			root.setPluginData(
				FIGMA_BUNDLE_MIGRATION_KEY,
				JSON.stringify({ version: 1, migratedBundles: 0 }),
			);
		}
		return {
			status: alreadyMigrated ? "already-migrated" : "migrated",
			migratedBundles: 0,
		};
	}

	const writes = legacyKeys.map((legacyKey) => {
		const raw = root.getPluginData(legacyKey);
		let message: Message;
		try {
			message = JSON.parse(raw) as Message;
		} catch (cause) {
			throw new Error(`Legacy message in "${legacyKey}" is not valid JSON`, { cause });
		}
		const expectedId = legacyKey.slice(LEGACY_MESSAGE_PREFIX.length);
		if (message.id !== expectedId) {
			throw new Error(`Legacy key "${expectedId}" contains message "${message.id}"`);
		}
		const bundle = legacyMessageToBundle(message);
		validateBundleNested(bundle);
		const roundtrip = bundleToLegacyMessage(bundle);
		if (!jsonEqual(roundtrip, normalizeLegacyMessage(message))) {
			throw new Error(`Legacy message "${message.id}" failed lossless migration validation`);
		}

		const destinationKey = FIGMA_BUNDLE_PREFIX + bundle.id;
		const existing = root.getPluginData(destinationKey);
		if (existing) {
			const existingBundle = parseBundle(existing, bundle.id);
			if (!jsonEqual(existingBundle, bundle)) {
				throw new Error(`Bundle "${bundle.id}" already exists with different data`);
			}
		}
		return { legacyKey, destinationKey, serialized: serializeBundle(bundle) };
	});

	const touchedKeys = [
		...new Set([
			...writes.flatMap((write) => [write.legacyKey, write.destinationKey]),
			FIGMA_BUNDLE_MIGRATION_KEY,
		]),
	];
	const before = new Map(touchedKeys.map((key) => [key, root.getPluginData(key)]));

	try {
		for (const write of writes) root.setPluginData(write.destinationKey, write.serialized);
		for (const write of writes) {
			const persisted = root.getPluginData(write.destinationKey);
			parseBundle(persisted, write.destinationKey.slice(FIGMA_BUNDLE_PREFIX.length));
			if (persisted !== write.serialized) {
				throw new Error(`Figma did not persist bundle "${write.destinationKey}" exactly`);
			}
		}

		for (const write of writes) root.setPluginData(write.legacyKey, "");
		if (writes.some((write) => root.getPluginData(write.legacyKey) !== "")) {
			throw new Error("Figma did not remove every legacy message");
		}

		root.setPluginData(
			FIGMA_BUNDLE_MIGRATION_KEY,
			JSON.stringify({ version: 1, migratedBundles: writes.length }),
		);
		return { status: "migrated", migratedBundles: writes.length };
	} catch (cause) {
		const rollbackErrors: unknown[] = [];
		for (const [key, value] of before) {
			try {
				root.setPluginData(key, value);
				if (root.getPluginData(key) !== value) {
					rollbackErrors.push(new Error(`Rollback verification failed for "${key}"`));
				}
			} catch (rollbackCause) {
				rollbackErrors.push(rollbackCause);
			}
		}
		const rollbackMessage = rollbackErrors.length
			? ` Rollback also failed for ${rollbackErrors.length} key(s).`
			: " Previous plugin data was restored.";
		throw new Error(`Parrot bundle migration failed.${rollbackMessage}`, { cause });
	}
}

function normalizeLegacyMessage(message: Message): Message {
	return {
		id: message.id,
		alias: message.alias ?? {},
		selectors: message.selectors,
		variants: message.variants,
	};
}

function jsonEqual(left: unknown, right: unknown) {
	return JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right));
}

function canonicalize(value: unknown): unknown {
	if (Array.isArray(value)) return value.map(canonicalize);
	if (typeof value !== "object" || value === null) return value;
	return Object.fromEntries(
		Object.entries(value)
			.sort(([left], [right]) => left.localeCompare(right))
			.map(([key, child]) => [key, canonicalize(child)]),
	);
}
