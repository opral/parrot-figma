import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import figmaManifest from "../manifest.figma";

const manifest = JSON.parse(readFileSync("manifest.json", "utf8"));

describe("plugin manifest", () => {
	it("keeps the plugin id and the network access of manifest.json and manifest.figma.ts in sync", () => {
		expect(figmaManifest.id).toBe(manifest.id);
		expect(figmaManifest.networkAccess.allowedDomains).toEqual(manifest.networkAccess.allowedDomains);
		expect(figmaManifest.networkAccess.reasoning).toBe(manifest.networkAccess.reasoning);
	});

	it("allows the GitHub Pages origin that hosts the released UI (see .github/workflows/publish.yml)", () => {
		expect(manifest.networkAccess.allowedDomains).toContain("https://opral.github.io");
	});

	it("does not allow Figma profile picture hosts (only the hidden Users view showed them)", () => {
		expect(JSON.stringify(manifest.networkAccess)).not.toContain("s3-alpha.figma.com");
	});

	it("does not allow the retired Parrot hosts", () => {
		const hosts = JSON.stringify(manifest.networkAccess);
		expect(hosts).not.toContain("parrot-global.github.io");
		expect(hosts).not.toContain("api.parrot.global");
	});
});
