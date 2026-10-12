export default class Monitoring {
	sentry: any | undefined;

	static instance: Monitoring | undefined;

	constructor(sentry?: any) {
		Monitoring.instance = this;

		if (!sentry) {
			this.sentry = undefined;
			// proxy!
			return;
		}

		this.sentry = sentry;
	}

	async sentryCaptureMesage(message: string) {
		this.sentry?.captureMessage(message);
	}

	async sentryCaptureException(error: Error, extra: any) {
		this.sentry?.captureException(error, extra);
	}
}
