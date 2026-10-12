import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.fig(`(async()=>{
  await figma.loadFontAsync({family:"Inter",style:"Regular"}); await figma.loadFontAsync({family:"Inter",style:"Bold"});
  const page=figma.root.children.find(p=>p.name==="QA b2r2"); figma.currentPage=page;
  page.findAll(n=>n.name==="R2 Imp"||n.name==="R2 Imp DE").forEach(n=>n.remove());
  const mk=(parent,chars,x,y,name)=>{const t=figma.createText(); t.fontName={family:"Inter",style:"Regular"}; t.characters=chars; t.x=x;t.y=y; if(name)t.name=name; parent.appendChild(t); return t;};
  const f=figma.createFrame(); f.name="R2 Imp"; f.x=0; f.y=500; f.resize(300,300); page.appendChild(f);
  mk(f,"Order summary",20,20); mk(f,"Place   order",20,60); const r=mk(f,"Rich bit",20,100); r.setRangeFontName(5,8,{family:"Inter",style:"Bold"}); mk(f,"Thanks!",20,140); mk(f,"Unrelated text here",20,180); mk(f,"Hi {{name}}",20,220); mk(f,"Bag overview",20,260);
  const g=figma.createFrame(); g.name="R2 Imp DE"; g.x=340; g.y=500; g.resize(300,300); g.setPluginData("l","de"); page.appendChild(g);
  mk(g,"Taschenübersicht",20,20); mk(g,"Bag overview",20,60);
  figma.commitUndo(); return f.id+" "+g.id;})()`));
await d.close();
