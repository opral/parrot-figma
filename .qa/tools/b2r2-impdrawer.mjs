import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const F = process.env.FILE || "ZXC9xq";
const d = await ctx(F);
const shot = (n) => execSync(`node cdp.mjs uishot ../shots/${n}.png ${F}`);
const open = () => d.ui("[...document.querySelectorAll('.top-drawer.open')].length");
const status = () => d.ui("[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).join(' / ')");
await d.click(".tab", "Import"); await d.sleep(700);
const up = async (f) => { await d.upload(`.transfer-language-row:nth-child(1) input[type=file]`, "/tmp/parrot-qa/" + f); for (let i = 0; i < 50; i++) { await d.sleep(200); if (await open()) break; } await d.sleep(400); };
await up("b2r2-k1.json"); console.log("open", await open(), "focus", await d.ui("document.activeElement?.tagName+' '+document.activeElement?.className")); shot("b2r2-21-import-drawer");
await d.key("Escape"); await d.sleep(600); console.log("Escape -> open", await open(), "status", await status());
await up("b2r2-k1.json");
let n = 0; for (; n < 20; n++) { await d.key("Tab"); const a = await d.ui("document.activeElement?.innerText"); if (/Cancel/.test(a || "")) break; }
console.log("Tabs to Cancel", n + 1);
await d.key("Enter"); await d.sleep(800); console.log("Enter on Cancel -> open", await open(), "status", await status());
await up("b2r2-k1.json");
await d.key("Enter"); await d.sleep(2500); console.log("Enter -> open", await open(), "status", await status());
await d.close();
