// FILE=ZXC9xq node mt-bulk.mjs "<language label start>" selection|page "Frame A,Frame B" [shot]
// selects frames on page "QA mt", uses the bulk bar (real clicks), prints the confirm drawer text, the progress and the final notice
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE || "ZXC9xq";
const d = await ctx(FILE);
const [lang, scope, names, shotName] = process.argv.slice(2);
await d.fig(`(()=>{figma.currentPage=figma.root.children.find(p=>p.name==='QA mt'); const n=${JSON.stringify((names||"").split(","))}.filter(Boolean).map(x=>figma.currentPage.findOne(c=>c.name===x)); figma.currentPage.selection=n;})()`);
await d.sleep(1500); await d.click(".tab", "Layers"); await d.sleep(600);
const sel = scope === "selection";
await d.clickEl(`document.querySelectorAll('.bulk-language-select button')[${sel ? 0 : (names.split(",").length > 1 ? 1 : 0)}]`);
await d.sleep(600);
await d.clickEl(`[...document.querySelectorAll('.select-menu__item')].filter(e=>e.innerText.startsWith(${JSON.stringify(lang)}))[0]`);
if (!sel) {
  await d.sleep(900);
  console.log("drawer:", await d.ui('document.querySelector(".top-drawer.open")?.innerText'));
  if (shotName) execSync(`node cdp.mjs uishot ../shots/${shotName}-drawer.png ${FILE}`);
  await d.clickEl("[...document.querySelectorAll('.top-drawer.open button')].find(b=>b.innerText.includes('Switch page'))");
}
const t0 = Date.now(); let seen = [];
for (let i = 0; i < 600; i++) { const t = await d.ui(`document.querySelector('.bulk-language-bar-label')?.innerText`); if (seen[seen.length-1]?.[1] !== t) seen.push([Date.now()-t0, t]); if (i > 3 && t !== undefined && !/Switching/.test(t)) break; await d.sleep(100); }
console.log(JSON.stringify(seen)); console.log("total ms", Date.now() - t0);
await d.sleep(300);
if (shotName) execSync(`node cdp.mjs shot ${FILE} ../shots/${shotName}.png`);
await d.close();
