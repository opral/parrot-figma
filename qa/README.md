# Dynamic page migration QA

Use a disposable Figma test file. The profiling plugin reads existing pages and labels and updates Parrot's existing file-statistics plugin data. The E2E plugin creates two temporary pages and 5,002 messages, verifies cross-page linking, navigation, a 1,000-layer language switch and bulk undo, off-page edits, plural persistence, root-message undo notifications before and after indexing, and async canvas export. It removes only its own pages and messages in `finally` and restores the starting page. Do not close it or enable hot reload during a run: interrupting a plugin prevents its cleanup from completing.

Run `node qa/build.mjs`. Import `qa/migrated/manifest.json` for three profiling samples, or `qa/migrated/e2e-manifest.json` for mutation checks, using Figma Desktop's Plugins → Development → Import plugin from manifest. All QA entries retain the Parrot plugin ID so they can read Parrot's existing data. Choose the named development entry directly from the Development menu when multiple entries share that ID.

Import `qa/migrated/link-profile-manifest.json` for the focused three-sample bulk benchmark. It creates one temporary page and three 1,000-layer frames, reads each frame, then times linking and synchronous label/style read phases. It removes its temporary page and restores the starting page after completion; it does not save message records. Its report includes frame preparation, link time, error count and label-read count. Do not run builds or tests concurrently with native benchmarks.

The profile reports wall-clock milliseconds for store initialization, the current-page root-frame list, the complete cross-page index, all current-page labels, the first root frame, and total execution. It reports three raw samples and their median. These timings begin inside the plugin; they exclude UI download/render time and Figma's legacy pre-launch page loading. Use a freshly opened file to measure cold launch separately.

For a legacy comparison, run the same tools on the baseline checkout with `node qa/build.mjs --legacy`. The migration baseline is commit `537e691`. The legacy cross-page selection helper throws; switch to the first fixture page before that assertion to benchmark subsequent operations. This workaround is unnecessary in the migrated plugin.

For full interface checks, run `npm run dev -- --host 127.0.0.1 --port 5182 --strictPort`, copy `dist/plugin.js` into a QA directory's `dist/`, and generate a QA manifest from the root manifest with `http://localhost:5182` in `networkAccess.devAllowedDomains`. The production manifests retain their established URLs.

Generated bundles and manifests are local QA artifacts. Test results and limitations are recorded in `docs/performance.md`.

## Published-version project upgrade

See `docs/compatibility.md` for the actual Community 0.10.112 evidence and release limits. `node qa/build.mjs` also generates separate manifests for the following helpers. All retain the real Parrot plugin ID and operate on its private plugin data.

1. Run `published-fixture-manifest.json` in a fresh, empty file **before opening Parrot**. It refuses files with existing scene content or plugin data and creates two fixture pages.
2. Open the actual Community plugin, configure English/German, link the first frame's layers to `store_upgrade__hello` and `store_upgrade__lines`, and enter German translations. Do not substitute the baseline development plugin for this step.
3. Close Community and run `published-inspect-manifest.json`. It requires the fixture marker, clones the linked frame to the second page, and saves the original snapshot under `qa_before_upgrade`. It also displays message/configuration records for the golden fixture. This snapshot includes fixture text and plugin data; use only this isolated synthetic file.
4. Close the inspector, open the new production build under the same ID, then run `verify-published-upgrade-manifest.json`. It compares messages, configuration, text, metadata and cross-page links against that snapshot.
5. Switch the first frame to German in the new interface. `undo-published-manifest.json` exposes an explicit one-step Figma undo button and reports whether original linked text returned. Run the verifier again to check the complete original snapshot.

Keep the isolated file for review. These helpers do not automatically remove its content. Do not hot-reload or replace a helper bundle during an active run. The checked-in golden fixture contains only the synthetic records captured from the published plugin.
