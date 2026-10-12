// node r4-fid.mjs <file> <frameId> <lang1> <lang2> ... : switches frame through languages (real menu clicks), dumps style signatures
import { open } from "./drive.mjs"; 
const d = await open(process.env.FILE||"4Xgyn"); const fid=process.argv[2];
const sig=()=>d.page.evaluate((fid)=>figma.getNodeById(fid).findAll(n=>n.type==='TEXT').map(n=>({name:n.name,chars:n.characters.replace(/\n/g,'⏎').slice(0,60),segs:n.getStyledTextSegments(['fontName','fontSize','fills','listOptions','indentation','textDecoration','hyperlink','textCase','lineHeight','letterSpacing','textStyleId']).map(s=>JSON.stringify([s.fontName.style,s.fontSize,s.fills.map(f=>f.color?[f.color.r,f.color.g,f.color.b].map(x=>+x.toFixed(2)).join('/'):f.type).join(),s.listOptions.type,s.indentation,s.textDecoration,s.hyperlink&&s.hyperlink.value,s.textCase,s.lineHeight.value??s.lineHeight.unit,s.letterSpacing.value,s.textStyleId]))})),fid);
const shape=(a)=>a.map(t=>t.name+':'+[...new Set(t.segs)].join(';'));
await d.page.evaluate(async(fid)=>{const n=figma.getNodeById(fid);let p=n;while(p.type!=='PAGE')p=p.parent;await figma.setCurrentPageAsync(p);figma.currentPage.selection=[n];figma.viewport.scrollAndZoomIntoView([n]);},fid);
await d.sleep(1500); await d.click('.tab','Layers'); await d.sleep(800);
const base=await sig(); console.log('base', JSON.stringify(base.map(t=>[t.name,t.chars,t.segs.length])));
for(const lang of process.argv.slice(3)){
  await d.click(".select-menu__button", undefined, 0); await d.sleep(500);
  const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())"); const it=items.find(t=>t.includes(lang)); if(!it){console.log('no',lang,items);continue;}
  await d.click("[class*=select-menu__item]", it); await d.sleep(Number(process.env.WAIT||5500));
  const a=await sig();
  const diffs=[]; a.forEach((t,i)=>{ const b=base[i]; const s1=[...new Set(b.segs)].sort().join(), s2=[...new Set(t.segs)].sort().join(); if(s1!==s2) diffs.push([t.name,'STYLE DIFF',s1.slice(0,200),s2.slice(0,200)]); if(t.segs.length!==b.segs.length) diffs.push([t.name,'segs',b.segs.length,t.segs.length]);});
  console.log(lang, 'texts', a.length, 'diffs', JSON.stringify(diffs), 'sample', a.slice(0,3).map(t=>t.chars).join(' | '));
  if(/\{\{|dot|newline|punto/.test(a.map(t=>t.chars).join(' '))) console.log('PLACEHOLDER LEAK?');
}
await d.close();
