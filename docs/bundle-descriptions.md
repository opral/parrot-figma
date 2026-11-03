# Bundle descriptions release integration

The shared Description control edits one bundle-level description across languages. Row adapters, legacy canvas edits, Figma persistence and SDK hydration preserve it. The format adapter forwards `supportsBundleDescriptions`, and direct plugin exports advertise the SDK capability. Native formats store source descriptions inline; formats without native support offer a separate descriptions.json download. Import accepts that companion alongside one language file. A translation-only import retains existing guidance; explicit native/companion metadata can clear it.

Ship with the forthcoming SDK minor (4.2.0 or later), editor-component minor (14.1.0 or later) and updated description-capable format plugins. Registry ranges and lockfile deliberately remain at published versions until those releases exist. Before deploying, bump those dependencies together and regenerate the lockfile. Local validation used temporary workspace links; no local paths are committed.

Focused tests exercise row/legacy conversions, native and companion roundtrips and description clearing. Production UI compilation was checked. Figma-host save/undo/reopen remains a release smoke test because no live Figma host was available.

The actual InlangEditor was also rendered with Parrot's real light/dark CSS and the real MessageSaveQueue in the local UI harness (`inlang/rfcs/bundle-descriptions/ui-smoke`). Normal, empty, long, editing and failed-save states were checked at panel widths down to 320px. A rejected description write now resets the shared control to stored guidance; the error stays visible. Guidance aligns with the bundle key's 38px inset. These browser checks mock Figma persistence and do not replace the native-host release smoke test.
