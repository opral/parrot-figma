# Dynamic page migration: validation and performance

Measured in Figma Desktop on 2026-10-14 against baseline commit `537e691`. The same existing QA file has nine pages and a 5,000-text-layer fixture. Both builds use Parrot's plugin namespace. The final comparisons below ran without concurrent builds or tests.

The migration follows [Figma's dynamic loading guide](https://developers.figma.com/docs/plugins/migrating-to-dynamic-loading/): `documentAccess: "dynamic-page"`, async ID resolution and page navigation, live-node indexing with an 8 ms scan budget, and page events before the complete document event becomes available. Other pages load sequentially in the background. Only after that scan does `loadAllPagesAsync()` enable root document events. A coalesced revision marker and a 250 ms single-key poll detect message undo before document events are available; explicit undo boundaries flush the marker. Older clients' unmarked root writes are reconciled when the document observer becomes available.

## Final warm-file read profiles

Medians of three executions. They start inside the plugin and exclude the iframe's download/render time and Figma's legacy pre-launch page loading. They establish backend throughput, not a cold launch SLA.

| Operation | Legacy (ms) | Dynamic (ms) |
| --- | ---: | ---: |
| Store initialization | 66 | 70 |
| Current-page root frames | 6 | 7 |
| Complete cross-page link index | 1,074 | 396 |
| Read 5,000 current-page labels | 1,587 | 1,526 |
| Read the 5,000-layer frame | 1,399 | 1,347 |
| Total | 4,161 | 3,372 |

Indexing is about 63% faster and total backend profile time is about 19% lower. Small differences in store and frame-list initialization are within the observed variation. Current-page label lists yield every 32 ms; frame reads every 256 ms. Bulk text mutations yield every 256 ms, metadata batches every 1,000 ms. These intervals avoid frequent expensive canvas renders while keeping larger operations interruptible.

Raw samples in `[store, frames, index, labels, largeFrame, total]` order:

```json
{
  "legacy": [[70,8,1128,1587,1367,4161],[66,6,1074,1669,1445,4260],[63,6,1070,1555,1399,4093]],
  "dynamic": [[70,9,610,1530,1347,3566],[70,7,361,1526,1322,3286],[63,6,396,1480,1426,3372]]
}
```

## Bulk frame preparation and linking

`qa/link-profile.ts` creates a disposable page and three independent 1,000-text-layer frames. Each frame is read before linking, as the Layers interface does. It instruments synchronous label reads and style extraction only during the link action. Both builds use the same fixture and instrumentation.

| Operation, median of three | Legacy (ms) | Dynamic (ms) |
| --- | ---: | ---: |
| Prepare 1,000-layer frame | 284 | 259 |
| Link 1,000 layers | 419 | 372 |

Preparation is about 9% faster and linking about 11% faster. Every sample returned zero errors and exactly 1,000 label reads.

Raw samples in `[prepare, link, labelRead, styleExtraction, labelReadCount]` order (style extraction is included in label-read time):

```json
{
  "legacy": [[315,425,306,188,1000],[284,414,293,194,1000],[283,419,297,183,1000]],
  "dynamic": [[258,417,268,196,1000],[259,355,250,171,1000],[317,372,260,181,1000]]
}
```

Earlier versions regressed linking because yields allowed page events to re-read another 600–750 labels during the active batch. Event snapshots now wait for active batches to finish, including when labels fail. Loaded node handles and per-slice frame metadata avoid repeated lookups. Redundant formatting setters are skipped after checking complete range coverage. The reverse-link cache itself measured only 1–4 ms per batch.

## Integrated live mutation checks

`qa/e2e.ts` creates two disposable pages, persists 5,000 bilingual messages, and prepares a 1,000-text-layer frame before linking on its current page. It restores the starting page and removes all its own fixtures in `finally`. The legacy navigation helper requires an explicit page switch before selecting an off-page layer; without that workaround it throws. The migrated helper switches pages itself.

| Operation, final quiet individual run | Legacy (ms) | Dynamic (ms) |
| --- | ---: | ---: |
| Persist 5,000 messages | 10,027 | 10,155 |
| Link 1,000 layers plus one off-page layer | 474 | 400 |
| Switch 1,000 layers to German | 1,566 | 1,599 |
| Off-page edit check, including 400 ms settling delay | 726 | 405 |
| Async canvas export | 1 | 2 |

Import and language-switch times differ by about 1–2%, within run variation. These are individual samples, not medians. The separate three-sample frame/link comparison above was repeated after the final frame-read pacing adjustment.

All integrated assertions passed:

- Root message undo and notification before indexing/global document events.
- 5,000-message persistence and reload.
- Cross-page link lookup and async selection/navigation.
- 1,000-layer language switching and a single bulk undo restoring every layer.
- Canvas edits on a page other than the current page.
- Plural count data roundtrip.
- Root message undo and change notifications after indexing.
- Async canvas export and fixture cleanup.

## Actual interface checks

The real Parrot iframe, RPC bridge, Lix session, and Figma canvas were exercised together:

- Imported 25 new English messages through the JSON import review.
- Found an imported key in Messages and typed an edit.
- Exported English through the Save dialog and parsed the resulting JSON: the edited value and the other 24 imported values matched.
- Switched pages, selected an existing test frame, and verified its linked labels in Layers.
- Switched that frame from German to English, including its parameterized text, then focused the canvas and undid the operation. Its original German language and text were restored.
- Removed only the 25 disposable imported messages; verified zero remained and restored the starting page.

A QA worktree with symlinked `node_modules` initially failed to load the Lix worker with HTTP 403. The development server now allows the dependency directory's resolved path. The worker request returned HTTP 200 and the real interface checks then passed. The final production UI was also served locally through Vite preview: its generated worker assets loaded, the interface opened, and selecting the 5,000-layer fixture displayed its linked and unlinked text rows.

Cold-file launch, numeric iframe usability timings, edits from a second client, and CPU flamegraphs have not been measured. These results support the measured warm-file flows, not a universal latency guarantee. Figma reported offline/local saving during the session; remote synchronization was not tested.

## Reproduction and automated checks

See `qa/README.md`, `qa/build.mjs`, `qa/profile.ts`, `qa/link-profile.ts`, and `qa/e2e.ts`. Generated QA manifests and bundles stay local. Profiling disposes page observers between read samples to avoid retaining prior stores and trees. Do not run builds/tests concurrently with native timing comparisons.

`npm run tsc`, `npm run lint`, and 222 tests pass. UI and plugin production builds pass. The UI build reports dependency externalization and large-chunk warnings; the generated production worker and interface were verified in Figma. Regression tests reject deprecated synchronous Figma calls and setters, verify unloaded-page traversal and pre-index selection, cache invalidation after removal, per-label queue release, batched node lookup, deferred page snapshots during failed bulk operations, root undo/redo polling, revision coalescing, delayed document event registration, and exact formatting-range coverage.

Current Community version upgrade verification and storage rollback limits are recorded in [compatibility.md](compatibility.md). Older projects need a one-time page scan for schema repairs; the warm-file performance measurements above use already repaired projects.
