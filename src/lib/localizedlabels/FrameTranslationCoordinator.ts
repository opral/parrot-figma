export type FrameTranslationOperation<TSnapshot = unknown> = {
	frameId: string;
	labelIds: readonly string[];
	capture: () => Promise<TSnapshot>;
	lockMutations: (locked: boolean) => Promise<void>;
	applyLabel: (labelId: string) => Promise<void>;
	commitFrame: () => Promise<void>;
	commitUndo: () => Promise<void>;
	rollback: (snapshot: TSnapshot) => Promise<void>;
};

/** Serializes all mutations because Figma's undo history is document-global. */
export class FrameTranslationCoordinator<TSnapshot = unknown> {
	private queue: Promise<void> = Promise.resolve();

	run(operation: FrameTranslationOperation<TSnapshot>): Promise<void> {
		const previous = this.queue;
		const current = previous
			.catch(() => undefined)
			.then(async () => {
				await operation.lockMutations(true);
				try {
					const snapshot = await operation.capture();
					try {
						for (const labelId of operation.labelIds) await operation.applyLabel(labelId);
						await operation.commitFrame();
						await operation.commitUndo();
					} catch (error) {
						try {
							await operation.rollback(snapshot);
						} catch (rollbackError) {
							throw new AggregateError([error, rollbackError], "Translation and rollback failed", {
								// eslint-disable-next-line preserve-caught-error -- the translation failure is intentionally primary
								cause: error,
							});
						}
						throw error;
					}
				} finally {
					await operation.lockMutations(false);
				}
			});
		this.queue = current;
		return current;
	}
}
