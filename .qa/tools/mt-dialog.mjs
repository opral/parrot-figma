// FILE=ZXC9xq node mt-dialog.mjs <prefix> [w h]: opens the machine translation dialog from the Messages tab at the given plugin size, screenshots dialog, then a frame-switch notice
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE || "ZXC9xq"; const [prefix, w, h] = process.argv.slice(2);
const d = await ctx(FILE);
if (w) { await d.fig(`figma.ui.resize(${w},${h})`); await d.sleep(800); }
await d.click(".tab", "Messages"); await d.sleep(500); await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key("Meta+a"); await d.type("name:mt.sign"); await d.sleep(1500);
const btn = `(function deep(r){for(const b of r.querySelectorAll('button')){if(/Translate/.test(b.innerText||b.textContent)&&b.getBoundingClientRect().height>10)return b} for(const e of r.querySelectorAll('*')){if(e.shadowRoot){const x=deep(e.shadowRoot);if(x)return x}} return null})(document)`;
await d.clickEl(btn); await d.sleep(800);
execSync(`node cdp.mjs uishot ../shots/${prefix}-dialog.png ${FILE}`);
await d.key("Escape"); await d.sleep(500);
// frame switch notice
await d.fig(`(()=>{figma.currentPage=figma.root.children.find(p=>p.name==='QA mt'); figma.currentPage.selection=[figma.currentPage.findOne(n=>n.name==='MT Single')]})()`);
await d.sleep(1200); await d.click(".tab", "Layers"); await d.sleep(600);
await d.click(".select-menu__button", undefined, 1); await d.sleep(600);
const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())");
const target = items.find((t) => t.startsWith(process.env.LANG2 || "Japanese")) ;
await d.click("[class*=select-menu__item]", target); await d.sleep(600);
execSync(`node cdp.mjs shot ${FILE} ../shots/${prefix}-notice.png`);
if (w) { await d.fig(`figma.ui.resize(821,435)`); }
await d.close();
