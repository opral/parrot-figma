import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const d = await ctx("ZXC9xq");
await d.clickEl("document.querySelector('.frame-generate-keys')"); await d.sleep(1500);
console.log(await d.ui(`[...document.querySelectorAll('.link-review-drawer .link-review-row')].map(r=>r.innerText.replace(/\\n/g,' | ')+' | '+(r.querySelector('input.link-review-input')?.value??''))`));
// the layer disappears (deleted by someone else) while the drawer is open
await d.fig(`figma.currentPage.findOne(c=>c.name==='Perf Err').findOne(n=>n.name==='e2').remove()`);
const label = await d.ui("[...document.querySelectorAll('.top-drawer.open button')].map(b=>b.innerText)[0]");
await d.click(".top-drawer.open button", label);
await d.sleep(2500);
console.log("drawer open:", await d.ui("!!document.querySelector('.link-review-drawer.open')"));
console.log("alerts:", await d.ui("[...document.querySelectorAll('[role=alert]')].map(e=>e.innerText)"));
execSync(`node cdp.mjs uishot ../shots/perf-err.png ZXC9xq`);
await d.page.screenshot({ path: "../shots/perf-err-full.png" });
console.log(await d.fig(`figma.currentPage.findOne(c=>c.name==='Perf Err').findAll(n=>n.type==='TEXT').map(t=>t.name+'='+(t.getPluginData('mn')||'-'))`));
await d.close();
