# Bundle descriptions release integration

The shared Description control edits one bundle-level description across languages. Row adapters, legacy canvas edits, Figma persistence and SDK hydration preserve it. The format adapter forwards `supportsBundleDescriptions`, and direct plugin exports advertise the SDK capability. Native formats store source descriptions inline; formats without native support offer a separate descriptions.json download. Import accepts that companion alongside one language file. A translation-only import retains existing guidance; explicit native/companion metadata can clear it.

Parrot 1.1.0 pins the published SDK 4.2.0, editor-component 15.0.0, message-format 4.6.0, Apple strings/xcstrings and Android 0.3.0, i18next 6.5.3, ICU1 1.3.8, JSON 5.1.67 and next-intl 2.4.7. The lockfile installs these registry releases; no sibling checkout or workspace links are required.

Focused tests exercise row/legacy conversions, native and companion roundtrips and description clearing. Production UI compilation was checked. Figma-host save/undo/reopen remains a release smoke test because no live Figma host was available.

The actual InlangEditor was also rendered with Parrot's real light/dark CSS and the real MessageSaveQueue in the local UI harness (`inlang/rfcs/bundle-descriptions/ui-smoke`). Normal, empty, long, editing and failed-save states were checked at panel widths down to 320px. A rejected description write now resets the shared control to stored guidance; the error stays visible. Guidance aligns with the bundle key's 38px inset. These browser checks mock Figma persistence and do not replace the native-host release smoke test.

## Parrot 1.1.0 release notes

- Add shared translation guidance beside each message key, with explicit Save, Cancel, Clear and keyboard saving.
- Preserve descriptions through translation edits, legacy canvas data, Figma persistence and SDK hydration.
- Read and write native source guidance in message-format, Apple strings, Apple catalogs and Android resources; carry descriptions separately for JSON formats.
- Restore stored guidance when a description save fails, while keeping the error visible.

## Parrot 1.1.1 release integration

Restore the dynamic-page migration from PR #80, which powered the published 1.0.1 release but had only been merged into `fix/link-matching-and-save-races`. Both manifests declare `documentAccess: "dynamic-page"`; node lookup, navigation, indexing, and root change notifications use the migrated host APIs. Keep the current restricted network domains, placeholder formatting fixes, and shared descriptions.

The hosted 1.1.0 directory is immutable. The corrected combined release uses 1.1.1 and is intended for Community version 114. Native Figma checks against the 1.1.0 description build verified save/reopen, clear/reopen, and keyboard undo; repeat the description checks against the final 1.1.1 artifact before Community publication.
