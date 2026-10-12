// node r4-check.mjs <fileId> [frameName]  -> prints text nodes (chars, bold segments, list options, font sizes, mn)
import { chromium } from "playwright-core";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes(process.argv[2]));
const out = await p.evaluate((fn)=>figma.currentPage.findAll(n=>n.type==='TEXT'&&(!fn||n.parent&&(n.parent.name===fn||n.parent.parent?.name===fn))).map(n=>({id:n.id,name:n.name,chars:n.characters,mn:n.getPluginData('mn'),seg:n.getStyledTextSegments(['fontName','fontSize','listOptions','fills']).map(s=>[s.characters.slice(0,18),s.fontName.style,s.fontSize,s.listOptions.type,JSON.stringify(s.fills[0]?.color&&[+s.fills[0].color.r.toFixed(2),+s.fills[0].color.b.toFixed(2)])])})), process.argv[3]);
console.log(out.map(o=>JSON.stringify(o)).join("\n"));
await b.close();
