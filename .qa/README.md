# Parrot QA harness (read fully before testing)

Repo: /Users/samuel/git-repos/workspace-1/parrot-figma. Drives Figma desktop over CDP to QA the plugin live. Screenshots (`.qa/shots`), downloads, outputs and reports are git-ignored; only `tools/`, `fixtures/` and this README are versioned. Install the tool dependencies once with `npm ci` in `.qa/tools`.
Pre-QA snapshot of the working tree: git ref `refs/qa/baseline` (`.qa/tools/qa-diff.sh [--stat]` shows what QA changed, incl. untracked files — plain `git diff refs/qa/baseline` wrongly shows untracked files as deleted).

## Live environment (already running — do not restart)
- Vite dev server on http://localhost:5180 (serves the plugin UI, rebuilds `dist/plugin.js` sandbox on change in src/plugin|src/lib|src/shared, and full-reloads the UI iframe on every file change). Do not start another one. If it dies: `pnpm dev --host localhost --port 5180 --strictPort` in the background from the repo root.
- Figma desktop is running with remote debugging on port 9222 (launched with `FIGMA_TEST=1`, `--remote-debugging-port=9222`). Never quit Figma.
- Test file: "Untitled" tab, URL contains `4Xgyn0xmwQsJLHyUaRfpX0`. Page "Page 1" has Frame 1/Frame 2; page "Parrot performance fixture (5000, trial…)" is a 5000-message perf fixture. You may add frames/pages/text in this file. Create new pages for your own fixtures (name them `QA <area> …`) instead of destroying existing content.
- Only ONE QA agent drives Figma at a time. You are the only one right now.

## Driving tools (run from `.qa/tools`)
```
node run-plugin.mjs                 # open "Parrot (development)" in the test file via Quick Actions (waits for UI)
node cdp.mjs close-plugin           # close plugin (then run-plugin.mjs to reopen = fresh start)
node cdp.mjs ui "<js expr>"         # evaluate JS inside the Parrot UI iframe (returns JSON). Use async IIFEs for awaits.
node cdp.mjs eval 4Xgyn "<js>"      # evaluate in the Figma editor page; global `figma` Plugin API is available there
                                    #   (e.g. create text nodes, set selection, read characters/fills/styles to VERIFY canvas results)
node cdp.mjs shot 4Xgyn out.png     # screenshot whole Figma window (CSS px ≈ coordinates for click)
node cdp.mjs uishot out.png         # screenshot only the plugin window
node cdp.mjs click X Y              # real mouse click at Figma page CSS coordinates (works inside plugin iframe)
node cdp.mjs type "text" / key Enter / key Meta+a   # real keyboard input to the focused element
node cdp.mjs upload "<selector>" /abs/file   # set files on an <input type=file> in the UI (avoid native file dialogs)
node cdp.mjs uiconsole 15           # stream UI console logs + uncaught exceptions for 15s (run in background while you act)
node cdp.mjs downloads /Users/samuel/git-repos/workspace-1/parrot-figma/.qa/downloads   # exports save here w/o dialog (re-run if a save dialog appears)
```
Tips:
- Read screenshots with the Read tool. Screenshot images are 2x device pixels; click coordinates are CSS px (image px / 2 for `shot`; for `uishot` add the plugin window origin — get it with `node cdp.mjs eval 4Xgyn "[...document.querySelectorAll('iframe')].map(f=>JSON.stringify(f.getBoundingClientRect()))"`).
- Prefer real clicks/typing for user-facing flows (that is what users do); use `ui` JS to locate elements (`getBoundingClientRect`) and to inspect state. The inlang editor uses web components with shadow DOM — pierce with `el.shadowRoot`.
- Verify canvas effects through `figma` in `eval` (e.g. `figma.currentPage.findAll(n=>n.type==='TEXT').map(n=>[n.name,n.characters])`) — don't trust the UI alone.
- Native macOS dialogs (if any) can be seen with `screencapture -x /tmp/x.png` and driven with `osascript -e 'tell application "System Events" to keystroke return'`.
- After code edits, the UI iframe reloads automatically; sandbox changes need close-plugin + run-plugin.

## Rules
- Test like a real designer would, then FIX real bugs you find in `src/` (minimal, idiomatic changes matching surrounding code). Re-verify each fix live in Figma.
- After fixing: `pnpm tsc && pnpm test` must pass (also `pnpm exec eslint <changed files>`). Add/adjust vitest tests for logic fixes where reasonable.
- Don't refactor broadly, don't change dependencies, don't touch `.qa/tools` except to add helpers you document here.
- If something is a missing FEATURE (not a bug), don't build it — list it in your report under "Missing features".
- User feedback to verify against: `.qa/user-feedback.md`. Previous reports: `.qa/reports/`.
- Save evidence screenshots in `.qa/shots/<area>-*.png`.

## Report format — write `.qa/reports/round-<N>-<area>.md`
```
# Round N – <area>
## Fixed
- [severity P0-P3] title — repro, root cause, fix (files), how verified live
## Open issues (found, not fixed)
- [severity] title — repro steps, observed vs expected, suspected cause
## Missing features (user-requested or obviously expected)
- ...
## Tested & OK
- ...
```
"No more reports" means: zero items under Fixed and zero P0–P2 items under Open issues.

## Pitfalls learned (round 1)
- Typing with the Figma canvas focused triggers Figma shortcuts (stray shapes, "Move file" dialog). Before `type`/`key`, click/focus the target input inside the plugin UI and confirm focus via `node cdp.mjs ui "document.activeElement?.outerHTML.slice(0,200)"`. Press Escape on the canvas if something odd happens and undo stray edits.
- Fixture page "QA layers-canvas" exists (Rich2 rich-text frame, 200-text frame, multi-frames, component/instances). Reuse it.

## Added in round 1 (import-export-setup)
- **Fresh / extra test files**: Figma menu (logo, click CSS 28,23) -> File (37,105) -> New Design (258,105) opens a new tab; `node cdp.mjs pages` shows the new file id. Pass a file-id substring to every command that takes `pageMatch` (`node run-plugin.mjs <id>`, `cdp.mjs eval|shot|uishot|close-plugin <id>`). Round-1 files: `0EJ5M7` ("first-run", language/import/export tests), `I6drFa` (legacy-data migration scratch file). `ui`/`upload`/`uishot` use the first `localhost:5180` iframe, so keep only ONE plugin open at a time (`close-plugin` the other file first). `figma` is only usable in `eval` while the plugin is running (closed plugin -> "plugin without an ID" error), and `figma.root.name` cannot be set (files stay "Untitled").
- **Uploads**: the Figma process cannot read files below `~/git-repos` (macOS permissions -> "requested file could not be read"). Copy fixtures to `/tmp/parrot-qa/` first and upload from there (`.qa/fixtures/*` are the sources). Row selectors: `.transfer-language-row:nth-child(N) input[type=file]`.
- **`tools/drive.mjs`**: scripting helper for multi-step flows in ONE process (real mouse clicks by selector+text, `ui`, `upload`, `type`, `key`, `eval`) - the bash loops with `node cdp.mjs` per step are 10x slower and flaky. See the header of the file; example scripts were used for the format matrix.
- **`tools/helpers.sh`**: `source` it for `uiclick "<css>" ["exact text"]` and `capture_exports`.
- **Exports**: `cdp.mjs downloads <dir>` keeps the CDP download behaviour only while that process runs (start it in the background) and Figma still does not write the file (download event "completes", no file appears). To read exported content use `capture_exports` (patches `URL.createObjectURL`, results in `window.__exports`) or `drive.mjs`.
- **Machine translation runs in the plugin sandbox** (Figma page), not in the UI iframe: simulate failures with `node cdp.mjs offline <seconds> [fail|<http status>] <fileId> &` (Playwright route on the file page: `fail` -> "Failed to fetch", `429` etc. -> HTTP status), then switch a frame to a language without translations.
- **dist/plugin.js is not always rebuilt by the dev server** (sandbox edits under src/lib sometimes did not trigger a rebuild). Check `ls -la dist/plugin.js`; rebuild by hand with `VITE_CUSTOM_URL=http://localhost:5180 pnpm exec vite build --config vite.config.plugin.ts`, then `close-plugin` + `run-plugin`.
- The plugin stores `lastView` per file in clientStorage: a file whose onboarding was never finished re-opens in the onboarding even if `fileSetupCompleted` was set via the API - click "Finish Setup".

## Added in round 2 (messages-editor)
- **`tools/qa-lib.mjs`**: `ctx(fileMatch)` = `drive.mjs` + `clickEl(jsExprReturningElement)` (scrolls into view, REAL mouse click at its centre, pierce shadow DOM in the expression, e.g. `` `${msg}.shadowRoot.querySelector('.new-variant')` ``), `clickAt(uiX,uiY)` (coordinates are inside the plugin iframe, NOT screenshot coordinates: the plugin window screenshot has a ~40 px title bar above the iframe), `fig(js)` (evaluate in the Figma page), `waitUi(d)` (wait for the tabs after an HMR reload ~5 s), `search(d, q)` (Messages tab + type into the search field). Typed text goes to the focused element - always `clickEl` the target first.
- **`tools/messages-search.mjs "<query>"`**: reload-safe way to put the Messages tab into a known state (`name:me.save`). `tools/open-timing.mjs`: run-plugin -> "UI loaded" / tabs / first rows timings (run `node cdp.mjs close-plugin <file>` first). `tools/perf-scroll.mjs [px per 33 ms] [steps]` (frame times while scrolling) and `tools/perf-typing.mjs` (36 keystrokes with ~400 rows in the DOM; appends to a real fixture message and restores it afterwards).
- **Plugin startup timings**: temporary `console.log("[r2perf] ...", Date.now())` lines in `src/plugin/plugin.ts`, `InlangV3Project.open`, `MessageStoreMemory.loadInlangProject` + `node cdp.mjs console 30 > log &` (streams the plugin sandbox AND the UI iframe console). The sandbox runs on Figma's main thread, so the UI iframe cannot run while the sandbox constructors work: a long sandbox constructor shows up as a gap before `ui: load start`.
- Inlang editor components: several `inlang-message` / `inlang-add-selector` exist per message (one per language, index 0 = reference). Their inner elements are in `shadowRoot`; the `sl-select` of "Add selector" needs a real click on the `sl-option` before "Add selector" works.
- Fixtures: page "QA r2 messages-editor" (`R2 ME Plain`, `R2 ME Rich`; keys `r2.me.*`). Rich fixtures are linked bold/italic, bullet and numbered list texts.

## Added in round 2 (import-export-setup)
- **Scripts** (all take `FILE=<file id substring>` as env, default `4Xgyn`; they use real mouse clicks through `drive.mjs`): `tools/onboard.mjs <file> "English|English - en" "German|German - de"` (first-run onboarding), `tools/import-file.mjs <format label|-> <file or name in /tmp/parrot-qa> "<language row prefix>" [shot-name] [--noimport]` (upload -> preview text -> Import -> result + timing; `-` keeps the format the plugin remembers), `tools/export-dump.mjs "<format label>" <outdir> [en,de]` (exports every language row and stores the captured file contents), `tools/setup-add.mjs`, `tools/switch-frame-language.mjs`.
- **Never edit files in `src/` while a driver script runs**: every edit triggers a full reload of the UI iframe; a script that was in the middle of an upload/import then waits forever (looks like "the import hangs"). Kill the script, retry.
- **The Messages editor renders hidden helper rows** (2 px high `Translate from …` buttons / contenteditables above the real row). Pick elements with `getBoundingClientRect().height > 10` and, for clicks, prefer the LAST match.
- Region/script locales are now selectable in Setup (`SelectableLocales` in `src/lib/message/variants/Locale.ts`). The import/export format is remembered per file (`getLocalFileConfig("transferFormat")`), so a file whose Import tab shows "i18next JSON" keeps it after reopening.
- Plugin files created in round 2: `vbL2Ew` (onboarding + regional languages + fixtures frame "R2 IE Frame"), `EZA1L8` (round-trip source, en/de, R1 fixtures), `7cQCVw` (round-trip target and big-import file, 4.8k messages), `I6drFa` (legacy data; the 0.10.101 repair was re-run there by setting `parrot_migration_executed` to `0.10.71` and moving `pv` to `parameterValuesKey` on a label).
- Google Translate rate-limits plain `curl` (HTTP 429) while the plugin (Figma's network stack) keeps working: test the MT mapping through the Messages tab "Translate from en" button instead of curl.

## Added in round 2 (design)
- **Real light theme**: Figma menu (logo, click CSS 28,23) -> Preferences (60,338) -> Theme (261,789) -> Light (494,789) / Dark (493,813) via `node cdp.mjs click X Y`, 1 s between clicks (`design-figma-prefs.png` shows the menu). Typing "theme" into Cmd+/ quick actions does NOT work from the harness (the keys reach the canvas). The plugin picks its theme once at open (`#window|figma-light|dark` in the UI URL, see `WindowManagerSandbox.ts`) - after a theme switch `close-plugin` + `run-plugin`; an open plugin follows the change live. Figma reports the light white as `#fff` (round 2 fixed the check that expected `#ffffff`).
- **Tools**: `tools/act.mjs "<async js with d, shot>"` (one-off driver, `d` = qa-lib ctx, `shot(name)` = uishot to `.qa/shots/<name>.png`), `tools/shotall.mjs <prefix> [w h]` (one screenshot per tab). `figma.ui.resize(w,h)` through `d.fig(...)` sets the plugin window size.
- `uishot` clips the Figma page to the plugin window: **native Figma toasts** (`figma.notify`, e.g. the red "Something went wrong with translation") appear cut off at the clip edge in it. Look at a full `cdp.mjs shot` to judge them.
- Vite HMR reloads the UI iframe and keeps the URL hash (theme), so CSS edits are safe to check live in either theme.
- Real clicks on hidden helper rows: `Add selector` summaries/`inlang-add-selector` also exist for hidden rows - filter by `getBoundingClientRect().height > 10` and use `details[open] inlang-add-selector`.

## Added in round 3 (layers-canvas)
- **`tools/r3-race.mjs <frameId> <keyPrefix> <gapMs> <language label> [nTexts] [settleMs]`** (`FILE=` env): real-UI race repro - selects the frame, links the first n texts by typing keys + Enter, waits `gapMs`, picks the language in the frame menu (the 350 ms double-click guard means the menu pick itself happens >= ~0.45 s after the click), prints canvas text + `mn` plugin data. `R3DELAY=<ms>` only works if a temporary `await setTimeout(window.__r3Delay)` hook is added to `LocalizedLabelManagerUI.applyLinkMessage` (simulates a slow Lix upsert) - it was removed again.
- **Cmd+Z in Figma restores the previous SELECTION too**: after an undo the Layers tab shows another frame; re-select the frame through `figma.currentPage.selection` before the next UI action (this fooled the first undo experiments of round 3).
- Native-looking helper buttons: several `Use message` / `Fix styles` buttons exist in the DOM (one drawer per row). Filter by `getBoundingClientRect().height>10` and `!disabled`.
- Fixtures: frames `R3 Race A/B/C`, `R3 T0..7`, `R3 Misc`, `R3 MT`, `R3 Final 0..2`, `R3 Unlinked` on page "QA layers-canvas" (y = -1500 .. -2300); keys `r3.*`.
- Theme switch from the harness: `node cdp.mjs click X Y` takes the coordinates as separate args (a `for c in "28 23"` loop does not split words in zsh).

## Added in round 3 (messages-import-export)
- **Cmd+Z / Cmd+Shift+Z tests**: the keys must reach the right place. With the focus inside a Messages field (or any input) they are the undo of THAT FIELD only (since round 3); to undo in Figma click the empty canvas first (`d.page.mouse.click(832, 113)` in an `act2`/`qa-lib` script on the default window size) and then `d.key("Meta+z")`; redo needs the capital letter: `d.key("Meta+Shift+Z")` (`Meta+Shift+z` does nothing). `node cdp.mjs key Meta+Shift+z` works too. The plugin forwards only plain Cmd+Z to Figma when the focus is in the plugin but not in a field.
- **`tools/act2.mjs "<async js with d, shot, F>"`**: like `act.mjs` (uses `FILE=` also for `shot`) plus `F(bundleId, localeIndex)` = JS expression for the editable field (`contenteditable`, shadow DOM pierced, visible rows only, 0 = reference language row) to use with `d.clickEl(F('r3.mie.b1',0))`. `qa-lib.mjs` exports `DEEP` and `fieldExpr` too; `clickEl` now waits 250 ms after scrolling and measures again right before the real click (sticky headers / lazy rows move the layout; clicks used to land on a message header).
- **`tools/r3-mie-type.mjs <bundleId> <idx> "<text>" [delayMs]`** (real typing into a field, then prints field / canvas / stored bundle), **`r3-mie-chain.mjs <bundleA> <bundleB> [rounds] [gapMs]`** (type in A, wait, click into B and type: both fields must keep exactly what was typed - the focus-theft regression test), **`r3-mie-undo.mjs` / `r3-mie-undo2.mjs <bundleId> "<text>" [undos]`** (edit, Cmd+Z, poll stored bundle / canvas / field every 250 ms; env `CANVAS=1` clicks the empty canvas first), **`r3-mie-link.mjs <frameId> key1 key2 ..`** and **`r3-mie-link1.mjs <frameId> <textIndex> <key>`** (link texts via the Layers tab; link ALL texts in one call - the first version linked every key to text 0), **`r3-mie-orders.mjs`** (language order in frame menu / Messages / Import / Export / Setup).
- **Format picker pitfall**: the select menu has a 350 ms double-click guard, so `click(button); sleep(300); click(item)` silently keeps the old format (all "exports" of a script were the same file). `import-file.mjs` / `export-dump.mjs` now wait 600 ms and `export-dump.mjs` throws if the picker does not show the requested format. Imports with `-` keep whatever format the file remembers.
- **Figma tab crash**: once the renderer of the test file died ("Target crashed" in `page.evaluate`) and `chromium.connectOverCDP` timed out for every tool. Reload the tab through the raw CDP websocket (`Page.reload` on the target from `http://localhost:9222/json/list`), wait ~30 s, run `run-plugin.mjs` again.
- Fixtures: page "QA r3 mie" in the test file (`R3 MIE A/B`, keys `r3.mie.*`, `r3.imp.*`), fresh round-3 file `iXZRCg` (onboarded en/de/pt-BR/zh-Hans, 3351 messages after the 3334-key import, `.qa/fixtures/r3-i18next.*.json`, `pt-BR.json`, `zh-Hans.json`).

## Added in round 4 (full-regression)
- **`tools/r4-lib.mjs`** (`state(d, label, bundleId, nodeId)` prints canvas text + visible Messages fields + focus), **`r4-undo-canvas.mjs` / `r4-undo-n.mjs <keys..>` / `r4-undo-field.mjs`** (`FILE=<id>`; Cmd+Z / Cmd+Shift+Z from the canvas, inside a Messages field and from a plugin non-field area; hard-coded to bundle `welcome.cta` / node `1:7` of the round-4 file), **`r4-undo-diff.mjs`** (plugin data diff around one undo key), **`r4-check.mjs <file> [frameName]`** (text nodes of a frame with style segments), **`r4-fid.mjs <file> <frameId> <lang..>`** (switches through the frame menu with real clicks and compares style signatures: Rich2 fidelity), **`r4-shotall.mjs`** (= `shotall.mjs` with `FILE=`), **`r4-rapid.mjs <gapMs> <lang..>`** (rapid language switching), **`r4-big.mjs`** (Big200 switch timing), **`r4-layers-scroll.mjs <frameId>`** (Layers tab: rows, long tasks while selecting, JS-driven scroll frame times; run on `6:48987` = 5000-text fixture frame).
- **Cmd+Z right after clicking the empty canvas first only restores the previous selection** (Figma): the first undo "does nothing", the second reverts the edit. Not a plugin bug (plugin data diff shows only `sel` changing).
- `open-timing.mjs` / `messages-search.mjs` use `4Xgyn` only (no `FILE=`); `act2.mjs` takes `FILE=`. The language-picker items of Setup contain the native name (`Japanese - ja (日本語)`): pass the full label to `d.click(".react-select__option", label)`.
- Round-4 file `ZXC9xq` (fresh onboarding: en + de/fr/pt-BR, later + ja/ar; frames `Screen` 1:2 (de), copy 1:9 (ar), `Button/Primary` component 1:16 and `Uses Button` 1:17; keys `welcome.*`). Exports in `.qa/out/r4-export*`.
- A plugin window of a 5k-message file needs ~8.4 s until the tabs exist: scripts that select nodes right after `run-plugin.mjs` + 4 s hit an empty plugin (blank window screenshot) - wait for `.tab`.
- Do not inject `content-visibility:auto` on `.layer` rows: with 5000 rows it caused a 110 s long task.

## Added in features round 1 (bulk switch / row action / missing filter / key suggestion / link-identical toast)
- **Fixture**: `tools/feat-fixture.mjs` (`FILE=ZXC9xq`) rebuilds page "QA feat 1" (Login / Sign up / Frame 12 / Login DE (flag de) / Section "Onboarding flow" with Step 1+2 / 4000 px "Wide canvas" with "Inside wide" / "Lint frame" (mixed font size) / component `Button/Primary` + "Uses Button" instance / "Empty frame"). It ends with `figma.commitUndo()`: **without it the first plugin `commitUndo` (bulk switch, Link all) swallows the whole fixture creation and Cmd+Z deletes the page.** Frame ids change on every rebuild - select by NAME: `feat-sel.mjs "Login" "Sign up"`.
- `feat-snap.mjs` (text / `mn` / `l` per top-level frame of the current page), `feat-pageswitch.mjs <language label start> page|selection` (opens the bulk menu with real clicks, confirms the drawer, samples the "Switching frame x of y" label every 250 ms, writes `shots/feat-drawer-*.png`), `feat-link.mjs <row> tab|type:<key> [shot]` (links a Layers row with real typing, prints the toast).
- `document.querySelector(...)` evaluated through `ui` returns `undefined` (DOM nodes do not serialise): always read `?.innerText` / `?.getBoundingClientRect()` when testing "is it visible".
- The "Link all" toast disappears after 12 s (6 s after the mouse leaves it) - `uishot` (`execSync`) takes ~2 s, take shots right after the action.
- The key menu keeps the option lists of the other rows in the DOM (hidden): scope DOM queries to the visible one.

## Added in composable-editor round (Messages tab on `<inlang-pattern-editor>` / `<inlang-message-forms>`)
- The Messages tab has no `inlang-bundle` any more: rows are `.message-group-inlang` > `.inlang-row` (locale in `.inlang-row-locale span`) > `inlang-pattern-editor` (light DOM, `[contenteditable]`) and `inlang-message-forms` (shadow DOM, `button.form`). **`tools/ce.mjs "<async js with d, shot, G, F, R, fig>"`** (`FILE=`): `d.msg(name)` searches `name:<key>` (rows are lazy - always search first), `F(name, locale)` = contenteditable expr, `R(name, locale)` = row, `d.setText(name, locale, text)`, `d.val(name, locale)`. `ce-typing.mjs <key> <locale> "<text>" [gapMs]` (char-by-char typing + mutation log), `ce-undo.mjs <key> <locale> "<text>" [undos]`, `ce-colors.mjs "name:<key>"` (computed colours / fonts of the editor), `ce-perf.mjs` (open, scroll, typing latency on the 5k file).
- ICU fixtures with plurals: flat keys (`"ce.items": "{count, plural, …}"`) import with the ICU format, nested objects are dropped. Delete test messages again through the trash icon + "Delete message" (click the LAST visible button, hidden helper rows also contain one).

## Added in composable-editor round 2 (several plugin UIs open at once)
- **`FILE=<file id substring>` selects the Figma file for every `cdp.mjs` command and for `drive.mjs`/`qa-lib.mjs`/`ce.mjs` scripts** (`FILE=4Xgyn node cdp.mjs ui "..."`). The plugin UI iframe is no longer "the first localhost:5180 iframe": `tools/ui-target.mjs` (`uiTarget(file)`) resolves each CDP iframe target's `parentId` chain to the page whose URL contains the file id. With two plugin UIs open and no `FILE` the tools throw `ambiguous`; with one open they still work without it. `cdp.mjs` page commands no longer fall back to "the first design tab" when the file is not found (they throw).
- **Protected files**: every tool refuses to touch a file listed in `QA_PROTECT` (default `iXZRCg` = the owner's live file, `QA_PROTECT=` disables). `run-plugin.mjs` and `close-plugin` no longer call `bringToFront()` (the owner may be looking at another tab); Playwright emulates focus per page, so real keyboard/mouse input still reaches a background tab.
- If a test file's tab was closed, `open "figma://file/<id>"` opens it again (focuses the new tab in Figma; nothing else changes).
- `drive.mjs open()` retries `connectOverCDP` (60 s timeout x3): while Figma is busy the 30 s default sometimes expires.
- **`tools/ce2-undo.mjs <key> <locale> "<text>" [rounds]`** (edit a field, click the canvas, Cmd+Z / Cmd+Shift+Z; prints ms from key press to the sandbox->UI `cacheUpdate` and to the field mutation), **`ce2-timeline.mjs`** (every UI message / DOM mutation after one Cmd+Z, relative to the key press), **`ce2-profile.mjs`** (CPU profile of the UI iframe around a Cmd+Z), **`ce2-sandbox-profile.mjs`** (profile of the Figma page = plugin sandbox, noisy: the plugin VM is a wasm QuickJS).
- Messages that are not linked to a layer can be used for undo tests (root plugin data is undone by Figma too). The plugin sandbox runs in a QuickJS VM: reading all bundles (`getPluginData` x 6000) costs ~60 ms in a normal page but hundreds of ms in the sandbox, and while it runs the sandbox cannot answer UI requests (`getMessagesAsync`).
- Light theme without touching Figma's app-wide preference: inject a `<style>` overriding the `--figma-color-*` tokens in the plugin iframe (see `ce2-22..24` shots; values approximate Figma's light palette).
- A message made plural/select through the new "Plural & select" header button: `ce2-*` shots. Fixtures `ce2.*` (ICU import) were deleted again.

## Added in composable-editor round 3 (one set of translation rules, exact numbers, select values)
- **`tools/ce3-dump.mjs <key> [shot]`** (`FILE=`): per language row of a message, the forms strip (`MISSING` = "+ Add form", `optional` = "+ Add", otherwise `<label>: <text>`) and the problems line. Use it to check that the strip and the problems agree.
- **`tools/ce3-filter.mjs "<search>" "<filter label prefix>" [shot]`** (`FILE=`): sets the search and the "All messages / Missing in … / With problems" filter with real clicks and prints the visible message names (the problems filter = `checkBundle` diagnostics incl. `missing-variant`).
- The "Plural & select" drawer lists the exact numbers of a plural (`=0 ×`, "+ Exact number") and the values of a select (`female ×`, "+ Value"); value changes keep the drawer open, deleting asks for confirmation inline. Clicking the search field closes the drawer (outside click): re-open it before the next step. In zsh quote `'=0'` in env assignments (`LABEL='=0'`), `=0` alone is a command lookup.
- `import-file.mjs` clicks the first `button` with text "Import", which can be the tab: use the dialog's button (`.top-drawer.open button`). ICU fixtures `ce3.*` (en/de/ru) were deleted again.

## Added in the ICU round (icu1 import/export)
- Fixtures `.qa/fixtures/icu/{en,de,ru}.json` (plural with `=0`/offset/`#`, gender select, select nested in plural, plural nested in select, selectordinal, escapes, `{n, number}`, `{d, date, short}`; de/ru have deliberate problems: de inbox without `=0`/`=1`, de party without `{guest}`, ru empty `male {}`). Copy to `/tmp/parrot-qa/icu-*.json` for uploads.
- The Messages editor is composable now (`.figma-inlang-editor` / `.inlang-row[data-locale]`), not `inlang-bundle`: use `rowExpr(bundleId, locale)` + `fieldOf(row)` from `qa-lib.mjs` (`fieldExpr` no longer finds fields). `qa-lib.ctx()` defaults to `4Xgyn` - pass the file id.
- `tools/icu-search.mjs "<query>" [shot]`, `icu-fields.mjs "<query>"` (pattern field HTML), `icu-type.mjs "<query>" <id> <locale> "<text>" [shot]` (types at the end of a field), `icu-switch.mjs "<Language - xx>" [shot]` (switches the frame by its row menu, prints the canvas texts), `icu-delete.mjs <key>...` (trash + "Delete message", waits for the dialog). All take `FILE=<file id>`.
- Two plugin UIs can be open (another file): always set `FILE=` for `cdp.mjs ui`.
