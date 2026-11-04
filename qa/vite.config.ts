import { defineConfig } from "vite";
import path from "node:path";
export default defineConfig({
	build: {
		target: "es2017",
		minify: false,
		outDir: process.env.PROFILE_OUTPUT || "qa/migrated/dist",
		emptyOutDir: false,
		rollupOptions: {
			input: path.resolve(process.env.PROFILE_ENTRY || "qa/profile.ts"),
			output: { entryFileNames: process.env.PROFILE_FILE || "profile.js" },
		},
	},
});
