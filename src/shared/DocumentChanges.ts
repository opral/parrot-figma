/** Root plugin data has no page-level event. Enable the root event only after background indexing. */
export class DocumentChanges {
	private listeners = new Set<(event: { documentChanges: readonly any[] }) => void>();
	private activating?: Promise<void>;
	public active = false;
	on(_type: "documentchange", listener: (event: { documentChanges: readonly any[] }) => void) {
		this.listeners.add(listener);
	}
	off(_type: "documentchange", listener: (event: { documentChanges: readonly any[] }) => void) {
		this.listeners.delete(listener);
	}
	async activate() {
		return (this.activating ??= (async () => {
			// All existing pages were already loaded one at a time. This also handles a page added mid-scan,
			// and is required by Figma even when every page has individually been loaded.
			await figma.loadAllPagesAsync();
			this.active = true;
			figma.on("documentchange", (event) => this.emit(event));
			// Catch root writes by older Parrot clients while only page events were available.
			this.emit({
				documentChanges: [
					{
						type: "PROPERTY_CHANGE",
						id: figma.root.id,
						node: figma.root,
						origin: "REMOTE",
						properties: ["pluginData"],
					},
				],
			});
		})().catch((error) => {
			this.activating = undefined;
			this.active = false;
			throw error;
		}));
	}
	private emit(event: { documentChanges: readonly any[] }) {
		for (const listener of this.listeners) {
			try {
				listener(event);
			} catch (error) {
				console.error("Parrot root change failed", error);
			}
		}
	}
}
export const documentChanges = new DocumentChanges();
