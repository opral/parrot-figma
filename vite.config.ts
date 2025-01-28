import path from "node:path";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";
import generateFile from "vite-plugin-generate-file";
import react from "@vitejs/plugin-react";
import richSvg from "vite-plugin-react-rich-svg";
import { viteStaticCopy } from "vite-plugin-static-copy"
import rawPlugin from 'vite-raw-plugin';
import fs from 'fs';

import { exec, execSync } from "child_process";
// import postcssUrl from "postcss-url";

const buildWithUrl = (serverPort: string) => {
  exec(
    "VITE_CUSTOM_URL=" + "http://localhost:" + serverPort + " vite build",/// -c vite.config.plugin.ts",
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

let vitePort: number | undefined = undefined;

let lastPluginBuildPort = -1

const buildPlugin = (force: boolean = false) => {

  if (!vitePort) {
    return 
  }

  if (lastPluginBuildPort === vitePort && !force) {
    console.log('skipping build ' + vitePort);
    return 
  }
  console.log('👷 building sandbox for port: ' + vitePort);
        
  // TODO call vite build sandbox to bundle plugin and copy loader/manifest
  execSync(`PLUGIN_CODE_BASE_URL=http://localhost:${vitePort}/ vite build -c vite.config.sandbox.ts`);
  lastPluginBuildPort = vitePort
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [
    {
      name: 'before-build-or-update',
      async configResolved(config) {
        if (vitePort === undefined) {
          vitePort = config.server?.port || 5173; // Default port is 5173
        }
      },

      async buildStart() {
          console.log("✨️ buildStart - build plugin with pre configured port");
          buildPlugin()
      },

      async configureServer(server) {
        const pollServerPort = () => {
          const serverPort = (server as any)._currentServerPort;
          if (!serverPort) {
            setTimeout(() => {
              pollServerPort();
            }, 10);
            return;
          }
          
          if (serverPort !== vitePort) {
            vitePort = serverPort;
            console.log("initial port change detected - rebuild plugin");
            buildPlugin()
          }
        };
        pollServerPort();

        server.watcher.on("change", (...args) => {
          const serverPort = (server as any)._currentServerPort;
          if (serverPort !== vitePort) {
            vitePort = serverPort;
            // port change detected
            console.log("port change detected - rebuild plugin");
            buildPlugin()
          }
        });

        server.middlewares.use((req, res, next) => {
          console.log(req.url);
          if (req.url === '/plugin.js') {
            res.setHeader('Content-Type', 'application/javascript');
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            res.end(fs.readFileSync(path.resolve('dist_plugin/plugin.js')));
          } else {
            next();
          }
        });
      },

      // Hook into hot updates (watch mode)
      async handleHotUpdate({ file }) {
        console.log("hot update detected - rebuild plugin");
        buildPlugin(true)
        return null; // Return null to let Vite continue with its bundling
      },
    },
    react(),
    richSvg() as any /* any to avoid type problem*/,
    rawPlugin({ 
      // ejs templates for export
      fileRegex: /\.ejs$/
      // plugin source code

     }),
    // viteSingleFile(),
    viteStaticCopy({
      targets: [
        {
          src: '../dist_plugin/*',
          dest: '.'
        },
      ]
    }),
    
    // viteStaticCopy({
    //   targets: [
    //     {
    //       src: '../manifest.json',
    //       dest: '.'
    //     }
    //   ]
    // }),
  ],
  define: {
    process: { env: {} },
  },
  root: path.resolve("src"),
  build: {
    minify: mode === "production",
    cssMinify: mode === "production",
    sourcemap: mode !== "production" ? "inline" : false,
    // target: "es2017",
    emptyOutDir: true,
    outDir: path.resolve("dist"),
    rollupOptions: {
      
      input: {
        ui: path.resolve("src/ui/index.html"),
      },
      output: [{
         entryFileNames: '[name].js', 
         format: 'es',
         manualChunks: undefined,
      }],
      onwarn: (warning, warn) => {
        // Suppress eval warnings - we use it in figma plugin loader to load the plugin
        if (warning.code === 'EVAL') {
          return;
        }
        warn(warning);
      }
    },
  },
  resolve: {
    alias: {
      // "@common": path.resolve("src/common"),
       "@ui": path.resolve("src/ui"),
       "@plugin": path.resolve("src/plugin"),
      // "@plugin": path.resolve("src/sandbox"),
    },
  },
}));
