// node perf-reset.mjs <snap-before.json>: unlink all texts on "QA b2 big" via the Figma API (plugin data of the snapshot state) - used when Cmd+Z is not available
import { ctx } from "./qa-lib.mjs";
import fs from "node:fs";
const snap = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const d = await ctx("4Xgyn");
const n = await d.fig(`(()=>{const snap=${JSON.stringify(Object.fromEntries(Object.entries(snap).map(([k,v])=>[k,v.l])))};let c=0;const p=figma.root.children.find(p=>p.name==='QA b2 big');for(const t of p.findAllWithCriteria({types:['TEXT']})){if(t.getPluginData('mn')===''&&t.getPluginData('l')===snap[t.id])continue;for(const k of t.getPluginDataKeys()){if(k==='mn'||k.startsWith('mn__')||k==='pv'||k==='mum')t.setPluginData(k,'')}t.setPluginData('l',snap[t.id]);c++}figma.commitUndo();return c})()`);
console.log("reset", n);
await d.close();
