// FILE=.. node feat2-snap1.mjs <frameName> : plugin data (mn/mum/l) + text per text node of one frame on QA feat 1
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.fig(`(()=>{const f=figma.currentPage.findOne(c=>c.name===${JSON.stringify(process.argv[2])}); return f.findAll(n=>n.type==='TEXT').map(t=>t.characters+' mn='+(t.getPluginData('mn')?'y':'-')+' mum='+(t.getPluginData('mum')?'y':'-')+' l='+t.getPluginData('l')).join('\\n')})()`));
await d.close();
