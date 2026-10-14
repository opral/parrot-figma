# Dynamic page migration QA

Use a disposable Figma test file. The profiling plugin reads existing pages and labels and updates Parrot's existing file-statistics plugin data. The E2E plugin creates two temporary pages and 5,002 messages, verifies cross-page linking, navigation, a 1,000-layer language switch and bulk undo, off-page edits, plural persistence, root-message undo notifications before and after indexing, and async canvas export. It removes only its own pages and messages in `finally` and restores the starting page. Do not close it or enable hot reload during a run: interrupting a plugin prevents its cleanup from completing.

Run `node qa/build.mjs`. Import `qa/migrated/manifest.json` for three profiling samples, or `qa/migrated/e2e-manifest.json` for mutation checks, using Figma Desktop's Plugins → Development → Import plugin from manifest. All QA entries retain the Parrot plugin ID so they can read Parrot's existing data. Choose the named development entry directly from the Development menu when multiple entries share that ID.

Import `qa/migrated/link-profile-manifest.json` for the focused three-sample bulk benchmark. It creates one temporary page and three 1,000-layer frames, reads each frame, then times linking and synchronous label/style read phases. It removes its temporary page and restores the starting page after completion; it does not save message records. Its report includes frame preparation, link time, error count and label-read count. Do not run builds or tests concurrently with native benchmarks.

The profile reports wall-clock milliseconds for store initialization, the current-page root-frame list, the complete cross-page index, all current-page labels, the first root frame, and total execution. It reports three raw samples and their median. These timings begin inside the plugin; they exclude UI download/render time and Figma's legacy pre-launch page loading. Use a freshly opened file to measure cold launch separately.

For a legacy comparison, run the same tools on the baseline checkout with `node qa/build.mjs --legacy`. The migration baseline is commit `537e691`. The legacy cross-page selection helper throws; switch to the first fixture page before that assertion to benchmark subsequent operations. This workaround is unnecessary in the migrated plugin.

For full interface checks, run `npm run dev -- --host 127.0.0.1 --port 5182 --strictPort`, copy `dist/plugin.js` into a QA directory's `dist/`, and generate a QA manifest from the root manifest with `http://localhost:5182` in `networkAccess.devAllowedDomains`. The production manifests retain their established URLs.

Generated bundles and manifests are local QA artifacts. Test results and limitations are recorded in `docs/performance.md`.
