// FILE=.. node feat-pageswitch.mjs <language label start e.g. "German"> [scope: page|selection]  - real clicks, samples the progress label
import { ctx } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const d = await ctx(process.env.FILE || "ZXC9xq");
const lang = process.argv[2]; const scope = process.argv[3] || "page";
await d.key("Escape");
await d.clickEl("document.querySelector('.bulk-language-select button')");
await d.sleep(600);
const items = await d.ui(`[...document.querySelectorAll('.select-menu__item, .select-menu__divider-label')].map(e=>e.innerText.trim())`);
console.log("menu:", JSON.stringify(items));
const idx = scope==="selection"?0:1; // nth match of the language
await d.clickEl(`[...document.querySelectorAll('.select-menu__item')].filter(e=>e.innerText.startsWith(${JSON.stringify(lang)}))[${scope==="selection"&&items.includes("Whole page")?0:(items.includes("Whole page")?1:0)}]`);
if(scope==="page"){
  await d.sleep(900);
  console.log("drawer:", await d.ui('document.querySelector(".top-drawer.open")?.innerText'));
  execSync(`node cdp.mjs uishot ../shots/feat-drawer-${lang}.png ${process.env.FILE||"ZXC9xq"}`);
  await d.clickEl("[...document.querySelectorAll('.top-drawer.open button')].find(b=>b.innerText.includes('Switch page'))");
}
const t0=Date.now(); const seen=[];
for(let i=0;i<400;i++){ const t=await d.ui(`document.querySelector('.bulk-language-bar-label')?.innerText`); if(seen[seen.length-1]?.[1]!==t) seen.push([Date.now()-t0,t]); if(i>3 && t && !/Switching/.test(t)) break; await d.sleep(250); }
console.log(JSON.stringify(seen)); console.log("total ms", Date.now()-t0);
await d.close();
