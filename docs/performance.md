# Performance verification

Parrot uses two complementary performance checks:

- `pnpm test:big-o` gates deterministic operation counts in CI.
- The localhost plugin exposes `window.__PARROT_RUN_REAL_FIGMA_PERFORMANCE__()` in its UI
  DevTools context. It creates isolated pages for 100, 1,000, and 5,000 text nodes, measures
  the production startup scan and indexed lookup paths, then removes every fixture page.

The real-Figma harness is registered only when `VITE_CUSTOM_URL` points the plugin at the local
Vite server; it is not available in production builds. Its last successful result is stored in
Figma client storage and printed as `PARROT_REAL_FIGMA_RESULT` on the next development-plugin run.
The development UI also exposes a benchmark button. Each requested size runs on three fresh,
removed-after-use fixture pages by default and reports every trial plus the median for O(1)
readiness, native cold indexing, durable warm hydration, and indexed lookup. Fixture creation is
reported separately and is never included in the startup targets.

## Baseline

Measured in Figma Desktop on August 11, 2026, before the next traversal optimization:

| Text nodes | Startup scan | Indexed lookup | Matches |
| ---------- | ------------ | -------------- | ------- |
| 100        | 424 ms       | 2 ms           | 2       |
| 1,000      | 3,584 ms     | 3 ms           | 2       |
| 5,000      | 20,442 ms    | 3 ms           | 2       |

The lookup remains independent of unrelated document size. The startup scan is linear in node
count, but this baseline identifies its real-Figma constant factor as the next bottleneck.

## Native current-page indexing

Measured in the same Figma Desktop environment after switching cold discovery to
`findAllWithCriteria({ types: ["TEXT"] })` and deferring other pages:

| Text nodes | Recursive scan | Native index | Indexed lookup |
| ---------- | -------------- | ------------ | -------------- |
| 100        | 193 ms         | 2 ms         | 1 ms           |
| 1,000      | 1,916 ms       | 25 ms        | 2 ms           |
| 5,000      | 13,024 ms      | 126 ms       | 2 ms           |

Fixture creation is measured separately and excluded. This historical same-fixture observation
showed the native 5,000-node index roughly 103× faster than recursive scanning. The current harness
instead uses repeated fresh fixture pages and reports readiness, native indexing, durable hydration,
and lookup independently. “Cold index” means a fresh application index over newly created Figma
nodes; it does not claim a cold Figma process or operating-system cache.

The first readiness publication is O(1): it performs no page traversal, node lookup, or plugin-data
read. Durable hydration then runs after a task yield in O(K + L), where K is the page plugin-data
key count and L is the number of durable linked labels, followed by an O(T + K) native
reconciliation. In the real-Figma fixture with two linked labels, the warmed hydration observation
was below the one-millisecond timer resolution; this is deliberately not claimed as a general
latency bound for large L. The deterministic gate varies 0–1,000 links with 5,000 total text nodes
and verifies zero document traversal.
