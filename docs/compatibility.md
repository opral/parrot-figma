# Published-project upgrade verification

Verified on 2026-10-14 against the actual Figma Community plugin, ID `1205803482754362456`. Its running UI reports version **0.10.112**; the checkout's package version and the previously downloaded release bundle are not evidence of the published version.

The forward upgrade passed for an isolated project created through that published plugin. This verifies the tested storage and workflows; it does not certify every historical project. Nothing was published.

## Native Figma evidence

In a fresh [QA file](https://www.figma.com/design/X8pvpf6ns7CYCGVE4o9VN9/Untitled), the published plugin configured English/German, linked two messages and saved German translations. One message contains line breaks. A native frame clone copied the linked layers to another page. The fixture has two messages, four linked text layers across two pages, and two additional unlinked layers.

Before upgrading, a helper captured root configuration, message records, every text layer's content and plugin data. The published root records are checked into [the golden fixture](../qa/fixtures/published-0.10.112.json). These are synthetic messages entered in the published UI, not guessed legacy JSON or customer data.

The new production plugin sandbox and production UI/worker assets then opened the same file under the same plugin ID, with `documentAccess: "dynamic-page"`. Native API assertions verified:

- Both messages and both locales match the original records, including line breaks.
- Configuration and all existing text-layer plugin data remain unchanged.
- The canvas text remains unchanged during migration.
- All four linked layers retain their message IDs; lookup finds the same message on both pages.
- Legacy `prt_im__` records are converted to validated native bundles; the schema marker advances from `0.10.71` to `0.10.101`.

The new Layers interface switched the first frame to German and rendered both translations. One `figma.triggerUndo()` restored its original English text and language metadata. The exact integrity assertions passed again after undo. Reopening Community 0.10.112 for a read-only check, then running the verifier again, also preserved the migrated records.

## Bugs found and fixed

The old schema repairs contained root-wide scans hidden behind TypeScript casts. Dynamic page loading forbids these, so projects with the published plugin's `0.10.71` schema marker could fail at startup. Repairs now await each page before scanning it, and startup awaits the complete migration before initializing the store and UI. The static API regression test also detects cast expressions.

Schema repairs and bundle conversion now share a record of original writes. Failures restore and verify original values, including configuration, layer metadata and version markers; failed startup closes with an error. Bundle conversion validates the complete conversion before removing legacy message keys. Unsupported historical references, gender/plural variants and unmapped layer links are rejected rather than silently skipped. Reopening an already migrated file does not repeat schema page scans or writes.

The full suite passes **222 tests**. The migration tests cover the real published golden records, page-load ordering, user parameter values, idempotence, failed writes and retry, rejection/rollback for nonempty aliases, a simple pre-0.10.71 project, and preservation of unsupported historical data. Broader persistence, selectors, plurals, formatting and bulk-operation coverage is described in [performance.md](performance.md).

## Release limits

**This storage upgrade is one-way with respect to Community 0.10.112.** The old plugin reads `prt_im__` records and cannot read native bundles. Reopening it after migration showed the layers as unlinked, even though the new data remained intact. A rollback of plugin code alone is insufficient. Old running plugin sessions must be closed before editing a migrated project; simultaneous old/new writers were not certified.

**Not every historical record is supported.** Nonempty legacy aliases and the unsupported historical cases above stop migration and preserve original data. Those projects cannot open in the new release until a lossless converter exists for their records. This is a release limitation, not a successful migration. The native fixture covers ordinary bilingual messages, not all historical combinations, rich-text customer projects or second-client concurrency.

Before a broad release, resolve those unsupported cases or define the supported project scope explicitly. Retain a pre-upgrade file copy and test it with the proposed release; rollback requires restoring the old project data or a separately validated reverse migration. The release workflow copies the root manifest, preserving the plugin ID and dynamic-page declaration, and checks that the configured hosted UI origin is allowed. Hosted production deployment and Community publication were not performed by this verification.

Reproduction tools and their safety constraints are in [qa/README.md](../qa/README.md).
