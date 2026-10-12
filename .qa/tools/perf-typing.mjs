import { ctx, waitUi } from "./qa-lib.mjs";
let d = await ctx();
await d.ui("location.reload()").catch(()=>{}); await d.close();
d = await ctx(); await waitUi(d);
await d.click(".tab","Messages"); await d.sleep(1500);
const scroller = `(()=>{let e=document.querySelector('.message-list');while(e&&getComputedStyle(e).overflowY!=='auto'&&getComputedStyle(e).overflowY!=='scroll')e=e.parentElement;return e})()`;
// scroll deep in steps until ~450 rows present
for(let i=0;i<60;i++){ const n=await d.ui(`(()=>{const s=${scroller};s.scrollTop+=1500;return document.querySelectorAll('[data-message-id]').length})()`); await d.sleep(120); if(n>=450)break; }
await d.sleep(800);
console.log('rows in DOM', await d.ui(`document.querySelectorAll('[data-message-id]').length`), 'mounted editors', await d.ui(`document.querySelectorAll('inlang-bundle').length`));
const pos = await d.ui(`(()=>{const f=[...document.querySelectorAll('[contenteditable]')].find(e=>{const r=e.getBoundingClientRect();return r.top>150&&r.bottom<500&&r.width>0&&e.closest('inlang-message')?.message?.locale==='en'});if(!f)return null;const r=f.getBoundingClientRect();return [r.x+r.width-20,r.y+r.height/2,f.closest('[data-message-id]').getAttribute('data-message-id')]})()`);
console.log(pos);
await d.clickAt(pos[0],pos[1]);
const original = await d.ui(`document.activeElement.textContent`);
await d.ui(`window.__lt=[];window.__pobs&&window.__pobs.disconnect();window.__pobs=new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))});window.__pobs.observe({entryTypes:['longtask']});window.__ev=[];window.__eo&&window.__eo.disconnect();window.__eo=new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.name==='keydown'||e.name==='keyup'||e.name==='keypress')window.__ev.push(Math.round(e.duration))});window.__eo.observe({type:'event',durationThreshold:16,buffered:false});1`);
const t0=Date.now();
await d.page.keyboard.type("The quick brown fox jumps over the lazy", {delay:60});
const typed=Date.now()-t0; await d.sleep(1000);
console.log('typed in',typed,'ms; expected',39*60);
console.log(await d.ui(`JSON.stringify({longtasks:window.__lt, slowEvents:window.__ev})`));
// restore the message text (the test appends to a real fixture message)
await d.key("Meta+a"); await d.page.keyboard.type(original, { delay: 20 }); await d.sleep(800);
console.log('restored:', await d.ui(`document.activeElement.textContent`) === original);
await d.close();
