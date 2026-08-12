import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import { viteStaticCopy } from "vite-plugin-static-copy"


export default defineConfig(({ mode }) => ({
  plugins: [
    viteSingleFile(),
    viteStaticCopy({
          targets: [
            {
              src: 'manifest.json',
              dest: '.'
            }
          ]
        }),
  ],
  build: {
    minify: mode === "production",
    sourcemap: mode !== "production" ? "inline" : false,
    target: "es2017",
    emptyOutDir: true,
    outDir: path.resolve("dist"),
    rollupOptions: {
      input: path.resolve("src/plugin/plugin.ts"),
      output: {
        entryFileNames: "plugin.js",
      },
    },
  },
  resolve: {
    alias: {
      // "@common": path.resolve("src/common"),
      "@plugin": path.resolve("src/plugin"),
    },
  },
}));
