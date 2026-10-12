// usage: FILE=4Xgyn node r3-mie-type.mjs <bundleId> <localeIdx> "<text>" [delayMs] ; real typing into a Messages field (select all first), then dumps field text + store text
import { ctx, fieldExpr } from "./qa-lib.mjs";
const [id, idx, text, delay = "15"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
try {
  await d.clickEl(fieldExpr(id, Number(idx))); await d.key("Meta+a");
  const t0 = Date.now();
  for (const ch of text) { await d.page.keyboard.type(ch); await d.sleep(Number(delay)); }
  console.log("typed in", Date.now() - t0, "ms");
  await d.sleep(1500);
  console.log("field:", JSON.stringify(await d.ui(`(()=>{const e=${fieldExpr(id, Number(idx))};return e&&e.textContent})()`)));
  console.log("canvas:", JSON.stringify(await d.fig(`figma.currentPage.findAll(n=>n.type==='TEXT'&&n.getPluginData('mn')===${JSON.stringify(id)}).map(n=>[n.parent.name,n.characters])`)));
  console.log("stored:", await d.fig(`figma.root.getPluginData('prt_ib__'+${JSON.stringify(id)}).slice(0,600)`));
} finally { await d.close(); }
