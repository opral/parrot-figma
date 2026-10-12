import { ctx } from "./qa-lib.mjs";
const d = await ctx("4Xgyn");
const cnt = () => d.fig(`figma.root.children.find(p=>p.name==='QA b2 big').findAllWithCriteria({types:['TEXT']}).filter(n=>n.getPluginData('mn')!=='').length`);
console.log("linked before", await cnt());
await d.page.mouse.click(1100, 700); await d.sleep(500);
for (let i = 1; i <= 3; i++) { await d.key("Meta+z"); await d.sleep(4000); console.log("after undo", i, await cnt()); if (await cnt() === 0) break; }
await d.close();
