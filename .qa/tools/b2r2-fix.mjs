import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const F = process.env.FILE || "ZXC9xq";
const d = await ctx(F);
const shot = (n) => execSync(`node cdp.mjs uishot ../shots/${n}.png ${F}`);
const open = () => d.ui("[...document.querySelectorAll('.top-drawer.open')].length");
const size = () => d.fig("figma.root.children.find(p=>p.name==='QA b2r2').findOne(c=>c.name==='B2 Lint').findOne(t=>t.name==='mixed').getStyledTextSegments(['fontSize']).map(s=>s.fontSize).join(',')");
const fix = () => d.clickEl("document.querySelector('.lint-fix-button')");
console.log("start", await size());
await fix(); await d.sleep(800); console.log("open", await open(), await d.ui("document.querySelector('.top-drawer.open .drawer-header')?.innerText")); shot("b2r2-24-fix-drawer");
await d.key("Escape"); await d.sleep(600); console.log("Escape -> open", await open(), await size());
await fix(); await d.sleep(800);
let n = 0; for (; n < 20; n++) { await d.key("Tab"); const a = await d.ui("document.activeElement?.innerText"); if (/Cancel/.test(a || "")) break; }
console.log("Tab count", n + 1);
await d.key("Enter"); await d.sleep(800); console.log("Enter on Cancel -> open", await open(), await size());
await fix(); await d.sleep(800); console.log("focus", await d.ui("document.activeElement?.className"));
await d.key("Enter"); await d.sleep(2500); console.log("Enter -> open", await open(), await size());
await d.close();
