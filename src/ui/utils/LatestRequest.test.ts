import { describe, expect, test } from "vitest";
import { LatestRequest } from "./LatestRequest";

describe("LatestRequest", () => {
	test("invalidates an earlier selection refresh when a newer one starts", () => {
		const requests = new LatestRequest();
		const earlier = requests.begin();
		const latest = requests.begin();

		expect(requests.isCurrent(earlier)).toBe(false);
		expect(requests.isCurrent(latest)).toBe(true);
	});
});
