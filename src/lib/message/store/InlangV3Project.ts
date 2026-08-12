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
			for (const message of args.messages) await session.upsert(message);
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
		await replaceBundleNested(this.project, bundle);
		this.messages.set(message.id, structuredClone(message));
		for (const listener of this.listeners.get(message.id) ?? []) {
			listener(structuredClone(message));
		}
	}

	async delete(id: string): Promise<void> {
		await deleteBundleNested(this.project, id);
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
		this.messages.clear();
		for (const bundle of bundles) {
			const message = bundleToLegacyMessage(bundle);
			this.messages.set(message.id, message);
		}
	}

	async close(): Promise<void> {
		await this.project.close();
		await this.lix.close();
	}
}

async function deleteBundleNested(project: InlangProject, bundleId: string) {
	const messages = await project.db
		.selectFrom("message")
		.select("id")
		.where("bundleId", "=", bundleId)
		.execute();
	const messageIds = new Set(messages.map((message) => message.id));
	const variants = await project.db.selectFrom("variant").select(["id", "messageId"]).execute();
	const statements = variants
		.filter((variant) => messageIds.has(variant.messageId))
		.map((variant) => project.db.deleteFrom("variant").where("id", "=", variant.id).compile());
	statements.push(
		...messages.map((message) =>
			project.db.deleteFrom("message").where("id", "=", message.id).compile(),
		),
		project.db.deleteFrom("bundle").where("id", "=", bundleId).compile(),
	);
	await executeLixBatch(project.db, statements);
}

async function replaceBundleNested(project: InlangProject, bundle: BundleNested) {
	const currentMessages = await project.db
		.selectFrom("message")
		.select("id")
		.where("bundleId", "=", bundle.id)
		.execute();
	const currentVariants = await project.db
		.selectFrom("variant")
		.innerJoin("message", "message.id", "variant.messageId")
		.select("variant.id")
		.where("message.bundleId", "=", bundle.id)
		.execute();
	const nextMessageIds = new Set(bundle.messages.map((message) => message.id));
	const nextVariantIds = new Set(
		bundle.messages.flatMap((message) => message.variants.map((variant) => variant.id)),
	);
	const statements = currentVariants
		.filter((variant) => !nextVariantIds.has(variant.id))
		.map((variant) => project.db.deleteFrom("variant").where("id", "=", variant.id).compile());
	statements.push(
		...currentMessages
			.filter((message) => !nextMessageIds.has(message.id))
			.map((message) => project.db.deleteFrom("message").where("id", "=", message.id).compile()),
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

	await executeLixBatch(project.db, statements);
}
