// FILE=.. node feat-link.mjs <row index> tab|type:<key>|click-suggestion [shotname]  : links the n-th layer row of the Layers tab using real input, prints the toast
import { ctx } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const d = await ctx(process.env.FILE || "ZXC9xq");
const [row, mode, shotName] = process.argv.slice(2);
await d.clickEl(`document.querySelectorAll('.layer')[${row}].querySelector('.input-select-menu')`);
await d.sleep(500);
if (mode === "tab") { await d.key("Tab"); await d.sleep(300); await d.key("Enter"); }
else if (mode.startsWith("type:")) { await d.type(mode.slice(5)); await d.sleep(300); await d.key("Enter"); }
else if (mode === "click-suggestion") { await d.clickEl(`[...document.querySelectorAll('.input-select-menu__item')].find(e=>e.previousElementSibling?.innerText==='Suggested key'||true)`); }
await d.sleep(1800);
console.log("toast:", await d.ui(`document.querySelector('.link-identical-toast')?.innerText`));
if (shotName) execSync(`node cdp.mjs uishot ../shots/${shotName}.png ${process.env.FILE||"ZXC9xq"}`);
await d.close();
