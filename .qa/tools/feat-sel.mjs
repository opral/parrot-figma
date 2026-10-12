// FILE=.. node feat-sel.mjs "Login" ["Frame2" ...] : select frames (by name on QA feat 1) in Figma
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const names = process.argv.slice(2);
console.log(await d.fig(`(()=>{figma.currentPage=figma.root.children.find(p=>p.name==='QA feat 1'); const n=${JSON.stringify(names)}.map(x=>figma.currentPage.findOne(c=>c.name===x)); figma.currentPage.selection=n.filter(Boolean); return n.map(x=>x&&x.id).join(',')})()`));
await d.sleep(1200);
await d.close();
