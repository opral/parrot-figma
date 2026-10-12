// node b2-fresh.mjs : recreates frame "B2 Fresh" (5 unlinked texts, 2 identical) on page QA b2 and selects it
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.fig(`(async()=>{await figma.loadFontAsync({family:'Inter',style:'Regular'});const page=figma.root.children.find(p=>p.name==='QA b2');figma.currentPage=page;page.findAll(n=>n.name==='B2 Fresh').forEach(n=>n.remove());const f=figma.createFrame();f.name='B2 Fresh';f.x=2040;f.y=0;f.resize(300,360);page.appendChild(f);let y=20;for(const c of ['Order summary','Please review your order before you confirm the payment today','Edit address','Edit address','Place order']){const t=figma.createText();t.fontName={family:'Inter',style:'Regular'};t.characters=c;t.x=20;t.y=y;y+=50;f.appendChild(t)}figma.commitUndo();figma.currentPage.selection=[f];return f.id})()`));
await d.sleep(1500); await d.close();
