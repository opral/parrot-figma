# Performance verification

Parrot uses two complementary performance checks:

- `pnpm test:big-o` gates deterministic operation counts in CI.
- The localhost plugin exposes `window.__PARROT_RUN_REAL_FIGMA_PERFORMANCE__()` in its UI
  DevTools context. It creates isolated pages for 100, 1,000, and 5,000 text nodes, measures
  the production startup scan and indexed lookup paths, then removes every fixture page.

The real-Figma harness is registered only when `VITE_CUSTOM_URL` points the plugin at the local
Vite server; it is not available in production builds. Its last successful result is stored in
Figma client storage and printed as `PARROT_REAL_FIGMA_RESULT` on the next development-plugin run.

## Baseline

Measured in Figma Desktop on August 11, 2026, before the next traversal optimization:

| Text nodes | Startup scan | Indexed lookup | Matches |
| ---------- | ------------ | -------------- | ------- |
| 100        | 424 ms       | 2 ms           | 2       |
| 1,000      | 3,584 ms     | 3 ms           | 2       |
| 5,000      | 20,442 ms    | 3 ms           | 2       |

The lookup remains independent of unrelated document size. The startup scan is linear in node
count, but this baseline identifies its real-Figma constant factor as the next bottleneck.
