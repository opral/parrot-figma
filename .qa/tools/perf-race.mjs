// node perf-race.mjs <frameName> <language> [via=layers|import]: bulk link a frame (Generate keys drawer or Import tab drawer), then immediately switch the frame language; checks canvas
import { ctx } from "./qa-lib.mjs";
const [frameName, lang, via = "layers"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "ZXC9xq");
const snap = () => d.fig(`(()=>{const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)});const t=f.findAll(n=>n.type==='TEXT');const m={};for(const n of t){const k=n.characters+'/'+(n.getPluginData('mn')||'-')+'/'+n.getPluginData('l');m[k]=(m[k]||0)+1}return {l:f.getPluginData('l'),texts:m}})()`);
console.log("before", JSON.stringify(await snap()));
let btn;
if (via === "layers") {
  await d.click(".tab", "Layers"); await d.sleep(500);
  await d.clickEl("document.querySelector('.frame-generate-keys')"); await d.sleep(1500);
} else {
  await d.click(".tab", "Import"); await d.sleep(600);
  await d.clickEl("document.querySelector('.transfer-link-layers button')"); await d.sleep(2500);
}
btn = await d.ui("[...document.querySelectorAll('.top-drawer.open button')].map(b=>b.innerText)[0]");
console.log("drawer button", btn);
const t0 = Date.now();
await d.click(".top-drawer.open button", btn);
if (via === "import") { await d.click(".tab", "Layers"); await d.sleep(300); }
// try to open the frame language menu right away
let opened = false;
for (let i = 0; i < 40 && !opened; i++) {
  try { await d.click(".layer-group-header .select-menu__button", undefined, 0); opened = true; } catch { await d.sleep(100); }
}
await d.sleep(450);
console.log("menu click at", Date.now() - t0, "ms after Link; drawer still open:", await d.ui("!!document.querySelector('.top-drawer.open')"), "busy label:", await d.ui("[...document.querySelectorAll('.top-drawer.open button')].map(b=>b.innerText).join('|')"));
const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent.trim())");
const it = items.find((t) => t.includes(lang));
if (!it) { console.log("menu items", items); throw new Error("no menu item"); }
await d.click("[class*=select-menu__item]", it);
console.log("language picked at", Date.now() - t0, "ms");
await d.sleep(12000);
console.log("after", JSON.stringify(await snap()));
console.log("label", await d.ui("document.querySelector('.select-menu__button')?.textContent"));
await d.close();
