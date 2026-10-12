import { open } from "./drive.mjs";
const d = await open("4Xgyn");
const speed = Number(process.argv[2]??240), n=Number(process.argv[3]??200);
await d.ui("location.reload()").catch(()=>{});
await d.close();
const d2 = await open("4Xgyn");
const tR=Date.now();
for(let i=0;i<200;i++){ try{ const ok=await d2.ui("!!document.querySelector('.tab')"); if(ok)break;}catch{} await d2.sleep(200);}
console.log('tabs after reload', Date.now()-tR);
await d2.click(".tab","Messages");
const t1=Date.now();
for(let i=0;i<200;i++){ const c=await d2.ui("document.querySelectorAll('inlang-bundle').length"); if(c>=1){console.log('first bundle ms',Date.now()-t1);break;} await d2.sleep(50);}
await d2.sleep(1500);
await d2.ui(`(()=>{window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']});window.__frames=[];let last=performance.now();const f=(t)=>{window.__frames.push(Math.round(t-last));last=t;window.__raf=requestAnimationFrame(f)};window.__raf=requestAnimationFrame(f);return 1})()`);
const o = await d2.ui("(()=>{const r=document.querySelector('.message-list').getBoundingClientRect();return [r.x+r.width/2,r.y+200]})()");
const fo = await d2.page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: f.x, y: f.y }; });
await d2.page.mouse.move(fo.x+o[0], fo.y+o[1]);
const t0=Date.now();
for(let i=0;i<n;i++){ await d2.page.mouse.wheel(0,speed); await d2.sleep(33);}
await d2.sleep(800);
console.log('scroll took',Date.now()-t0);
console.log(await d2.ui("JSON.stringify({lt:window.__lt, maxFrame:Math.max(...window.__frames), medianFrame:[...window.__frames].sort((a,b)=>a-b)[Math.floor(window.__frames.length/2)], frames:window.__frames.length, over50:window.__frames.filter(x=>x>50).length, rows:document.querySelectorAll('.message-group').length, mounted:document.querySelectorAll('inlang-bundle').length, scrollTop:(()=>{let e=document.querySelector('.message-list');while(e&&getComputedStyle(e).overflowY!=='auto')e=e.parentElement;return e&&[e.scrollTop,e.scrollHeight]})()})"));
await d2.ui("cancelAnimationFrame(window.__raf)");
await d2.close();
