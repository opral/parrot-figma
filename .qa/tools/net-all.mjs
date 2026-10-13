// Hosted-release QA: records the network requests of ONE Figma file tab (FILE=<id>): the page itself, its plugin-sandbox iframes and the plugin UI iframe.
// Prints the request origins with counts and every URL that is not a figma.com one. Run it in the background while you drive the plugin.
//   FILE=4Xgyn node net-all.mjs <seconds> [out.json]
import { writeFileSync } from "node:fs";
import { assertNotProtected } from "./ui-target.mjs";
const FILE = process.env.FILE ?? "4Xgyn0xmwQsJLHyUaRfpX0";
const secs = Number(process.argv[2] ?? 30);
const targets = await (await fetch("http://localhost:9222/json/list")).json();
const byId = new Map(targets.map((t) => [t.id, t]));
const pageOf = (t) => { let c = t; for (let i = 0; i < 10 && c?.parentId; i++) c = byId.get(c.parentId); return c; };
const mine = targets.filter((t) => (t.type === "page" || t.type === "iframe") && (pageOf(t)?.url ?? t.url).includes(FILE));
const reqs = [];
await Promise.all(mine.map(async (t) => {
  assertNotProtected(pageOf(t)?.url ?? t.url, "network target");
  const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const where = t.type === "page" ? "page" : t.url.slice(0, 60);
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.method === "Network.requestWillBeSent") reqs.push({ where, url: m.params.request.url, method: m.params.request.method, type: m.params.type }); };
  ws.send(JSON.stringify({ id: 1, method: "Network.enable" }));
  setTimeout(() => ws.close(), secs * 1000);
}));
console.log("recording", mine.map((t) => t.type + ":" + t.url.slice(0, 50)).join(" | "));
await new Promise((r) => setTimeout(r, secs * 1000 + 500));
const origin = (u) => { try { return new URL(u).origin; } catch { return u.slice(0, 12); } };
const counts = {}; for (const r of reqs) counts[origin(r.url)] = (counts[origin(r.url)] ?? 0) + 1;
console.log("ORIGINS", JSON.stringify(counts));
console.log("NOT figma.com / data / blob:");
for (const r of reqs) if (!/^(https:\/\/([a-z0-9-]+\.)*figma\.com|data:|blob:|about:)/.test(r.url)) console.log(" ", r.where, r.method, r.type, r.url.slice(0, 140));
if (process.argv[3]) writeFileSync(process.argv[3], JSON.stringify(reqs, null, 1));
