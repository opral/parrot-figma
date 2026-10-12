// node perf-unlink-frame.mjs <frameName> [lang]: unlink all texts in the frame via the Figma API and set the frame language
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const [name, lang = "en"] = process.argv.slice(2);
console.log(await d.fig(`(()=>{const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(name)});let c=0;for(const t of f.findAll(n=>n.type==='TEXT')){for(const k of t.getPluginDataKeys()){if(k==='mn'||k.startsWith('mn__')||k==='pv'||k==='mum'||k==='l')t.setPluginData(k,'')}c++}f.setPluginData('l',${JSON.stringify(lang)});figma.commitUndo();figma.currentPage.selection=[f];return c})()`));
await d.close();
