import fs from "node:fs";
import path from "node:path";
import { build } from "vite";
const manifest = JSON.parse(fs.readFileSync("manifest.json", "utf8"));
const legacy = process.argv.includes("--legacy");
const outDir = path.resolve(legacy ? "qa/legacy" : "qa/migrated");
fs.mkdirSync(outDir, { recursive: true });
for (const entry of ["profile", "e2e", "link-profile"]) {
	await build({
		configFile: path.resolve("qa/vite.config.ts"),
		build: {
			outDir: path.join(outDir, "dist"),
			rollupOptions: {
				input: path.resolve(`qa/${entry}.ts`),
				output: { entryFileNames: `${entry}.js` },
			},
		},
	});
	const qaManifest = {
		...manifest,
		name: `Parrot (${legacy ? "legacy" : "dynamic"} ${entry})`,
		main: `dist/${entry}.js`,
	};
	if (legacy) delete qaManifest.documentAccess;
	else qaManifest.documentAccess = "dynamic-page";
	fs.writeFileSync(
		path.join(outDir, entry === "profile" ? "manifest.json" : `${entry}-manifest.json`),
		JSON.stringify(qaManifest, null, 2),
	);
}
