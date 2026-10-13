// Resolve the Parrot plugin UI iframe (origin PARROT_UI_ORIGIN, default the dev server http://localhost:5180) that belongs to ONE Figma file page, even when several plugin UIs are open.
// CDP /json/list lists every out-of-process iframe as its own target with a `parentId`; follow the chain up to the page target whose URL contains the file id.
//   const t = await uiTarget("4Xgyn");   // -> { id, url, webSocketDebuggerUrl, pageUrl }
// Without a file (arg and env FILE both empty): the only open plugin UI, or an error when it is ambiguous.
// Hosted-release QA: PARROT_UI_ORIGIN=https://opral.github.io (the UI iframe of a released build) and PARROT_PLUGIN_NAME=<name in the released manifest>.
export const uiOrigin = () => process.env.PARROT_UI_ORIGIN ?? "http://localhost:5180";
export const pluginName = () => process.env.PARROT_PLUGIN_NAME ?? "Parrot (development)";
export async function uiTarget(fileMatch = process.env.FILE) {
  const targets = await (await fetch("http://localhost:9222/json/list")).json();
  const byId = new Map(targets.map((t) => [t.id, t]));
  const pageOf = (t) => { let c = t; for (let i = 0; i < 10 && c?.parentId; i++) c = byId.get(c.parentId); return c; };
  const uis = targets.filter((x) => x.type === "iframe" && x.url.startsWith(uiOrigin())).map((t) => ({ ...t, pageUrl: pageOf(t)?.url ?? "" }));
  const mine = fileMatch ? uis.filter((t) => t.pageUrl.includes(fileMatch)) : uis;
  if (!mine.length) throw new Error(`Parrot UI iframe not found for ${fileMatch ?? "any file"} (is the plugin open there?). Open UIs: ${uis.map((t) => t.pageUrl.slice(0, 60)).join(" | ") || "none"}`);
  if (mine.length > 1) throw new Error(`ambiguous: ${mine.length} plugin UIs are open, set FILE=<file id substring>`);
  assertNotProtected(mine[0].pageUrl, "plugin UI");
  return mine[0];
}

// Files the owner is using live: every tool refuses to touch their page / plugin UI (env QA_PROTECT=<id,id..>, QA_PROTECT="" disables, default iXZRCg).
export const protectedFiles = () => (process.env.QA_PROTECT ?? "iXZRCg").split(",").filter(Boolean);
export const assertNotProtected = (url, what = "page") => { const hit = protectedFiles().find((f) => url.includes(f)); if (hit) throw new Error(`refusing to touch protected file ${hit} (${what}); set QA_PROTECT= to override`); };

// QA_FRONT=<file id> (e.g. 4Xgyn0xmwQsJLHyUaRfpX0): before EVERY real input (mouse click, key press, typing) the tab of that file is brought to the front and verified
// (visible + its URL contains the id), otherwise the input is refused. Use it when the owner's own tab is open in the same Figma instance. Wrap a page once with guardInput(page).
export async function ensureFront(page) {
  const want = process.env.QA_FRONT; if (!want) return;
  assertNotProtected(page.url(), "front tab");
  await page.bringToFront();
  await new Promise((r) => setTimeout(r, 150));
  const s = await page.evaluate(() => ({ href: location.href, vis: document.visibilityState }));
  if (!s.href.includes(want) || s.vis !== "visible") throw new Error(`front check failed (wanted ${want}): ${s.vis} ${s.href.slice(0, 90)}`);
}
export function guardInput(page) {
  if (!process.env.QA_FRONT || page.__guarded) return page;
  page.__guarded = true;
  for (const [obj, names] of [[page.mouse, ["click", "dblclick", "down", "up", "wheel"]], [page.keyboard, ["press", "type", "down", "insertText"]]])
    for (const n of names) { const orig = obj[n].bind(obj); obj[n] = async (...a) => { await ensureFront(page); return orig(...a); }; }
  return page;
}
