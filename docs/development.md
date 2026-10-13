# Developing Parrot

Parrot uses the published `@inlang/sdk` 4, `@inlang/editor-component` and Inlang format plugins (pinned in `package.json`). No sibling checkout or local link is required.

```sh
pnpm install
pnpm dev --host localhost --port 5180 --strictPort
```

In Figma desktop, choose **Plugins → Development → Import plugin from manifest** and select this repository's `manifest.json`. Run **Parrot (development)**. The sandbox loader is built automatically and opens the UI at `http://localhost:5180`.

Validation:

```sh
pnpm tsc
pnpm lint
pnpm test
pnpm build
```

CI (`.github/workflows/ci.yml`) runs the same checks plus the sandbox build on every pull request.

`pnpm build` creates hosted UI assets in `dist/ui/`. The UI uses module workers and WebAssembly; serve the complete directory, including worker and WASM assets. Build the Figma sandbox separately with `VITE_CUSTOM_URL` set to the hosted UI URL using `pnpm exec vite build -c vite.config.plugin.ts`. Use a separate checkout when building a hosted loader while the local plugin is running.

## Branches and releases

`dev` is the default branch: pull requests go into `dev`. Merging into `dev` publishes nothing. Releases are built with the manual **Release build** workflow and published to the Figma Community by hand. See [Releasing Parrot](releasing.md).
