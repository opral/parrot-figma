// Builds page "QA b2r2" (batch 2) in FILE (default ZXC9xq): frames for key generation / auto-link / dev mode tests. Ends with commitUndo.
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const r = await d.fig(`(async()=>{
  await figma.loadFontAsync({family:"Inter",style:"Regular"}); await figma.loadFontAsync({family:"Inter",style:"Bold"}); await figma.loadFontAsync({family:"Inter",style:"Italic"});
  let page = figma.root.children.find(p=>p.name==="QA b2r2");
  if(page){ page.children.slice().forEach(n=>n.remove()); } else { page = figma.createPage(); page.name="QA b2r2"; }
  figma.currentPage = page;
  const mk=(parent,chars,x,y,name)=>{const t=figma.createText(); t.fontName={family:"Inter",style:"Regular"}; t.characters=chars; t.x=x;t.y=y; if(name)t.name=name; parent.appendChild(t); return t;};
  const fr=(name,x,y,w=300,h=300)=>{const f=figma.createFrame(); f.name=name; f.x=x;f.y=y;f.resize(w,h); page.appendChild(f); return f;};
  const out={};
  // rich text frame
  const rich=fr("B2 Rich",0,0);
  const t1=mk(rich,"Hello bold world",20,20,"greeting"); t1.setRangeFontName(6,10,{family:"Inter",style:"Bold"});
  const t2=mk(rich,"First item\\nSecond item",20,80,"list"); t2.setRangeListOptions(0,t2.characters.length,{type:"UNORDERED"});
  const t3=mk(rich,"Plain  text\\nwith   spaces",20,160,"spaces");
  out.rich=rich.id;
  // German frame
  const de=fr("B2 German",340,0); de.setPluginData("l","de");
  mk(de,"Anmelden",20,20); mk(de,"Brandneuer Text",20,80); mk(de,"Willkommen zurück",20,140);
  out.de=de.id;
  // lint / unmanaged
  const lint=fr("B2 Lint",680,0); const lt=mk(lint,"Locked text",20,20,"mixed"); lt.setRangeFontSize(0,2,30); mk(lint,"Normal text",20,100); const um=mk(lint,"Do not touch",20,160,"um"); um.setPluginData("mum","1");
  out.lint=lint.id;
  // checkout frame (en, new keys) + frame without texts + frame with a long text
  const co=fr("B2 Checkout",1360,0); co.setPluginData("l","en"); mk(co,"Your cart",20,20); mk(co,"Continue to payment",20,80); mk(co,"Remove item",20,140); mk(co,"Remove item",20,200);
  mk(co,"This is a rather long sentence that should be clipped with an ellipsis in the review drawer table",20,250,"long");
  out.co=co.id;
  const nt=fr("B2 NoText",1700,0); const r=figma.createRectangle(); r.resize(100,100); nt.appendChild(r); out.nt=nt.id;
  // all linked frame is created later through the UI
  // frame with texts equal to existing messages (en): Sign in x2 messages (ambiguous), Cancel, Create account
  const ex=fr("B2 Existing",1020,0); mk(ex,"Sign in",20,20); mk(ex,"  Cancel  ",20,80); mk(ex,"Create   account",20,140); mk(ex,"Forgot password?",20,200);
  out.ex=ex.id;
  // frame in other page area: for autolink in other languages (German frame text equal to de message: Anmelden)
  figma.commitUndo(); return out;})()`);
console.log(JSON.stringify(r));
await d.close();
