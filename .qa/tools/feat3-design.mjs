// FILE=.. node feat3-design.mjs <theme tag> : multi + single selection, both menus, at 340 / 427 / 800 px
import { ctx } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const FILE=process.env.FILE||"ZXC9xq", tag=process.argv[2]||"dark";
const d = await ctx(FILE);
const shot=(n)=>execSync(`node cdp.mjs uishot ../shots/feat3-${n}.png ${FILE}`);
const sel=(names)=>d.fig(`(()=>{const p=figma.currentPage; figma.currentPage.selection=${JSON.stringify(names)}.map(x=>p.findOne(c=>c.name===x)).filter(Boolean); return 1})()`);
for (const [w,h] of [[340,560],[427,520],[800,560]]) {
  await d.fig(`figma.ui.resize(${w},${h})`); await d.sleep(800);
  for (const [label,names] of [["multi",["Login","Sign up"]],["single",["Login"]]]) {
    await sel([]); await d.sleep(500); await sel(names); await d.sleep(2200); await d.key("Escape");
    shot(`${tag}-${w}-${label}`);
    const n = await d.ui(`document.querySelectorAll('.bulk-language-select button').length`);
    for (let i=0;i<n;i++){
      await d.clickEl(`document.querySelectorAll('.bulk-language-select button')[${i}]`); await d.sleep(700);
      shot(`${tag}-${w}-${label}-menu${i}`);
      const m=await d.ui(`(()=>{const items=[...document.querySelectorAll('.select-menu__item')].filter(e=>e.getBoundingClientRect().height>10); const b=[...document.querySelectorAll('.bulk-language-select button')].map(e=>{const r=e.getBoundingClientRect();return [Math.round(r.x),Math.round(r.y),Math.round(r.width),Math.round(r.height),e.scrollWidth>e.clientWidth]}); const tabs=document.querySelector('.tab')?.getBoundingClientRect(); const menu=items[0]?.closest('[class*=select-menu]')?.getBoundingClientRect(); return {b,n:items.length,menu:menu&&[Math.round(menu.x),Math.round(menu.y),Math.round(menu.width),Math.round(menu.height)],tabBottom:tabs&&Math.round(tabs.bottom), vw:innerWidth, vh:innerHeight}})()`);
      console.log(w,label,i,JSON.stringify(m));
      await d.clickAt(12,60); await d.sleep(500);
    }
  }
}
await d.fig(`figma.ui.resize(427,520)`);
await d.close();
