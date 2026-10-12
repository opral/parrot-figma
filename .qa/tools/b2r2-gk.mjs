// node b2r2-gk.mjs : Generate keys drawer keyboard tests on frame "B2 Checkout" (page QA b2r2)
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const open = () => d.ui("!!document.querySelector('.link-review-drawer.open')");
const mn = () => d.fig(`figma.root.children.find(p=>p.name==='QA b2r2').findOne(c=>c.name==='B2 Checkout').findAll(x=>x.type==='TEXT').map(t=>t.getPluginData('mn')||'-').join(',')`);
const reopen = async () => { await d.clickEl("document.querySelector('.frame-generate-keys')"); await d.sleep(900); };
console.log("start mn", await mn());
await reopen(); console.log("open", await open());
await d.key("Escape"); await d.sleep(600); console.log("after Escape open=", await open(), "mn", await mn());
await reopen();
// Tab from the select-all checkbox to Cancel: count tabs until active element text is Cancel
let n = 0;
for (; n < 30; n++) { await d.key("Tab"); const a = await d.ui("document.activeElement?.innerText"); if (/Cancel/.test(a || "")) break; }
console.log("tabs to Cancel", n + 1, await d.ui("document.activeElement?.innerText"));
await d.key("Enter"); await d.sleep(700); console.log("after Enter on Cancel open=", await open(), "mn", await mn());
await reopen();
console.log("focus", await d.ui("document.activeElement?.outerHTML.slice(0,100)"));
await d.key("Enter"); await d.sleep(2500); console.log("after Enter on checkbox open=", await open(), "mn", await mn());
await d.close();
