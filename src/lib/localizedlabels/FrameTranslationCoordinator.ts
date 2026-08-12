export type FrameTranslationOperation = {
	frameId: string;
	labelIds: readonly string[];
	applyLabel: (labelId: string) => Promise<void>;
	commitFrame: () => Promise<void>;
	commitUndo: () => Promise<void>;
};

/** Serializes each frame's mutations so awaited Figma writes cannot interleave. */
export class FrameTranslationCoordinator {
	private readonly queues = new Map<string, Promise<void>>();

	run(operation: FrameTranslationOperation): Promise<void> {
		const previous = this.queues.get(operation.frameId) ?? Promise.resolve();
		const current = previous
			.catch(() => undefined)
			.then(async () => {
				for (const labelId of operation.labelIds) await operation.applyLabel(labelId);
				await operation.commitFrame();
				await operation.commitUndo();
			});
		this.queues.set(operation.frameId, current);
		const clearCurrent = () => {
			if (this.queues.get(operation.frameId) === current) this.queues.delete(operation.frameId);
		};
		void current.then(clearCurrent, clearCurrent);
		return current;
	}
}
