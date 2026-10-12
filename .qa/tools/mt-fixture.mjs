// Builds page "QA mt" (FILE=ZXC9xq): MT Unlinked (6 fresh texts), MT Single (1), MT Linked (4, to be linked), MT Mixed, MT Big (N texts, env N)
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const N = Number(process.env.N || 0);
const r = await d.fig(`(async()=>{
  await figma.loadFontAsync({family:"Inter",style:"Regular"});
  let page = figma.root.children.find(p=>p.name==="QA mt");
  if(page){ page.children.slice().forEach(n=>n.remove()); } else { page = figma.createPage(); page.name="QA mt"; }
  figma.currentPage = page;
  const mk=(parent,chars,x,y,name)=>{const t=figma.createText(); t.fontName={family:"Inter",style:"Regular"}; t.characters=chars; t.x=x;t.y=y; if(name)t.name=name; parent.appendChild(t); return t;};
  const fr=(name,x,y,w=300,h=400)=>{const f=figma.createFrame(); f.name=name; f.x=x;f.y=y;f.resize(w,h); page.appendChild(f); return f;};
  const out={};
  const u=fr("MT Unlinked",0,0); ["Good morning","Open settings","Save changes","Delete account","Help center","Contact us"].forEach((c,i)=>mk(u,c,20,20+i*50)); out.unlinked=u.id;
  const s=fr("MT Single",340,0); mk(s,"Only one text",20,20); out.single=s.id;
  const l=fr("MT Linked",680,0); ["Sign in","Cancel","Brand new text one","Brand new text two"].forEach((c,i)=>mk(l,c,20,20+i*50)); out.linked=l.id;
  const m=fr("MT Mixed",1020,0); ["Sign in","Mixed unlinked A","Mixed unlinked B"].forEach((c,i)=>mk(m,c,20,20+i*50)); out.mixed=m.id;
  const m2=fr("MT Mixed 2",1360,0); ["Another unlinked one","Cancel"].forEach((c,i)=>mk(m2,c,20,20+i*50)); out.mixed2=m2.id;
  if(${N}>0){ const b=fr("MT Big",1700,0,600,${N}*30+40); for(let i=0;i<${N};i++) mk(b,"Big text number "+i,20,20+i*30); out.big=b.id; }
  figma.commitUndo(); return out;})()`);
console.log(JSON.stringify(r));
await d.close();
