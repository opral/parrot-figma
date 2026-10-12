// usage: FILE=<file> node icu-switch.mjs "<language menu item, e.g. Russian - ru>" [shot]  -> switches the "ICU frame" via its row menu, prints the canvas texts
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE ?? "7cQCVw";
const [lang, shot] = process.argv.slice(2);
const d = await ctx(FILE);
await d.click(".tab", "Layers"); await d.sleep(800);
await d.clickEl(`[...document.querySelectorAll('button,[class*=select-menu__button]')].filter(b=>b.getBoundingClientRect().height>5).find(b=>/ - [a-z]{2}/.test(b.textContent) && !b.textContent.includes('Switch page'))`);
await d.sleep(600);
await d.clickEl(`[...document.querySelectorAll('[class*=menu] *')].filter(e=>e.getBoundingClientRect().height>5 && e.children.length===0 && e.textContent.trim()===${JSON.stringify(lang)}).pop()`);
for (let i = 0; i < 40; i++) { await d.sleep(250); if ((await d.ui("document.body.innerText")).includes("Switched")) break; }
await d.sleep(1500);
console.log(await d.fig("figma.currentPage.findAll(n=>n.type==='TEXT').map(n=>n.name+' => '+n.characters).join('\\n')"));
if (shot) execSync(`cd ${import.meta.dirname} && node cdp.mjs uishot ../shots/${shot}.png ${FILE}`);
await d.close();
