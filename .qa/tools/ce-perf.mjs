// composable-editor perf on the 5k file: open timing, scroll frame times, typing latency with ~450 rows in the DOM
import { open } from "./drive.mjs";
const FILE = process.env.FILE || "4Xgyn";
let d = await open(FILE);
await d.ui("location.reload()").catch(() => {}); await d.close();
d = await open(FILE);
let t = Date.now();
for (let i = 0; i < 300; i++) { try { if (await d.ui("!!document.querySelector('.tab')")) break; } catch {} await d.sleep(200); }
console.log("tabs after reload ms", Date.now() - t);
await d.click(".tab", "Messages"); t = Date.now();
for (let i = 0; i < 400; i++) { if (await d.ui("document.querySelectorAll('inlang-pattern-editor').length") >= 1) { console.log("first editor ms", Date.now() - t); break; } await d.sleep(50); }
await d.sleep(1500);
console.log("rows", await d.ui("document.querySelectorAll('.message-group').length"), "editors", await d.ui("document.querySelectorAll('inlang-pattern-editor').length"));
await d.ui(`(()=>{window.__lt=[];new PerformanceObserver(l=>{for(const e of l.getEntries())window.__lt.push(Math.round(e.duration))}).observe({entryTypes:['longtask']});window.__frames=[];let last=performance.now();const f=(t)=>{window.__frames.push(Math.round(t-last));last=t;window.__raf=requestAnimationFrame(f)};window.__raf=requestAnimationFrame(f);return 1})()`);
const o = await d.ui("(()=>{const r=document.querySelector('.message-list').getBoundingClientRect();return [r.x+r.width/2,r.y+200]})()");
const fo = await d.page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: f.x, y: f.y }; });
await d.page.mouse.move(fo.x + o[0], fo.y + o[1]);
const speed = Number(process.argv[2] ?? 240), n = Number(process.argv[3] ?? 200);
const t0 = Date.now();
for (let i = 0; i < n; i++) { await d.page.mouse.wheel(0, speed); await d.sleep(33); }
await d.sleep(800);
console.log("scroll took", Date.now() - t0, await d.ui("JSON.stringify({longtasks:window.__lt, maxFrame:Math.max(...window.__frames), medianFrame:[...window.__frames].sort((a,b)=>a-b)[Math.floor(window.__frames.length/2)], frames:window.__frames.length, over50:window.__frames.filter(x=>x>50).length, rows:document.querySelectorAll('.message-group').length, editors:document.querySelectorAll('inlang-pattern-editor').length})"));
await d.ui("cancelAnimationFrame(window.__raf)");
// typing with many rows in the DOM
const scroller = `(()=>{let e=document.querySelector('.message-list');while(e&&getComputedStyle(e).overflowY!=='auto'&&getComputedStyle(e).overflowY!=='scroll')e=e.parentElement;return e})()`;
for (let i = 0; i < 80; i++) { const c = await d.ui(`(()=>{const s=${scroller};s.scrollTop+=1500;return document.querySelectorAll('.message-group').length})()`); await d.sleep(120); if (c >= 450) break; }
await d.sleep(800);
console.log("rows in DOM", await d.ui("document.querySelectorAll('.message-group').length"), "editors", await d.ui("document.querySelectorAll('inlang-pattern-editor').length"));
const pos = await d.ui(`(()=>{const f=[...document.querySelectorAll('.inlang-row-locale')].filter(l=>l.textContent.startsWith('en')).map(l=>l.parentElement.querySelector('[contenteditable]')).find(e=>{if(!e)return false;const r=e.getBoundingClientRect();return r.top>200&&r.bottom<500&&r.width>0});if(!f)return null;const r=f.getBoundingClientRect();return [r.x+r.width-20,r.y+r.height/2]})()`);
await d.page.mouse.click(fo.x + pos[0], fo.y + pos[1]);
const original = await d.ui("document.activeElement.textContent");
await d.ui(`window.__lt=[];window.__ev=[];new PerformanceObserver(l=>{for(const e of l.getEntries())if(e.name==='keydown'||e.name==='keypress'||e.name==='keyup')window.__ev.push(Math.round(e.duration))}).observe({type:'event',durationThreshold:16,buffered:false});1`);
const t1 = Date.now();
await d.page.keyboard.type("The quick brown fox jumps over the lazy", { delay: 60 });
console.log("typed in", Date.now() - t1, "ms, expected", 39 * 60);
await d.sleep(1200);
console.log(await d.ui("JSON.stringify({longtasks:window.__lt, slowKeyEvents:window.__ev})"));
await d.key("Meta+a"); await d.page.keyboard.type(original || "", { delay: 15 }); if (!original) await d.key("Backspace"); await d.sleep(1000);
console.log("restored:", (await d.ui("document.activeElement.textContent")) === original);
await d.close();
