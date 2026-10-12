// usage: FILE=4Xgyn node r3-mie-undo2.mjs <bundleId> "<text to type>" [undos=1] : like r3-mie-undo but polls the state every 300 ms after each Cmd+Z / redo
import { ctx, fieldExpr } from "./qa-lib.mjs";
const [id, text, undos = "1"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
const snap = async () => {
  const stored = await d.fig(`(()=>{const r=figma.root.getPluginData('prt_ib__'+${JSON.stringify(id)});if(!r)return null;return JSON.parse(r).messages.map(m=>m.locale+':'+m.variants.map(v=>v.pattern.map(p=>p.value??'{'+p.arg?.name+'}').join('')).join('/')).join(',')})()`);
  const canvas = await d.fig(`figma.currentPage.findAll(n=>n.type==='TEXT'&&n.getPluginData('mn')===${JSON.stringify(id)}).map(n=>n.characters).join('|')`);
  const field = await d.ui(`(()=>{const e=${fieldExpr(id, 0)};return e&&e.textContent})()`);
  return `stored=${stored} canvas=${canvas} field=${field}`;
};
const poll = async (label, ms) => { const t0 = Date.now(); let last = ""; while (Date.now() - t0 < ms) { const s = await snap(); if (s !== last) { console.log(label, String(Date.now() - t0).padStart(5), s); last = s; } await d.sleep(250); } };
try {
  console.log("start", await snap());
  await d.clickEl(fieldExpr(id, 0)); await d.key("Meta+a"); await d.type(text);
  await poll("edit", 3000);
  if (process.env.CANVAS) { await d.page.mouse.click(832, 113); await d.sleep(600); }
  if (process.env.BLUR) { await d.clickEl(`document.querySelector('[data-message-id=${JSON.stringify(id)}] .message-group-header-name')`); await d.sleep(500); console.log("blurred, active:", await d.ui("document.activeElement?.tagName+' '+(document.activeElement?.className||'')")); }
  for (let i = 0; i < Number(undos); i++) { await d.key("Meta+z"); await poll("undo" + (i + 1), 3500); }
  await d.key("Meta+Shift+z"); await poll("redo", 3500);
} finally { await d.close(); }
