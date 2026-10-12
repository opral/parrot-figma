// node b2-snap.mjs <frameName..> : text / mn / l of the texts of the named frames (QA feat 1 page) + the messages (ids) matching optional MSG env regexp
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const names = process.argv.slice(2);
console.log(await d.fig(`(()=>{const out=[];for(const n of ${JSON.stringify(names)}){const f=(figma.root.children.find(p=>p.name===(${JSON.stringify(process.env.PAGE||"QA b2")}))).findOne(c=>c.name===n);if(!f){out.push(n+': NOT FOUND');continue;}out.push(n+' l='+f.getPluginData('l'));for(const t of f.findAll(x=>x.type==='TEXT'))out.push('  '+JSON.stringify(t.characters)+' mn='+(t.getPluginData('mn')||'-')+' l='+(t.getPluginData('l')||'-')+' fonts='+JSON.stringify(t.getStyledTextSegments(['fontName','fontWeight']).map(s=>s.fontName.style)));}return out.join('\\n')})()`));
await d.close();
