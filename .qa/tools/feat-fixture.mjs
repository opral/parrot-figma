// Builds the "QA feat 1" page (feature round 1) in the file given by FILE (default ZXC9xq): 4 screens sharing texts,
// a Section with 2 frames, a 4000px wide container with a frame inside, a lint text, a German frame, a component+instance.
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const r = await d.fig(`(async()=>{
  await figma.loadFontAsync({family:"Inter",style:"Regular"}); await figma.loadFontAsync({family:"Inter",style:"Bold"});
  let page = figma.root.children.find(p=>p.name==="QA feat 1");
  if(page){ page.children.slice().forEach(n=>n.remove()); } else { page = figma.createPage(); page.name="QA feat 1"; }
  figma.currentPage = page;
  const mk=(parent,chars,x,y,name)=>{const t=figma.createText(); t.fontName={family:"Inter",style:"Regular"}; t.characters=chars; t.x=x;t.y=y; if(name)t.name=name; parent.appendChild(t); return t;};
  const fr=(name,x,y,w=300,h=300)=>{const f=figma.createFrame(); f.name=name; f.x=x;f.y=y;f.resize(w,h); page.appendChild(f); return f;};
  const out={};
  const login=fr("Login",0,0); mk(login,"Welcome back",20,20); mk(login,"Sign in",20,80); mk(login,"Cancel",20,140); mk(login,"Forgot password?",20,200); out.login=login.id;
  const signup=fr("Sign up",340,0); mk(signup,"Create account",20,20); mk(signup,"Sign in",20,80); mk(signup,"Cancel",20,140); mk(signup,"Sign in",20,200); out.signup=signup.id;
  const settings=fr("Frame 12",680,0); mk(settings,"Settings",20,20); mk(settings,"Cancel",20,80); mk(settings,"Sign in",20,140,"Sign in"); out.settings=settings.id;
  const de=fr("Login DE",1020,0); mk(de,"Sign in",20,20); mk(de,"Cancel",20,80); de.setPluginData("l","de"); out.de=de.id;
  const sec=figma.createSection(); sec.name="Onboarding flow"; sec.x=0; sec.y=400; sec.resizeWithoutConstraints(800,400); page.appendChild(sec);
  const a=figma.createFrame(); a.name="Step 1"; a.resize(300,300); a.x=20;a.y=40; sec.appendChild(a); mk(a,"Get started",20,20); mk(a,"Sign in",20,80); out.step1=a.id;
  const b=figma.createFrame(); b.name="Step 2"; b.resize(300,300); b.x=360;b.y=40; sec.appendChild(b); mk(b,"Cancel",20,20); mk(b,"Sign in",20,80); out.step2=b.id;
  const wide=fr("Wide canvas",0,900,4000,500); const inner=figma.createFrame(); inner.name="Inside wide"; inner.resize(300,300); inner.x=40;inner.y=40; wide.appendChild(inner); mk(inner,"Sign in",20,20); mk(inner,"Wide only text",20,80); out.inner=inner.id;
  const lint=fr("Lint frame",900,400); const lt=mk(lint,"Sign in",20,20,"mixed"); lt.setRangeFontSize(0,2,30); out.lint=lint.id; out.lintText=lt.id;
  const comp=figma.createComponent(); comp.name="Button/Primary"; comp.x=1240; comp.y=400; comp.resize(200,60); page.appendChild(comp); mk(comp,"Sign in",20,20); out.comp=comp.id;
  const host=fr("Uses Button",1240,520,300,200); const inst=comp.createInstance(); inst.x=20; inst.y=20; host.appendChild(inst); out.host=host.id; out.inst=inst.id;
  const empty=fr("Empty frame",1600,0,100,100); out.empty=empty.id;
  figma.commitUndo(); return out;})()`);
console.log(JSON.stringify(r));
await d.close();
