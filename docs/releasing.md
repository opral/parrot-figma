# Releasing Parrot

A Parrot release has two parts that belong together:

- **The UI**, hosted on GitHub Pages of this repository: `https://opral.github.io/parrot-figma/releases/<version>/`. It uses module workers and WebAssembly, so the plugin cannot ship it as inline HTML.
- **The plugin sandbox** (`dist/plugin.js` and `manifest.json`), published to the Figma Community. It loads the UI from the URL above. The origin `https://opral.github.io` is in `networkAccess.allowedDomains` of `manifest.json`.

Users keep running the sandbox of the version they installed, so the UI of a release must never change. That is why every release has its own folder, nothing deploys when `dev` changes, and a version that exists is refused.

## Build a release

1. In GitHub, open **Actions > Release build > Run workflow** and run it from `dev`.
2. Enter the **version**, for example `0.10.101` (the version in `package.json` is a good choice). It must start with a letter or digit, contain only letters, digits, `.`, `_` and `-`, and be at most 64 characters. A version that already exists on the `gh-pages` branch fails the run (also when only the case differs). Optionally change the plugin name.
3. The workflow
   - checks types, lint and tests, and builds the UI (`pnpm build`) and the sandbox (`VITE_CUSTOM_URL` = the release URL),
   - writes `release/manifest.json` and fails if the origin of the URL is not in `networkAccess.allowedDomains`,
   - uploads the `parrot-figma-plugin` artifact (`manifest.json`, `dist/plugin.js` and a copy of `dist/ui`),
   - in a second job (the only one with write access, running no repository code) commits `dist/ui` to `releases/<version>/` on the `gh-pages` branch. The branch is created on the first release; no other folder is touched and nothing is force-pushed,
   - waits until GitHub Pages serves the release (usually under a minute) and checks the content type and the CORS header of the page, its entry script and the largest WebAssembly file.

   The job summary shows the URL, the check results and the manual steps below. Runs are serialized: a second release waits for the first.

If a run fails after the push, the version exists and cannot be reused: fix the cause and release the next version. Every release adds about 96 MB of files to the Pages site (about 23 MB compressed, mostly the Lix SDK WebAssembly file, 81 MB; a single file may not exceed 100 MB) and Pages sites are limited to 1 GB, so plan for roughly 10 to 40 releases before old release folders have to go.

### One-time setup

Settings > Pages must be **Deploy from a branch**, branch `gh-pages`, folder `/ (root)`:

```sh
gh api -X PUT repos/opral/parrot-figma/pages -f build_type=legacy -f 'source[branch]=gh-pages' -f 'source[path]=/'
```

The branch has to exist first (the first run of the workflow creates it). Pushes of the workflow trigger the Pages build.

## Test the release

Before publishing, run the built files, not the dev server:

1. Download and unzip the `parrot-figma-plugin` artifact of the run.
2. In the Figma desktop app: **Plugins > Development > Import plugin from manifest...** and choose the unzipped `manifest.json`. Figma registers development plugins by manifest path, so this adds an entry next to your local **Parrot (development)** instead of replacing it. The entry has the released plugin name.
3. Run that entry in a test file. The UI must come from `https://opral.github.io/parrot-figma/releases/<version>/` (the iframe URL, for example through the remote debugging port, see below), and import, export and switching a frame must work.
4. Remove the entry again (**Plugins > Manage plugins**, its menu) when you are done.

The live QA harness in `.qa/` can drive this (see "Hosted release" in `.qa/README.md`): `PARROT_UI_ORIGIN=https://opral.github.io` makes its tools find the hosted UI iframe, `.qa/tools/hosted-probe.mjs` lists its console output, CSP/CORS errors and network requests, and `.qa/tools/net-all.mjs` records every request of a file tab (a production build may only talk to `https://inlang.com/relay`).

## Publish to the Figma Community

Publishing stays manual, in the Figma desktop app, with the manifest of the build you tested:

1. Import the unzipped `manifest.json` as described above.
2. **Plugins > Manage plugins**, open the menu of the imported entry under *In development* and choose **Publish new version**. Add release notes.
3. Remove the imported entry.

Merging into `dev` publishes nothing. Do not delete a `releases/<version>/` folder as long as a published plugin version uses it.

## Changing the allowed domains

`networkAccess.allowedDomains` and its `reasoning` text are shown to users in the Community. They live in `manifest.json` (and are kept in sync with `manifest.figma.ts` by a test). Add a domain only for a request the code really makes.
