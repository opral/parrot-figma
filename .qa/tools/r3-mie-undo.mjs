// usage: FILE=4Xgyn node r3-mie-undo.mjs <bundleId> "<text to type>" [redo=0]
// Messages tab: edit field 0 of a bundle with real typing, Cmd+Z (real key to Figma), report file bundle text / canvas / UI field / search result at each step
import { ctx, fieldExpr } from "./qa-lib.mjs";
const [id, text, redo = "0"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
const snap = async (label) => {
  const stored = await d.fig(`(()=>{const r=figma.root.getPluginData('prt_ib__'+${JSON.stringify(id)});if(!r)return null;return JSON.parse(r).messages.map(m=>m.locale+':'+m.variants.map(v=>v.pattern.map(p=>p.value??'{'+p.arg?.name+'}').join('')).join('/'))})()`);
  const canvas = await d.fig(`figma.currentPage.findAll(n=>n.type==='TEXT'&&n.getPluginData('mn')===${JSON.stringify(id)}).map(n=>n.characters)`);
  const field = await d.ui(`(()=>{const e=${fieldExpr(id, 0)};return e&&e.textContent})()`);
  console.log(label.padEnd(10), JSON.stringify({ stored, canvas, field }));
};
try {
  await snap("start");
  await d.clickEl(fieldExpr(id, 0)); await d.key("Meta+a"); await d.type(text); await d.sleep(2000);
  await snap("edited");
  await d.key("Meta+z"); await d.sleep(2500);
  await snap("undo");
  if (redo !== "0") { await d.key("Meta+Shift+z"); await d.sleep(2500); await snap("redo"); }
} finally { await d.close(); }
