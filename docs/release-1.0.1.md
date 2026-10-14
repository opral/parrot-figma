# Parrot 1.0.1 deployment

Published on October 14, 2026 as **Figma Community version 113**, plugin ID `1205803482754362456`.

- [Community listing](https://www.figma.com/community/plugin/1205803482754362456/parrot-localization-language-translation-no-lorem-ipsum-translator-i18n-l10n-html-global)
- [Hosted UI](https://opral.github.io/parrot-figma/releases/1.0.1/index.html)
- Source commit: `731d3f06133438fac9a04c198e1b40cd2be6e150` on `fix/dynamic-page-loading`.
- [Release build](https://github.com/opral/parrot-figma/actions/runs/38591086474): successful typecheck, lint, 222 tests, UI build, plugin build and artifact upload.
- [Pages deployment](https://github.com/opral/parrot-figma/actions/runs/38591303130): successful. Hosting commit `1157bc8` adds `releases/1.0.1` and preserves `releases/1.0.0`.
- Local release bundle: `/Users/samuel/Downloads/parrot-release-1.0.1`. Its local manifest name distinguishes it from other development registrations sharing the plugin ID.

The hosted HTML matches the CI artifact. All 18 asset URLs return HTTP 200, including correct WebAssembly MIME types. The hosted production UI and worker loaded in native Figma, and Messages displayed the fixture's English/German translations and line breaks.

The Figma publisher confirmed “And you’re live!”; the Community page shows version 113 and the new description. The description's final GitHub repository hyperlink points to `https://github.com/opral/parrot-figma`, replacing Discord. The obsolete built-in Google Translate promise was removed. The security declaration describes local Figma storage and usage counters/hashed user and file identifiers sent through inlang.com to PostHog, without claiming that these identifiers are unrelated to Figma's API.

Figma's two-factor warning persisted until Help → Troubleshooting → Reload All Tabs refreshed the desktop session after the account had already enabled two-factor authentication. Publication then succeeded through the normal Figma controls.

The project compatibility limits in [compatibility.md](compatibility.md) were included in the public description and release notes. Supported projects upgrade automatically; unsupported historical records preserve their original data and stop migration. Older plugin versions cannot read migrated native bundles.

Source integration remains tracked by [PR #80](https://github.com/opral/parrot-figma/pull/80); this release was built directly from its head branch.
