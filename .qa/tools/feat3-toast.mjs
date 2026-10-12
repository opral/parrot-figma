// FILE=.. node feat3-toast.mjs <scope: selection|page> <language label start> [shotname] : picks the language in the bulk bar with real clicks, (page: confirms drawer),
// records Figma toasts (editor page DOM MutationObserver) and prints them.
import { ctx } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const FILE=process.env.FILE||"ZXC9xq";
const d = await ctx(FILE);
const scope=process.argv[2], lang=process.argv[3], name=process.argv[4];
await d.fig(`(()=>{window.__toasts=[]; if(window.__toastObs) window.__toastObs.disconnect(); window.__toastObs=new MutationObserver(()=>{const t=[...document.querySelectorAll('[class*=notification], [data-testid*=toast], [role=alert], [class*=toast]')].map(e=>e.innerText).filter(Boolean); for(const x of t){ if(!window.__toasts.includes(x)) window.__toasts.push(x);} }); window.__toastObs.observe(document.body,{subtree:true,childList:true,characterData:true}); return 1})()`);
await d.key("Escape"); await d.sleep(1500);
const multi = (await d.ui(`document.querySelectorAll('.bulk-language-select').length`))===2;
const sel = scope==="selection" ? 0 : (multi?1:0);
await d.clickEl(`document.querySelectorAll('.bulk-language-select button')[${sel}]`);
await d.sleep(600);
if(name) execSync(`node cdp.mjs uishot ../shots/feat3-${name}-menu.png ${FILE}`);
console.log("menu:", JSON.stringify(await d.ui(`[...document.querySelectorAll('.select-menu__item, .select-menu__divider-label')].filter(e=>e.getBoundingClientRect().height>10).map(e=>e.innerText.trim())`)));
await d.clickEl(`[...document.querySelectorAll('.select-menu__item')].filter(e=>e.getBoundingClientRect().height>10 && e.innerText.startsWith(${JSON.stringify(lang)}))[0]`);
if(scope==="page"){
  await d.sleep(900);
  console.log("drawer:", await d.ui('document.querySelector(".top-drawer.open")?.innerText'));
  if(name) execSync(`node cdp.mjs uishot ../shots/feat3-${name}-drawer.png ${FILE}`);
  await d.clickEl("[...document.querySelectorAll('.top-drawer.open button')].find(b=>b.innerText.includes('Switch page'))");
}
for(let i=0;i<200;i++){ if((await d.fig(`window.__toasts.some(t=>/Switched|already|no frames/.test(t))`))) break; await d.sleep(100); }
await d.sleep(300);
if(name) await d.page.screenshot({path:`../shots/feat3-${name}-toast.png`});
console.log("toasts:", JSON.stringify(await d.fig(`window.__toasts`)));
await d.close();
