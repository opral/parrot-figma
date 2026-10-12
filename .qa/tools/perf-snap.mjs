// node perf-snap.mjs <out.json> [pageName]  (FILE env default 4Xgyn): snapshot of every text on the page: characters, style segments, fills, mn, l
import { ctx } from "./qa-lib.mjs";
import fs from "node:fs";
const d = await ctx(process.env.FILE || "4Xgyn");
const page = process.argv[3] || "QA b2 big";
const r = await d.fig(`(()=>{const p=figma.root.children.find(p=>p.name===${JSON.stringify(page)});const out={};for(const n of p.findAllWithCriteria({types:['TEXT']})){const seg=n.getStyledTextSegments(['fontName','fontSize','fills','textStyleId','listOptions']).map(s=>[s.characters.length,s.fontName.family+'/'+s.fontName.style,s.fontSize,JSON.stringify(s.fills),s.textStyleId,s.listOptions.type].join('|'));out[n.id]={c:n.characters,mn:n.getPluginData('mn'),l:n.getPluginData('l'),seg}};return out})()`);
fs.writeFileSync(process.argv[2], JSON.stringify(r));
const v = Object.values(r);
console.log("texts", v.length, "linked", v.filter(x=>x.mn).length);
await d.close();
