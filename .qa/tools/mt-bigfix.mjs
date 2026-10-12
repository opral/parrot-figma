// FILE=ZXC9xq N=600 node mt-bigfix.mjs : (re)creates frame "MT Big" with N fresh unlinked texts on page "QA mt"
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.fig(`(async()=>{await figma.loadFontAsync({family:'Inter',style:'Regular'}); const page=figma.root.children.find(p=>p.name==='QA mt'); figma.currentPage=page; page.findAll(n=>n.name==='MT Big').forEach(n=>n.remove()); const b=figma.createFrame(); b.name='MT Big'; b.x=0;b.y=700; b.resize(600,${process.env.N||600}*30+40); page.appendChild(b); for(let i=0;i<${process.env.N||600};i++){const t=figma.createText(); t.fontName={family:'Inter',style:'Regular'}; t.characters='Big text number '+i; t.x=20;t.y=20+i*30; b.appendChild(t);} figma.commitUndo(); return b.id})()`));
await d.close();
