// node perf-switch.mjs <frameName> <language>: frame language switch via the frame menu (synthetic mouseup), polls the frame 'l' (written last) and prints the duration
import { ctx } from "./qa-lib.mjs";
const [frameName, lang] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "ZXC9xq");
await d.ui(`(async()=>{const sleep=ms=>new Promise(r=>setTimeout(r,ms));document.querySelector('.layer-group-header .select-menu__button').click();await sleep(450);[...document.querySelectorAll('.select-menu__item')].filter(e=>e.getBoundingClientRect().width>0).find(e=>e.innerText.trim().startsWith(${JSON.stringify(lang)})).dispatchEvent(new MouseEvent('mouseup',{bubbles:true}));return 1})()`);
const t0 = Date.now();
for (let i = 0; i < 600; i++) { await d.sleep(250); const l = await d.fig(`figma.currentPage.findOne(n=>n.name===${JSON.stringify(frameName)}).getPluginData('l')`); if (/^(en|de)$/.test(l) && l === (lang.startsWith("German") ? "de" : "en")) break; }
console.log("switch took ~", Date.now() - t0, "ms (+450 menu guard)");
await d.close();
