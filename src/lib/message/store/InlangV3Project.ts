import {
	openProject,
	executeLixBatch,
	selectBundleNested,
	type BundleNested,
	type InlangProject,
	type ProjectSettings,
} from "@inlang/sdk/browser";
import { openLix, type Lix } from "@inlang/sdk/lix";
import type { Message } from "../LegacyMessage";
import { bundleToLegacyMessage, legacyMessageToBundle } from "./LegacyMessageBundleConverter";

/**
 * Owns Parrot's session-local Lix and Inlang v3 project.
 *
 * Figma plugin data remains the durable store. This class keeps the live SDK
 * project hydrated and exposes the old synchronous message reads needed by the
 * current UI until that UI moves to nested bundles directly.
 */
export class InlangV3Project {
	private readonly messages = new Map<string, Message>();
	private readonly bundles = new Map<string, BundleNested>();
	private readonly listeners = new Map<string, Set<(message: Message) => void>>();

	private constructor(
		private readonly project: InlangProject,
		private readonly lix: Lix,
	) {}

	/**
	 * Takes ownership of `messages` (they are not copied). Starting Lix takes a while, so it runs
	 * while the messages are still being loaded when a promise is passed.
	 */
	static async open(args: {
		settings: ProjectSettings;
		messages: readonly Message[] | Promise<readonly Message[]>;
	}): Promise<InlangV3Project> {
		const lixPromise = openLix();
		let messages: readonly Message[];
		try {
			messages = await args.messages;
		} catch (error) {
			await (await lixPromise).close();
			throw error;
		}
		const lix = await lixPromise;
		try {
			const project = await openProject({ lix, settings: args.settings });
			const session = new InlangV3Project(project, lix);
			const bundles = messages.map(legacyMessageToBundle);
			await insertBundlesNested(project, bundles);
			for (const bundle of bundles) session.bundles.set(bundle.id, bundle);
			for (const message of messages) session.messages.set(message.id, message);
			return session;
		} catch (error) {
			await lix.close();
			throw error;
		}
	}

	get(id: string): Message | undefined {
		const message = this.messages.get(id);
		return message ? structuredClone(message) : undefined;
	}

	getAll(): Message[] {
		return [...this.messages.values()].map((message) => structuredClone(message));
	}

	/** Snapshot without copying every message - callers must not mutate the returned messages. */
	getAllReadonly(): Message[] {
		return [...this.messages.values()];
	}

	subscribe(id: string, listener: (message: Message) => void) {
		let listeners = this.listeners.get(id);
		if (!listeners) {
			listeners = new Set();
			this.listeners.set(id, listeners);
		}
		listeners.add(listener);
		return () => listeners!.delete(listener);
	}

	async upsert(message: Message): Promise<void> {
		const bundle = legacyMessageToBundle(message);
		const currentBundle = this.bundles.get(bundle.id);
		await replaceBundlesNested(this.project, [bundle], currentBundle ? [currentBundle] : []);
		this.bundles.set(bundle.id, structuredClone(bundle));
		this.messages.set(message.id, structuredClone(message));
		for (const listener of this.listeners.get(message.id) ?? []) {
			listener(structuredClone(message));
		}
	}

	/** One batch per chunk instead of one database round trip per message (an undone import has thousands). */
	async upsertMany(messages: Message[]): Promise<void> {
		const chunkSize = 200;
		for (let i = 0; i < messages.length; i += chunkSize) {
			const chunk = messages.slice(i, i + chunkSize);
			const bundles = chunk.map(legacyMessageToBundle);
			const currentBundles = bundles.flatMap((bundle) => this.bundles.get(bundle.id) ?? []);
			await replaceBundlesNested(this.project, bundles, currentBundles);
			bundles.forEach((bundle, index) => {
				this.bundles.set(bundle.id, structuredClone(bundle));
				this.messages.set(chunk[index]!.id, structuredClone(chunk[index]!));
			});
			chunk.forEach((message) => {
				for (const listener of this.listeners.get(message.id) ?? []) {
					listener(structuredClone(message));
				}
			});
		}
	}

	async delete(id: string): Promise<void> {
		await this.deleteMany([id]);
	}

	async deleteMany(ids: string[]): Promise<void> {
		const chunkSize = 200;
		for (let i = 0; i < ids.length; i += chunkSize) {
			const chunk = ids.slice(i, i + chunkSize);
			await deleteBundlesNested(
				this.project,
				chunk.flatMap((id) => this.bundles.get(id) ?? []),
				chunk,
			);
			for (const id of chunk) {
				this.bundles.delete(id);
				this.messages.delete(id);
			}
		}
	}

	async settings(): Promise<ProjectSettings> {
		return this.project.settings.get();
	}

	async setSettings(settings: ProjectSettings): Promise<void> {
		await this.project.settings.set(settings);
	}

	async refreshFromProject(): Promise<void> {
		const bundles = await selectBundleNested(this.project.db).selectAll().execute();
		const nextBundles = new Map<string, BundleNested>();
		const nextMessages = new Map<string, Message>();
		for (const bundle of bundles) {
			const message = bundleToLegacyMessage(bundle);
			nextBundles.set(bundle.id, bundle);
			nextMessages.set(message.id, message);
		}
		this.bundles.clear();
		for (const [id, bundle] of nextBundles) this.bundles.set(id, bundle);
		this.messages.clear();
		for (const [id, message] of nextMessages) this.messages.set(id, message);
	}

	async close(): Promise<void> {
		await this.project.close();
		await this.lix.close();
	}
}

async function deleteBundlesNested(
	project: InlangProject,
	bundles: BundleNested[],
	bundleIds: string[],
) {
	const messageIds = bundles.flatMap((bundle) => bundle.messages.map((message) => message.id));
	const statements = [];
	if (messageIds.length > 0) {
		statements.push(
			project.db.deleteFrom("variant").where("messageId", "in", messageIds).compile(),
			project.db.deleteFrom("message").where("id", "in", messageIds).compile(),
		);
	}
	statements.push(project.db.deleteFrom("bundle").where("id", "in", bundleIds).compile());
	await executeLixBatch(project.db, statements);
}

/** Fills an empty project. Multi-row inserts keep the number of statements small for big files. */
async function insertBundlesNested(project: InlangProject, bundles: BundleNested[]) {
	const chunkSize = 200;
	const statements = [];
	const messages = bundles.flatMap((bundle) =>
		bundle.messages.map((message) => ({
			id: message.id,
			bundleId: bundle.id,
			locale: message.locale,
			selectors: message.selectors,
		})),
	);
	const variants = bundles.flatMap((bundle) =>
		bundle.messages.flatMap((message) =>
			message.variants.map((variant) => ({
				id: variant.id,
				messageId: message.id,
				matches: variant.matches,
				pattern: variant.pattern,
			})),
		),
	);
	for (let i = 0; i < bundles.length; i += chunkSize) {
		statements.push(
			project.db
				.insertInto("bundle")
				.values(
					bundles.slice(i, i + chunkSize).map(({ id, declarations }) => ({ id, declarations })),
				)
				.compile(),
		);
	}
	for (let i = 0; i < messages.length; i += chunkSize) {
		statements.push(
			project.db
				.insertInto("message")
				.values(messages.slice(i, i + chunkSize))
				.compile(),
		);
	}
	for (let i = 0; i < variants.length; i += chunkSize) {
		statements.push(
			project.db
				.insertInto("variant")
				.values(variants.slice(i, i + chunkSize))
				.compile(),
		);
	}
	if (statements.length > 0) await executeLixBatch(project.db, statements);
}

async function replaceBundlesNested(
	project: InlangProject,
	bundles: BundleNested[],
	currentBundles: BundleNested[],
) {
	if (bundles.length === 0) return;
	const bundleIds = new Set<string>();
	const nextMessageIds = new Set<string>();
	const nextVariantOwners = new Map<string, string>();
	for (const bundle of bundles) {
		if (bundleIds.has(bundle.id)) throw new Error(`Duplicate bundle id "${bundle.id}"`);
		bundleIds.add(bundle.id);
		for (const message of bundle.messages) {
			if (nextMessageIds.has(message.id)) {
				throw new Error(`Duplicate nested message id "${message.id}"`);
			}
			nextMessageIds.add(message.id);
			for (const variant of message.variants) {
				if (nextVariantOwners.has(variant.id)) {
					throw new Error(`Duplicate nested variant id "${variant.id}"`);
				}
				nextVariantOwners.set(variant.id, message.id);
			}
		}
	}

	const currentById = new Map(
		currentBundles
			.filter((bundle) => bundleIds.has(bundle.id))
			.map((bundle) => [bundle.id, bundle]),
	);
	const currentMessages = [...currentById.values()].flatMap((bundle) => bundle.messages);
	const statements = currentMessages.flatMap((message) =>
		message.variants
			.filter((variant) => nextVariantOwners.get(variant.id) !== message.id)
			.map((variant) => project.db.deleteFrom("variant").where("id", "=", variant.id).compile()),
	);
	statements.push(
		...currentMessages
			.filter((message) => !nextMessageIds.has(message.id))
			.map((message) => project.db.deleteFrom("message").where("id", "=", message.id).compile()),
	);

	for (const bundle of bundles) {
		statements.push(
			project.db
				.insertInto("bundle")
				.values({ id: bundle.id, declarations: bundle.declarations })
				.onConflict((conflict) =>
					conflict.column("id").doUpdateSet({ declarations: bundle.declarations }),
				)
				.compile(),
		);
		for (const message of bundle.messages) {
			statements.push(
				project.db
					.insertInto("message")
					.values({
						id: message.id,
						bundleId: bundle.id,
						locale: message.locale,
						selectors: message.selectors,
					})
					.onConflict((conflict) =>
						conflict.column("id").doUpdateSet({
							bundleId: bundle.id,
							locale: message.locale,
							selectors: message.selectors,
						}),
					)
					.compile(),
			);
			for (const variant of message.variants) {
				statements.push(
					project.db
						.insertInto("variant")
						.values({
							id: variant.id,
							messageId: message.id,
							matches: variant.matches,
							pattern: variant.pattern,
						})
						.onConflict((conflict) =>
							conflict.column("id").doUpdateSet({
								messageId: message.id,
								matches: variant.matches,
								pattern: variant.pattern,
							}),
						)
						.compile(),
				);
			}
		}
	}

	// A single Lix batch keeps startup hydration and edits atomic while avoiding
	// one database round-trip per legacy message.
	if (statements.length > 0) await executeLixBatch(project.db, statements);
}
