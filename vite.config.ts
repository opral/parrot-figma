import path from "node:path";
import fs from "node:fs";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import rawPlugin from 'vite-raw-plugin';

import { build, type ViteDevServer } from "vite";

const onConfigureServer = (server: ViteDevServer) => {
  let timer: ReturnType<typeof setTimeout>;
  let building = false;
  let pending = false;
  const rebuild = async () => {
    if (building) { pending = true; return; }
    const address = server.httpServer?.address();
    if (!address || typeof address === "string") return;
    building = true;
    try {
      await build({
        configFile: path.resolve("vite.config.plugin.ts"),
        define: { "import.meta.env.VITE_CUSTOM_URL": JSON.stringify(`http://localhost:${address.port}`) },
      });
    } catch (error) {
      server.config.logger.error(`Plugin build failed: ${error}`);
    } finally {
      building = false;
      if (pending) { pending = false; void rebuild(); }
    }
  };
  server.httpServer?.once("listening", () => void rebuild());
  server.watcher.on("change", (file) => {
    if (!file.startsWith(path.resolve("src/plugin")) && !file.startsWith(path.resolve("src/lib")) && !file.startsWith(path.resolve("src/shared"))) return;
    clearTimeout(timer);
    timer = setTimeout(() => void rebuild(), 150);
  });
  server.httpServer?.once("close", () => clearTimeout(timer));
};

// https://vitejs.dev/config/
export default defineConfig(({ mode, command }) => ({
  // relative asset and worker URLs: the released UI can be hosted below a path (e.g. github.io/parrot/)
  base: command === "build" ? "./" : "/",
  worker: {
    format: "es",
  },
  optimizeDeps: {
    exclude: ["@inlang/sdk", "@lix-js/sdk"],
    include: ["@inlang/sdk > @sinclair/typebox", "@lix-js/sdk > @sinclair/typebox"],
  },
  server: {
    fs: {
      // Worktrees may share a dependency directory through a symlink. Module workers use its real URL.
      allow: [path.resolve("."), fs.realpathSync(path.resolve("node_modules"))],
    },
    headers: {
      "Content-Security-Policy":
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval'; worker-src 'self' blob:; connect-src 'self' ws: http: https:",
    },
  },
  plugins: [
    react(),
    rawPlugin({fileRegex: /\.ejs$/ }),
    // viteSingleFile(),
    
    {
      name: "rebuild-on-change",
      configureServer: onConfigureServer,
      handleHotUpdate({ server }) {
        // RPC proxies and window managers are singletons; reload their browser realm together.
        server.ws.send({ type: "full-reload" });
        return [];
      }
    },
  ],
  define: {
    process: { env: {} },
  },
  root: path.resolve("src/ui"),
  build: {
    target: "esnext",
    minify: mode === "production",
    cssMinify: mode === "production",
    sourcemap: mode !== "production" ? "inline" : false,
    // target: "es2017",
    emptyOutDir: true,
    outDir: path.resolve("dist/ui"),
    // rollupOptions: {
    //   output: {
    //     inlineDynamicImports: false,
    //     entryFileNames: "[name].js",
    //   },
    //   input: {
    //     ui: path.resolve("src/ui/ui.html"),
    //     // plugin: path.resolve("src/sandbox/code.ts"),
    //   },
    // },
  },
  
  // css: {
  //   // postcss: {
  //   //   plugins: [postcssUrl({ url: "inline" })],
  //   // },
  //   preprocessorOptions: {
  //     scss: {
  //       api: "modern-compiler",
  //     },
  //   },
  // },
  resolve: {
    alias: {
      "@ui": path.resolve("src/ui"),
    },
    // the editor component and the inlang plugins depend on @inlang/sdk too: use one SDK instance
    dedupe: ["@inlang/sdk"],
  },
}));
