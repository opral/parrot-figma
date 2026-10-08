import blake from "blakejs";

/**
 * Anonymous usage telemetry, shared with the other inlang apps (Fink, Sherlock, Paraglide JS) in one
 * PostHog project. Events follow PostHog's `category:object_action` naming; the app is a property, not
 * part of the event name. Only counts and hashed ids are sent - never message texts, keys or file names.
 *
 * Events go through the reverse proxy on inlang.com, so the plugin only allowlists inlang.com.
 */
const CAPTURE_URL = "https://inlang.com/relay/i/v0/e/";
// write-only project token - safe to ship in a client
const POSTHOG_TOKEN = "phc_xTDR5yXmkYykE7mct3fgxqDSFcJdg4nELhqWwEkUzdLH";

export type TelemetryEvent =
	| "app:session_start"
	| "project:project_view"
	| "translation:language_update"
	| "messages:link_create"
	| "import:file_submit"
	| "export:file_create"
	| "cloud:interest_button_click";

type Properties = Record<string, string | number | boolean | undefined>;

let appVersion = "";
let distinctId: string | undefined;
let projectId: string | undefined;
// events captured before the user is known are sent once it is
let pending: { event: TelemetryEvent; properties: Properties; timestamp: string }[] = [];

export function hashId(id: string) {
	return blake.blake2sHex(id);
}

/** Dev builds stay out of the data (PostHog: keep development and production apart). */
function isEnabled() {
	return import.meta.env.PROD === true;
}

export function buildCapturePayload(args: {
	event: TelemetryEvent;
	distinctId: string;
	properties: Properties;
	timestamp: string;
}) {
	return {
		api_key: POSTHOG_TOKEN,
		event: args.event,
		distinct_id: args.distinctId,
		timestamp: args.timestamp,
		properties: {
			app: "parrot",
			app_version: appVersion,
			project_id: projectId,
			...args.properties,
		},
	};
}

function send(event: TelemetryEvent, properties: Properties, timestamp: string) {
	fetch(CAPTURE_URL, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(
			buildCapturePayload({ event, distinctId: distinctId!, properties, timestamp }),
		),
		keepalive: true,
	}).catch(() => {
		// telemetry never gets in the user's way
	});
}

/** Sets who and where: the Figma user and the file, both hashed. */
export function identifyTelemetry(args: {
	userId: string | null | undefined;
	fileId: string | null | undefined;
	version: string;
}) {
	appVersion = args.version;
	projectId = args.fileId ? hashId(args.fileId) : undefined;
	distinctId = args.userId ? hashId(args.userId) : undefined;
	if (!distinctId || !isEnabled()) return;
	for (const queued of pending) {
		send(queued.event, queued.properties, queued.timestamp);
	}
	pending = [];
}

export function capture(event: TelemetryEvent, properties: Properties = {}) {
	if (!isEnabled()) return;
	const timestamp = new Date().toISOString();
	if (!distinctId) {
		pending.push({ event, properties, timestamp });
		return;
	}
	send(event, properties, timestamp);
}
