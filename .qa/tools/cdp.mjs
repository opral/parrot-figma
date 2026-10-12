// Usage: node cdp.mjs <command> [args]
//  upload <selector> <absPath>   set files on an <input type=file> inside the plugin UI (no native dialog)
//  uiconsole [seconds]           stream console logs/exceptions from the plugin UI iframe
//  downloads <dir>               make exports download into <dir> without native save dialog
//  close-plugin                  close the running plugin (reopen with: node run-plugin.mjs)
//  click <x> <y> [pageMatch]     real mouse click at Figma page CSS coords (works inside plugin iframe too)
//  type <text> / key <Key>       keyboard input into focused element (e.g. key Enter, key Meta+a)
// Plugin UI is an out-of-process iframe; "ui" evaluates via raw CDP on that target. It supports top-level await (wrap in async IIFE).
//  pages                         list Figma pages (tabs)
//  frames [pageMatch]            list frames of a page (plugin UI iframe shows up as localhost:5180)
//  eval <pageMatch> <js>         evaluate js in the Figma file page main frame (window.figma available once a plugin ran)
//  (env FILE=<file id> selects the file for all commands; needed when more than one plugin UI is open)
//  ui <js>                       evaluate js inside the Parrot plugin UI frame (localhost:5180)
//  shot <pageMatch> <out.png>    screenshot the page (Figma file view incl. plugin window)
//  uishot <out.png>              screenshot only the plugin iframe element
//  console [seconds]             stream console messages from plugin UI + file page
import { chromium } from "playwright-core";
import { uiTarget, assertNotProtected } from "./ui-target.mjs";
// FILE=<file id substring> picks the Figma file for EVERY command (several plugin UIs may be open): the UI iframe is the one whose parent page URL contains FILE.
// Without FILE: pageMatch args / the old default (4Xgyn) for page commands, and the single open plugin UI for ui/upload/uiconsole (error when ambiguous).
const FILE = process.env.FILE;
const [cmd, ...args] = process.argv.slice(2);
const uiSession = async () => {
  const t = await uiTarget();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map(); const listeners = [];
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } else listeners.forEach((l) => l(m)); };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  return { send, on: (l) => listeners.push(l), close: () => ws.close() };
};
const uiEval = async (expression) => {
  const t = await uiTarget();
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  const res = await new Promise((r) => { ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id === 1) r(m); }; ws.send(JSON.stringify({ id: 1, method: "Runtime.evaluate", params: { expression, awaitPromise: true, returnByValue: true } })); });
  ws.close();
  if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 2000));
  return res.result?.result?.value;
};
const browser = await chromium.connectOverCDP("http://localhost:9222");
const pages = browser.contexts().flatMap((c) => c.pages());
const filePage = (m) => { const want = m ?? FILE ?? "4Xgyn0xmwQsJLHyUaRfpX0"; const p = pages.find((x) => x.url().includes(want)); if (!p) throw new Error("no Figma page matches " + want); assertNotProtected(p.url()); return p; };
const findUi = () => { for (const p of FILE ? pages.filter((x) => x.url().includes(FILE)) : pages) for (const f of p.frames()) if (f.url().startsWith("http://localhost:5180")) return { page: p, frame: f }; return null; };
const uiFrame = async () => { for (let i = 0; i < 20; i++) { const u = findUi(); if (u) return u; await new Promise((r) => setTimeout(r, 250)); } return null; };
try {
  if (cmd === "pages") for (const p of pages) console.log(p.url(), "|", await p.title().catch(() => ""));
  else if (cmd === "frames") { await new Promise((r) => setTimeout(r, 1500)); for (const p of pages) for (const f of p.frames()) console.log(p.url().slice(0,50), "=>", f.url().slice(0, 200)); }
  else if (cmd === "eval") { const r = await filePage(args[0]).evaluate(args[1]); console.log(typeof r === "string" ? r : JSON.stringify(r, null, 2)); }
  else if (cmd === "ui") { const r = await uiEval(args[0]); console.log(typeof r === "string" ? r : JSON.stringify(r, null, 2)); }
  else if (cmd === "shot") { await filePage(args[0]).screenshot({ path: args[1] }); console.log(args[1]); }
  else if (cmd === "uishot") { const p = filePage(args[1]); const b = await p.evaluate(() => { const f = [...document.querySelectorAll("iframe")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200 && r.height > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return f && { x: f.x, y: f.y - 40, width: f.width, height: f.height + 40 }; }); await p.screenshot({ path: args[0], clip: b ?? undefined }); console.log(args[0]); }
  else if (cmd === "upload") { // upload <cssSelectorOfInputTypeFile> <absPath...>
    const s = await uiSession(); await s.send("DOM.enable"); const doc = await s.send("DOM.getDocument", { depth: -1, pierce: true });
    const q = await s.send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector: args[0] });
    if (!q.result?.nodeId) throw new Error("input not found: " + args[0]);
    const r = await s.send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files: args.slice(1) }); s.close(); console.log(JSON.stringify(r.error ?? "uploaded")); }
  else if (cmd === "uiconsole") { // uiconsole [seconds]  stream console + exceptions from the plugin UI iframe
    const s = await uiSession(); s.on((m) => { if (m.method === "Runtime.consoleAPICalled") console.log(`[${m.params.type}]`, m.params.args.map((a) => a.value ?? a.description ?? a.type).join(" ").slice(0, 500)); if (m.method === "Runtime.exceptionThrown") console.log("[exception]", JSON.stringify(m.params.exceptionDetails).slice(0, 800)); });
    await s.send("Runtime.enable"); await new Promise((r) => setTimeout(r, Number(args[0] ?? 10) * 1000)); s.close(); }
  else if (cmd === "downloads") { // downloads <dir> [seconds=900]  auto-save downloads (exports) into dir without a native dialog. The behaviour only lasts while this process is attached -> run it in the background and keep it running while exporting
    const c = await browser.newBrowserCDPSession(); c.on("Browser.downloadWillBegin", (e) => console.log("download:", e.suggestedFilename, e.url.slice(0, 40))); c.on("Browser.downloadProgress", (e) => console.log("progress:", e.state, e.receivedBytes, e.totalBytes)); const r = await c.send("Browser.setDownloadBehavior", { behavior: "allow", downloadPath: args[0], eventsEnabled: true }).catch((e) => e.message); console.log(JSON.stringify(r)); await new Promise((r) => setTimeout(r, Number(args[1] ?? 900) * 1000)); }
  else if (cmd === "offline") { // offline <seconds> [fail|<http status>] [pageMatch]  make requests to translate.googleapis.com fail ("Failed to fetch") or answer with an HTTP status. Machine translation runs in the plugin sandbox (Figma page), so the route is installed on the file page; the process must stay alive -> run in background
    const p = filePage(args[2]); const mode = args[1] ?? "fail";
    await p.context().route("**/translate.googleapis.com/**", (route) => (mode === "fail" ? route.abort("internetdisconnected") : route.fulfill({ status: Number(mode), body: "" })));
    console.log("blocking translate.googleapis.com:", mode); await new Promise((r) => setTimeout(r, Number(args[0] ?? 20) * 1000)); await p.context().unroute("**/translate.googleapis.com/**"); }
  else if (cmd === "close-plugin") { const p = filePage(args[0]); await p.keyboard.press("Escape"); const ok = await p.evaluate(() => { try { figma.closePlugin(); return "closed via figma.closePlugin"; } catch (e) { return String(e); } }); console.log(ok); }
  else if (cmd === "click") { const p = filePage(args[2]); await p.mouse.click(Number(args[0]), Number(args[1])); console.log("clicked"); }
  else if (cmd === "type") { const p = filePage(args[1]); await p.keyboard.type(args[0], { delay: 15 }); console.log("typed"); }
  else if (cmd === "key") { const p = filePage(args[1]); await p.keyboard.press(args[0]); console.log("pressed"); }
  else if (cmd === "console") { const secs = Number(args[0] ?? 10); for (const p of pages) p.on("console", (m) => console.log(`[${m.type()}] ${m.location().url?.slice(0, 60)} ${m.text()}`)); await new Promise((r) => setTimeout(r, secs * 1000)); }
  else console.log("unknown command");
} finally { await browser.close().catch(() => {}); }
