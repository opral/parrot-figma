// node perf-race2.mjs <frameName> <language> <gapMs>: Generate keys drawer opened with a real click, then Link + frame language pick by synthetic clicks inside ONE evaluate (so the pick lands while the bulk link runs)
import { ctx } from "./qa-lib.mjs";
const [frameName, lang, gap = "150"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "ZXC9xq");
const snap = () => d.fig(`(()=>{const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)});const t=f.findAll(n=>n.type==='TEXT');const m={};for(const n of t){const k=n.characters+'/'+(n.getPluginData('mn')||'-')+'/'+n.getPluginData('l');m[k]=(m[k]||0)+1}return {l:f.getPluginData('l'),texts:m}})()`);
console.log("before", JSON.stringify(await snap()));
await d.click(".tab", "Layers"); await d.sleep(800);
await d.clickEl("document.querySelector('.frame-generate-keys')"); await d.sleep(1500);
const r = await d.ui(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));const t0=performance.now();
 const link=[...document.querySelectorAll('.top-drawer.open button')].find(b=>/^Link \\d+ layer/.test(b.innerText));link.click();
 await sleep(${Number(gap)});
 const menu=document.querySelector('.layer-group-header .select-menu__button');menu.click();await sleep(450);
 const it=[...document.querySelectorAll('.select-menu__item')].filter(e=>e.getBoundingClientRect().width>0).find(e=>e.innerText.trim().startsWith(${JSON.stringify(lang)}));if(!it)return {error:'no item',items:[...document.querySelectorAll('.select-menu__item')].map(e=>e.innerText.trim()).slice(0,8)};
 const stillOpen=!!document.querySelector('.link-review-drawer.open');
 it.dispatchEvent(new MouseEvent("mouseup",{bubbles:true}));return {pickedAt:Math.round(performance.now()-t0),drawerStillOpenAtPick:stillOpen}})()`);
console.log(JSON.stringify(r));
await d.sleep(25000);
console.log("after", JSON.stringify(await snap()));
await d.close();
