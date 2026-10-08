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

	static async open(args: {
		settings: ProjectSettings;
		messages: readonly Message[];
	}): Promise<InlangV3Project> {
		const lix = await openLix();
		try {
			const project = await openProject({ lix, settings: args.settings });
			const session = new InlangV3Project(project, lix);
			const bundles = args.messages.map(legacyMessageToBundle);
			await replaceBundlesNested(project, bundles, []);
			for (const bundle of bundles) {
				session.bundles.set(bundle.id, structuredClone(bundle));
			}
			for (const message of args.messages) {
				session.messages.set(message.id, structuredClone(message));
			}
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

	async delete(id: string): Promise<void> {
		await deleteBundleNested(this.project, id, this.bundles.get(id));
		this.bundles.delete(id);
		this.messages.delete(id);
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

async function deleteBundleNested(
	project: InlangProject,
	bundleId: string,
	bundle: BundleNested | undefined,
) {
	const messageIds = bundle?.messages.map((message) => message.id) ?? [];
	const statements = [];
	if (messageIds.length > 0) {
		statements.push(
			project.db.deleteFrom("variant").where("messageId", "in", messageIds).compile(),
			project.db.deleteFrom("message").where("id", "in", messageIds).compile(),
		);
	}
	statements.push(project.db.deleteFrom("bundle").where("id", "=", bundleId).compile());
	await executeLixBatch(project.db, statements);
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
