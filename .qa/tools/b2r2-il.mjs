import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const open = () => d.ui("!!document.querySelector('.link-review-drawer.open')");
const mn = () => d.fig(`figma.root.children.find(p=>p.name==='QA b2r2').findOne(c=>c.name==='R2 Imp').findAll(x=>x.type==='TEXT').map(t=>t.characters.slice(0,8)+'='+(t.getPluginData('mn')||'-')).join(', ')`);
const rows = () => d.ui(`[...document.querySelectorAll('.link-review-drawer .link-review-row')].map(r=>r.innerText.replace(/\\n/g,' | ')+' chk='+r.querySelector('input[type=checkbox]').checked)`);
console.log("start", await mn());
await d.clickEl("document.querySelector('.tab.active, .tab')&&[...document.querySelectorAll('.tab')].find(t=>t.innerText==='Import')"); await d.sleep(600);
const manual = () => d.clickEl("document.querySelector('.transfer-link-layers button')");
await manual(); await d.sleep(2500); console.log("manual open", await open(), await rows());
// select focus + Enter
const hasSel = await d.ui("!!document.querySelector('.link-review-drawer select')");
console.log("has select", hasSel);
if (hasSel) {
  await d.ui("document.querySelector('.link-review-drawer select').focus()");
  await d.key("Enter"); await d.sleep(600);
  console.log("Enter on select: open", await open(), await mn(), "active", await d.ui("document.activeElement?.tagName"));
  await d.key("Escape"); await d.sleep(500);
  console.log("after Escape (native popup or drawer) open", await open());
  if (await open()) { await d.key("Escape"); await d.sleep(500); console.log("2nd Escape open", await open()); }
} else { await d.key("Escape"); await d.sleep(600); console.log("Escape open", await open(), await mn()); }
await manual(); await d.sleep(2500);
let n = 0;
for (; n < 40; n++) { await d.key("Tab"); const a = await d.ui("document.activeElement?.innerText"); if (/Cancel/.test(a || "")) break; }
console.log("tabs to Cancel", n + 1);
await d.key("Enter"); await d.sleep(600); console.log("Enter on Cancel: open", await open(), await mn());
await manual(); await d.sleep(2500);
console.log("focus", await d.ui("document.activeElement?.outerHTML.slice(0,90)"));
await d.key("Enter"); await d.sleep(3000); console.log("Enter on checkbox: open", await open(), await mn());
await d.close();
