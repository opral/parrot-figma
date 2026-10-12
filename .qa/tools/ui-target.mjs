// Resolve the Parrot plugin UI iframe (localhost:5180) that belongs to ONE Figma file page, even when several plugin UIs are open.
// CDP /json/list lists every out-of-process iframe as its own target with a `parentId`; follow the chain up to the page target whose URL contains the file id.
//   const t = await uiTarget("4Xgyn");   // -> { id, url, webSocketDebuggerUrl, pageUrl }
// Without a file (arg and env FILE both empty): the only open plugin UI, or an error when it is ambiguous.
export async function uiTarget(fileMatch = process.env.FILE) {
  const targets = await (await fetch("http://localhost:9222/json/list")).json();
  const byId = new Map(targets.map((t) => [t.id, t]));
  const pageOf = (t) => { let c = t; for (let i = 0; i < 10 && c?.parentId; i++) c = byId.get(c.parentId); return c; };
  const uis = targets.filter((x) => x.type === "iframe" && x.url.startsWith("http://localhost:5180")).map((t) => ({ ...t, pageUrl: pageOf(t)?.url ?? "" }));
  const mine = fileMatch ? uis.filter((t) => t.pageUrl.includes(fileMatch)) : uis;
  if (!mine.length) throw new Error(`Parrot UI iframe not found for ${fileMatch ?? "any file"} (is the plugin open there?). Open UIs: ${uis.map((t) => t.pageUrl.slice(0, 60)).join(" | ") || "none"}`);
  if (mine.length > 1) throw new Error(`ambiguous: ${mine.length} plugin UIs are open, set FILE=<file id substring>`);
  assertNotProtected(mine[0].pageUrl, "plugin UI");
  return mine[0];
}

// Files the owner is using live: every tool refuses to touch their page / plugin UI (env QA_PROTECT=<id,id..>, QA_PROTECT="" disables, default iXZRCg).
export const protectedFiles = () => (process.env.QA_PROTECT ?? "iXZRCg").split(",").filter(Boolean);
export const assertNotProtected = (url, what = "page") => { const hit = protectedFiles().find((f) => url.includes(f)); if (hit) throw new Error(`refusing to touch protected file ${hit} (${what}); set QA_PROTECT= to override`); };
