// FILE=ZXC9xq node mt-switch.mjs "<frame name>" "<language label substring>" [shotName]
// selects the frame on page "QA mt", switches it through the frame menu (real clicks), times until the frame's `l` changes,
// prints canvas text + plugin data of every text, and takes a full Figma screenshot while the notice is shown.
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE || "ZXC9xq";
const d = await ctx(FILE);
const [frameName, lang, shotName] = process.argv.slice(2);
const snap = () => d.fig(`(()=>{const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)}); return {l:f.getPluginData('l'), texts:f.findAll(n=>n.type==='TEXT').map(t=>[t.characters, t.getPluginData('mn'), t.getPluginData('l'), (()=>{try{return JSON.parse(t.getPluginData('aim')||'null')?.variants?.map(v=>v.languageTag+':'+JSON.stringify(v.pattern).slice(0,50)).join('|')}catch{return '?'}})()])}})()`);
await d.fig(`(async()=>{figma.currentPage=figma.root.children.find(p=>p.name==='QA mt'); const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)}); figma.currentPage.selection=[f]; })()`);
await d.sleep(1500); await d.click(".tab", "Layers"); await d.sleep(600);
const before = await snap();
console.log("before", JSON.stringify(before));
await d.click(".select-menu__button", undefined, Number(process.env.MENU || 1)); await d.sleep(600);
const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())");
const it = items.find((t) => t.includes(lang)); if (!it) { console.log("no item", items); await d.close(); process.exit(1); }
const t0 = Date.now();
await d.click("[class*=select-menu__item]", it);
const want = lang.split(" - ")[1] || lang;
let t1;
for (let i = 0; i < 400; i++) { const l = await d.fig(`figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)}).getPluginData('l')`); if (l && l !== before.l) { t1 = Date.now(); break; } await d.sleep(50); }
console.log("switch ms (until frame l changed):", t1 ? t1 - t0 : "never");
await d.sleep(Number(process.env.SETTLE || 300));
if (shotName) execSync(`node cdp.mjs shot ${FILE} ../shots/${shotName}.png`);
const after = await snap();
console.log("after", JSON.stringify(after));
await d.close();
