// node ce-colors.mjs <search> : list computed colors / fonts of visible .figma-inlang-editor (shadow DOM pierced)
const q = process.argv[2];
process.argv[2] = `
await d.click('.tab','Messages'); await d.sleep(300);
await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key('Meta+a'); await d.type(${JSON.stringify(q)}); await d.sleep(900);
const out = await d.ui(\`(()=>{
const seen=new Map();
const walk=(root)=>{for(const e of root.querySelectorAll('*')){ if(e.shadowRoot) walk(e.shadowRoot); const r=e.getBoundingClientRect(); if(!r.width||!r.height) continue; const c=getComputedStyle(e); for(const [k,v] of [['color',c.color],['bg',c.backgroundColor],['bc',c.borderTopWidth!=='0px'?c.borderTopColor:null],['outline',c.outlineStyle!=='none'?c.outlineColor:null],['shadow',c.boxShadow!=='none'?c.boxShadow:null]]){ if(!v||v==='rgba(0, 0, 0, 0)') continue; const key=k+' '+v; if(!seen.has(key)) seen.set(key,e.tagName.toLowerCase()+'.'+(e.className?.baseVal??e.className)+(e.getAttribute('part')?'['+e.getAttribute('part')+']':'')); } if(!/Inter/.test(c.fontFamily) && [...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) seen.set('FONT '+c.fontFamily.slice(0,30)+' '+c.fontSize, e.tagName+'.'+e.className); if([...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim())) seen.set('SIZE '+c.fontSize+' '+c.fontWeight, e.tagName.toLowerCase()+'.'+(e.className?.baseVal??e.className)); }};
for (const g of document.querySelectorAll('.figma-inlang-editor')) if (g.getBoundingClientRect().height>10) walk(g);
return [...seen].map(([k,v])=>k+'  <- '+v).join('\\\\n');})()\`);
console.log(out);
`;
await import("./ce.mjs");
