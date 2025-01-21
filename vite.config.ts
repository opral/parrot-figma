import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import generateFile from "vite-plugin-generate-file";
import react from "@vitejs/plugin-react";
import richSvg from "vite-plugin-react-rich-svg";
import { viteStaticCopy } from "vite-plugin-static-copy"
import rawPlugin from 'vite-raw-plugin';

import { exec } from "child_process";
// import postcssUrl from "postcss-url";

const buildWithUrl = (serverPort: string) => {
  exec(
    "VITE_CUSTOM_URL=" + "http://localhost:" + serverPort + " vite build -c vite.config.plugin.ts",
    (error, stdout, stderr) => {
      if (error) {
        console.error(`Error during build: ${error.message}`);
        return;
      }
      if (stderr) console.error(stderr);
      console.log(stdout);
    },
  );
};

const onConfigureServer = (server: any) => {
  // we need to wait for the port until the connection is established...
  const pollServerPort = () => {
    const serverPort = (server as any)._currentServerPort;
    if (serverPort) {
      console.log("got port: " + serverPort);
      buildWithUrl(serverPort);
    } else {
      console.log("waiting for port");
      setTimeout(() => {
        pollServerPort();
      }, 10);
    }
  };
  pollServerPort();

  server.watcher.on("change", (...args) => {
    const serverPort = (server as any)._currentServerPort;
    buildWithUrl(serverPort);
  });
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    richSvg() as any /* any to avoid type problem*/,
    rawPlugin({fileRegex: /\.ejs$/ }),
    // viteSingleFile(),
    
    {
      name: "rebuild-on-change",
      configureServer: onConfigureServer
    },
  ],
  define: {
    process: { env: {} },
  },
  root: path.resolve("src/ui"),
  build: {
    minify: mode === "production",
    cssMinify: mode === "production",
    sourcemap: mode !== "production" ? "inline" : false,
    // target: "es2017",
    emptyOutDir: true,
    outDir: path.resolve("dist"),
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
      // "@common": path.resolve("src/common"),
      "@ui": path.resolve("src/ui"),
      // "@plugin": path.resolve("src/sandbox"),
    },
  },
}));
