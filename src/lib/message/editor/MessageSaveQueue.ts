import type { Message } from "../LegacyMessage";

export type SaveOptions = {
	/** the save changes the forms of the message and is an undo step of its own */
	undoStep?: boolean;
};

type Edit = {
	/** the change, applied to the message as it is when the edit is saved (not when it was made) */
	update: (message: Message) => Message;
	typing: boolean;
	resolve: (message: Message) => void;
	reject: (error: unknown) => void;
};

/**
 * Every save of one message - typing in the editor, a form added or deleted, a change in the
 * "Plural & select" drawer - goes through this queue, one save after the other.
 *
 * An edit is applied to the message as left by the edits before it, when it is saved: a drawer change
 * made while a text save still runs contains that text, and text typed after a drawer change is saved
 * on top of the drawer's change. Neither edit can overwrite the other with an older message.
 *
 * Typing is faster than a save (it also rewrites the linked layers): text edits that arrive while a
 * save runs are merged into one save. A structural edit (`undoStep`) is a save of its own, so it stays
 * an undo step of its own.
 */
export class MessageSaveQueue {
	private latest: Message;

	private pending: Edit[] = [];

	private running = false;

	constructor(
		message: Message,
		private readonly save: (message: Message, options: SaveOptions) => Promise<void>,
	) {
		this.latest = message;
	}

	/** Edits are queued or being saved: a message rendered now is an echo of them, not news. */
	get busy() {
		return this.running || this.pending.length > 0;
	}

	/** The message with every saved edit (and the one being saved). */
	get message() {
		return this.latest;
	}

	/**
	 * The message was changed elsewhere (undo, the canvas, an import): later edits start from it.
	 * Ignored while edits are queued - what is stored then is an older state of our own edits.
	 */
	sync(message: Message) {
		if (!this.busy) this.latest = message;
	}

	/**
	 * Queues an edit. Resolves with the saved message, rejects if the edit cannot be applied or the
	 * save fails (the message then stays as it was before the edit).
	 */
	edit(update: (message: Message) => Message, options: SaveOptions = {}): Promise<Message> {
		return new Promise<Message>((resolve, reject) => {
			this.pending.push({ update, typing: !options.undoStep, resolve, reject });
			// edits of the same task (several change events of one action) are saved together
			if (!this.running) {
				this.running = true;
				queueMicrotask(() => void this.run());
			}
		});
	}

	private async run() {
		try {
			while (this.pending.length > 0) {
				// typing in a row is one save, a structural edit is a save of its own
				let count = 1;
				if (this.pending[0].typing)
					while (count < this.pending.length && this.pending[count].typing) count += 1;
				const group = this.pending.splice(0, count);
				await this.saveGroup(group, !group[0].typing);
			}
		} finally {
			this.running = false;
		}
	}

	private async saveGroup(group: Edit[], undoStep: boolean) {
		const before = this.latest;
		let next = before;
		const applied = [] as Edit[];
		for (const edit of group) {
			try {
				next = edit.update(next);
				applied.push(edit);
			} catch (error) {
				edit.reject(error);
			}
		}
		if (applied.length === 0) return;
		// set before saving: edits queued during the save start from this message
		this.latest = next;
		try {
			await this.save(next, { undoStep });
			for (const edit of applied) edit.resolve(next);
		} catch (error) {
			this.latest = before;
			for (const edit of applied) edit.reject(error);
		}
	}
}
