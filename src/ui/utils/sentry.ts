import * as Sentry from "@sentry/react";
import posthog from "posthog-js";
import * as pjs from "../../../package.json";

// Bitwise operators are used to force conversion of  the string to a number
const SAMPLING = ~~process.env.SENTRY_SAMPLING! || 0.1;
const PROFILE_RATE = ~~process.env.SENTRY_PROFILE_SAMPLING! || 0.1;
const REPLAY_RATE = ~~process.env.SENTRY_REPLAY_SAMPLING! || 0;

export const replay = Sentry.replayIntegration({
	// Make sure we never leak any sensitive data
	maskAllText: true,
	blockAllMedia: true,
});

export const setupReplay = () => {
	Sentry.getReplay()?.startBuffering();
};

export const initializeSentry = () => {
	switch (process.env.ENVIRONMENT) {
		case "alpha":
		case "beta":
		case "production":
			Sentry.init({
				dsn: process.env.SENTRY_DSN,
				release: `parrot@${pjs.version}`,
				environment: process.env.ENVIRONMENT,
				tracesSampleRate: SAMPLING,
				profilesSampleRate: PROFILE_RATE,
				replaysSessionSampleRate: REPLAY_RATE,
				// We always want to replay errors
				replaysOnErrorSampleRate: 1.0,
				integrations: [
					Sentry.browserTracingIntegration(),
					replay,
					posthog.sentryIntegration({
						organization: "opral",
						projectId: 4507464642461696,
					}),
				],
			});
			break;
		default:
			break;
	}
};
