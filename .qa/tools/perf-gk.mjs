// node perf-gk.mjs <index of frame header button> : opens Generate keys, shows rows, clicks Link, prints timing + notices
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const d = await ctx(process.env.FILE || "ZXC9xq");
const idx = Number(process.argv[2] || 0);
await d.clickEl(`document.querySelectorAll('.frame-generate-keys')[${idx}]`); await d.sleep(1200);
console.log(await d.ui(`[...document.querySelectorAll('.link-review-drawer .link-review-row')].map(r=>r.innerText.replace(/\\n/g,' | ')+' | key='+(r.querySelector('input.link-review-input')?.value??'')+' chk='+r.querySelector('input[type=checkbox]').checked)`));
execSync(`node cdp.mjs uishot ../shots/${process.argv[3]||'perf-gk'}.png ${process.env.FILE||"ZXC9xq"}`);
const label = await d.ui("[...document.querySelectorAll('.top-drawer.open button')].map(b=>b.innerText)[0]");
const w0 = Date.now();
await d.click(".top-drawer.open button", label);
for (let i = 0; i < 300; i++) { await d.sleep(100); if (!(await d.ui("!!document.querySelector('.link-review-drawer.open')"))) break; }
console.log(label, "-> closed after", Date.now() - w0, "ms");
await d.sleep(800);
await d.close();
