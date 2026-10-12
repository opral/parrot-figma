// node b2-sel.mjs "<page>" "<frame>" ... : switch page and select frames by name (FILE env, default ZXC9xq)
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const [page, ...names] = process.argv.slice(2);
console.log(await d.fig(`(()=>{figma.currentPage=figma.root.children.find(p=>p.name===${JSON.stringify(page)}); const n=${JSON.stringify(names)}.map(x=>figma.currentPage.findOne(c=>c.name===x)); figma.currentPage.selection=n.filter(Boolean); return n.map(x=>x&&x.id).join(',')})()`));
await d.sleep(1500);
await d.close();
