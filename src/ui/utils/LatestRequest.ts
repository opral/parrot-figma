/** Tracks whether an async request still represents the latest user selection. */
export class LatestRequest {
	private revision = 0;

	begin() {
		this.revision += 1;
		return this.revision;
	}

	isCurrent(revision: number) {
		return revision === this.revision;
	}
}
