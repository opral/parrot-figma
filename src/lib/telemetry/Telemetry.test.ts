import { describe, expect, it } from "vitest";
import { buildCapturePayload, hashId, identifyTelemetry } from "./Telemetry";

describe("telemetry payload", () => {
	it("tags every event with the app and the hashed project, never raw ids", () => {
		identifyTelemetry({ userId: "figma-user-1", fileId: "file-1", version: "0.10.100" });
		const payload = buildCapturePayload({
			event: "project:project_view",
			distinctId: hashId("figma-user-1"),
			properties: { message_count: 12 },
			timestamp: "2026-10-08T00:00:00.000Z",
		});

		expect(payload.event).toBe("project:project_view");
		expect(payload.api_key).toMatch(/^phc_/);
		expect(payload.distinct_id).toBe(hashId("figma-user-1"));
		expect(payload.distinct_id).not.toContain("figma-user-1");
		expect(payload.properties).toEqual({
			app: "parrot",
			app_version: "0.10.100",
			project_id: hashId("file-1"),
			message_count: 12,
		});
	});
});
