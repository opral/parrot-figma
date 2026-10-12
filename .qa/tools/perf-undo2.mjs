import { ctx } from "./qa-lib.mjs";
const d = await ctx("ZXC9xq");
const cnt = () => d.fig(`figma.root.children.find(p=>p.name==='QA b2r2').findAllWithCriteria({types:['TEXT']}).filter(n=>n.getPluginData('mn')!=='').length`);
console.log("linked before", await cnt());
await d.page.mouse.click(756, 189); await d.sleep(500);
for (let i = 1; i <= 3; i++) { await d.key("Meta+z"); await d.sleep(2500); console.log("after undo", i, await cnt()); if (i>1) break; }
await d.sleep(1000);
console.log("Import tab/ layers:");
await d.click(".tab", "Import"); await d.sleep(600);
console.log(await d.ui("document.querySelector('.transfer-language-detail')?.innerText"));
await d.click(".tab", "Layers"); await d.sleep(800);
console.log(await d.ui("[...document.querySelectorAll('.layer')].map(l=>l.innerText.replace(/\\n/g,' | ').slice(0,60))"));
await d.close();
