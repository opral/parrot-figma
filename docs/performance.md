# Dynamic page migration: validation and performance

Measured in Figma Desktop on 2026-10-13 against baseline commit `537e691`. The existing QA file has nine pages; its large fixture has 5,000 text layers. The plugin namespace and file were the same for both builds.

The migration uses `documentAccess: "dynamic-page"`, async ID resolution and page navigation, live-node indexing with an 8 ms scan budget, and page events before the complete document event becomes available. Other pages load sequentially in the background. Only after that scan does `loadAllPagesAsync()` enable root document events. A coalesced revision marker and a 250 ms single-key poll detect message undo before document events are available; explicit undo boundaries flush the marker. Older clients' unmarked root writes are reconciled when the document observer becomes available.

## Warm-file read profiles

These are medians of three executions. They start inside the plugin and exclude the iframe's download/render time and Figma's legacy pre-launch page loading. They establish backend throughput, not a cold launch SLA.

| Operation | Legacy (ms) | Dynamic (ms) |
| --- | ---: | ---: |
| Store initialization | 72 | 68 |
| Current-page root frames | 10 | 8 |
| Complete cross-page link index | 1,179 | 350 |
| Read 5,000 current-page labels | 1,821 | 1,525 |
| Read the 5,000-layer frame | 1,487 | 1,495 |
| Total | 4,573 | 3,494 |

The frame read is effectively unchanged within the observed run variation. Indexing is about 70% faster, and total backend profile time is about 24% lower. Label reads yield every 32 ms. Bulk mutation batches yield less frequently because each yield can cause an expensive canvas render.

Raw samples, in `[store, frames, index, labels, largeFrame, total]` order:

```json
{
  "legacy": [[74,10,1489,2423,2287,6285],[72,10,1179,1821,1487,4573],[68,9,1161,1758,1456,4455]],
  "dynamic": [[74,11,620,1570,1495,3771],[68,8,350,1525,1543,3494],[67,6,346,1517,1482,3418]]
}
```

## Live mutation checks

The harness creates two disposable pages and a 1,000-text-layer frame, persists 5,000 bilingual messages, and restores the starting page and removes all its own fixtures in `finally`. It prepares the frame while it is current, as the Layers interface does before a bulk action. The legacy navigation helper required explicitly switching pages before selecting an off-page layer; without that workaround it throws. The migrated helper switches pages itself.

| Operation | Legacy (ms) | Dynamic (ms) |
| --- | ---: | ---: |
| Prepare 1,000-layer frame | 302 | 477 |
| Persist 5,000 messages | 11,563 | 11,616 |
| Link 1,000 layers (off-page batch) | 452 | 686 |
| Switch 1,000 layers to German | 2,464 | 2,496 |
| Off-page edit check, including 400 ms settling delay | 594 | 404 |
| Async canvas export | 0 | 0 |

Import and language-switch times are essentially unchanged in these individual runs. **The off-page link batch remains 234 ms slower and has not met the no-regression target.** Earlier naive async versions took about 983 ms for linking and 4,910 ms for the language switch. Reusing loaded node handles, batching lookups, avoiding redundant formatting writes, and caching per-batch frame metadata removed most of that overhead.

All live harness assertions passed:

- Root message undo and notification before indexing/global document events.
- 5,000-message persistence and reload.
- Cross-page link lookup and async selection/navigation.
- 1,000-layer language switching and a single bulk undo restoring every layer.
- Canvas edits on a page other than the current page.
- Plural count data roundtrip.
- Root message undo and change notifications after indexing.
- Async canvas export and fixture cleanup.

The remaining current-page linking comparison and full interface import/export/typing smoke checks were interrupted when the Mac locked. They are pending; this document does not claim complete end-to-end acceptance or that every flow is faster. Cold-file launch, actual iframe usability, remote edits from a second client, and CPU flamegraphs have not been measured in this session.

## Reproduction and automated checks

See `qa/README.md`, `qa/build.mjs`, `qa/profile.ts`, and `qa/e2e.ts`. Generated QA manifests and bundles stay local. The profiling harness disposes page observers between samples to avoid retaining prior stores and trees.

`npm run tsc`, `npm run lint`, and 210 tests pass. The UI production build passes. Regression tests reject deprecated synchronous Figma calls and setters, verify unloaded-page traversal and pre-index selection, cache invalidation after removal, per-label queue release, batched node lookup, root undo/redo polling, revision coalescing, delayed document event registration, and exact formatting-range coverage.
