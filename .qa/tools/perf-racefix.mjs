import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.fig(`(async()=>{await figma.loadFontAsync({family:'Inter',style:'Regular'});const p=figma.root.children.find(p=>p.name==='QA b2r2');figma.currentPage=p;let f=p.findOne(c=>c.name==='Perf Race');if(f)f.remove();f=figma.createFrame();f.name='Perf Race';f.x=0;f.y=500;f.resize(2000,2000);f.setPluginData('l','en');p.appendChild(f);const words=['Cancel','Welcome back','Create account'];for(let i=0;i<600;i++){const t=figma.createText();t.fontName={family:'Inter',style:'Regular'};t.characters=words[i%3];t.x=(i%20)*100;t.y=Math.floor(i/20)*40;t.name='r'+i;f.appendChild(t)}figma.currentPage.selection=[f];figma.commitUndo();return f.id})()`));
await d.close();
