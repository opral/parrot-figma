// Scripting helper for multi-step UI flows in ONE process (much faster than many `node cdp.mjs` calls).
//   import { open } from "./drive.mjs"; const d = await open("0EJ5M7");
//   await d.click(".tab", "Export")   // real mouse click on first visible element matching selector (+exact trimmed text)
//   await d.ui("js expression")       // evaluate in plugin UI iframe (async ok)
//   await d.upload("selector", "/abs/file"); await d.type("text"); await d.key("Enter"); await d.close()
import { chromium } from "playwright-core";
import { uiTarget, assertNotProtected } from "./ui-target.mjs";
export async function open(fileMatch) {
  // connecting is sometimes slow while Figma is busy (30 s timeout): retry
  let browser;
  for (let i = 0; !browser; i++) { try { browser = await chromium.connectOverCDP("http://localhost:9222", { timeout: 60000 }); } catch (e) { if (i >= 2) throw e; } }
  const pages = browser.contexts().flatMap((c) => c.pages());
  const page = pages.find((p) => p.url().includes(fileMatch));
  if (!page) throw new Error("no Figma page matches " + fileMatch);
  assertNotProtected(page.url());
  const t = await uiTarget(fileMatch); // the plugin UI of THIS file (several UIs may be open)
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = new Map();
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  const ui = async (expression) => { const res = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }); if (res.result?.exceptionDetails) throw new Error(JSON.stringify(res.result.exceptionDetails).slice(0, 1500)); return res.result?.result?.value; };
  const frameOrigin = () => page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: f.x, y: f.y }; });
  const click = async (selector, text, nth = 0) => {
    const pos = await ui(`(()=>{const t=${JSON.stringify(text ?? null)};const els=[...document.querySelectorAll(${JSON.stringify(selector)})].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&(!t||e.textContent.trim()===t)}).sort((a,b)=>t?a.textContent.length-b.textContent.length:0);const e=els[${nth}];if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);
    if (!pos) throw new Error(`click: not found ${selector} ${text ?? ""}`);
    const o = await frameOrigin(); await page.mouse.click(o.x + pos[0], o.y + pos[1]);
  };
  const upload = async (selector, ...files) => { await send("DOM.enable"); const doc = await send("DOM.getDocument", { depth: -1, pierce: true }); const q = await send("DOM.querySelector", { nodeId: doc.result.root.nodeId, selector }); if (!q.result?.nodeId) throw new Error("input not found " + selector); await send("DOM.setFileInputFiles", { nodeId: q.result.nodeId, files }); };
  return { page, ui, click, upload, send, type: (s) => page.keyboard.type(s, { delay: 15 }), key: (k) => page.keyboard.press(k), sleep: (ms) => page.waitForTimeout(ms), eval: (js) => page.evaluate(js), close: async () => { ws.close(); await browser.close(); } };
}
