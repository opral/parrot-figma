// Hosted-release QA: attaches to the Parrot UI iframe (PARROT_UI_ORIGIN, FILE=<file id>) and its workers over raw CDP and prints
// console output, exceptions, Log entries (CSP / CORS / network errors) and every network request with its status.
//   PARROT_UI_ORIGIN=https://opral.github.io FILE=4Xgyn node hosted-probe.mjs [seconds=20] [--reload] [--out file.json]
// --reload reloads the UI document after attaching with the cache disabled (everything a fresh UI load requests is then recorded; the plugin sandbox keeps running).
import { writeFileSync } from "node:fs";
import { uiTarget } from "./ui-target.mjs";
const secs = Number(process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : 20);
const reload = process.argv.includes("--reload");
const out = process.argv.includes("--out") ? process.argv[process.argv.indexOf("--out") + 1] : null;
const t = await uiTarget();
const ws = new WebSocket(t.webSocketDebuggerUrl);
await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
let id = 0; const pending = new Map(); const events = []; const reqs = new Map(); const sessions = new Map();
const send = (method, params = {}, sessionId) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) })); });
const log = (kind, sid, data) => { const e = { t: Date.now(), kind, where: sid ? (sessions.get(sid) ?? "child") : "ui", ...data }; events.push(e); console.log(JSON.stringify(e).slice(0, 700)); };
const argText = (a) => a.value ?? a.description ?? a.type;
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  const sid = m.sessionId;
  switch (m.method) {
    case "Runtime.consoleAPICalled": log("console." + m.params.type, sid, { text: m.params.args.map(argText).join(" ").slice(0, 400) }); break;
    case "Runtime.exceptionThrown": log("exception", sid, { text: JSON.stringify(m.params.exceptionDetails).slice(0, 600) }); break;
    case "Log.entryAdded": log("log." + m.params.entry.level, sid, { source: m.params.entry.source, text: m.params.entry.text.slice(0, 400), url: m.params.entry.url }); break;
    case "Network.requestWillBeSent": reqs.set(m.params.requestId, { url: m.params.request.url, method: m.params.request.method, type: m.params.type, sid, postData: m.params.request.postData?.slice(0, 600) }); break;
    case "Network.responseReceived": { const r = reqs.get(m.params.requestId) ?? {}; Object.assign(r, { status: m.params.response.status, mime: m.params.response.mimeType, cors: m.params.response.headers?.["access-control-allow-origin"] ?? m.params.response.headers?.["Access-Control-Allow-Origin"], fromCache: m.params.response.fromDiskCache || m.params.response.fromPrefetchCache }); reqs.set(m.params.requestId, r); break; }
    case "Network.loadingFailed": { const r = reqs.get(m.params.requestId) ?? {}; Object.assign(r, { failed: m.params.errorText, blocked: m.params.blockedReason, cors: m.params.corsErrorStatus?.corsError }); reqs.set(m.params.requestId, r); log("net.failed", sid, { url: r.url, error: m.params.errorText, blocked: m.params.blockedReason, corsError: m.params.corsErrorStatus?.corsError }); break; }
    case "Target.attachedToTarget": { sessions.set(m.params.sessionId, `${m.params.targetInfo.type}:${m.params.targetInfo.url.slice(0, 90)}`); log("target.attached", sid, { type: m.params.targetInfo.type, url: m.params.targetInfo.url.slice(0, 120) }); enable(m.params.sessionId); break; }
  }
};
async function enable(sid) {
  for (const d of ["Runtime", "Log", "Network"]) await send(d + ".enable", {}, sid);
  await send("Target.setAutoAttach", { autoAttach: true, waitForDebuggerOnStart: false, flatten: true }, sid);
}
await enable(undefined);
console.log("attached to", t.url);
if (reload) { await send("Network.setCacheDisabled", { cacheDisabled: true }, undefined); await send("Runtime.evaluate", { expression: "setTimeout(() => location.reload(), 50)" }); }
await new Promise((r) => setTimeout(r, secs * 1000));
const summary = [...reqs.values()].filter((r) => r.url);
const origins = {};
for (const r of summary) { try { const o = new URL(r.url).origin; origins[o] = (origins[o] ?? 0) + 1; } catch { origins[r.url.slice(0, 20)] = (origins[r.url.slice(0, 20)] ?? 0) + 1; } }
console.log("REQUEST ORIGINS", JSON.stringify(origins));
console.log("NON-2xx/failed", JSON.stringify(summary.filter((r) => r.failed || (r.status && (r.status < 200 || r.status >= 300))).map((r) => ({ url: r.url.slice(0, 120), status: r.status, failed: r.failed }))));
if (out) writeFileSync(out, JSON.stringify({ events, requests: summary }, null, 1));
ws.close();
