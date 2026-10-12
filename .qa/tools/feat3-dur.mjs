import { ctx } from "./qa-lib.mjs";
const d = await ctx("ZXC9xq");
await d.fig(`(()=>{window.__tt=[]; const iv=setInterval(()=>{const has=[...document.querySelectorAll('[class*=notification],[role=alert],[class*=toast]')].some(e=>/Switched/.test(e.innerText||'')); window.__tt.push([Date.now(),has])},100); window.__iv=iv;})()`);
await d.clickEl("document.querySelectorAll('.bulk-language-select button')[0]"); await d.sleep(600);
await d.clickEl(`[...document.querySelectorAll('.select-menu__item')].filter(e=>e.innerText.startsWith('German'))[0]`);
await d.sleep(9000);
const r=await d.fig(`(clearInterval(window.__iv), window.__tt.filter(x=>x[1]).map(x=>x[0]))`);
console.log("visible ms:", r.length? r[r.length-1]-r[0]+100 : "never");
await d.close();
