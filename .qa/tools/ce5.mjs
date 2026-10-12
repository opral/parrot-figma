// ce5 QA helper (FILE=<id>): node ce5.mjs <search> [shot]  - Messages tab filtered to <search>, then a plugin screenshot
import { ctx, search } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const file = process.env.FILE || "7cQCVw";
const [q, shot] = process.argv.slice(2);
const d = await ctx(file);
try { await search(d, q); if (shot) execSync(`node cdp.mjs uishot ../shots/${shot}.png ${file}`, { cwd: import.meta.dirname, env: { ...process.env, FILE: file } }); }
finally { await d.close(); }
