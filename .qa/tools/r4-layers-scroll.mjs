// node r4-layers-scroll.mjs <frameId> : select frame (Layers tab) and measure JS-driven scroll frame times
import { open } from "./drive.mjs";
const d = await open("4Xgyn");
await d.click('.tab','Layers').catch(()=>{});
await d.ui("window.__lt=[];window.__po&&window.__po.disconnect();window.__po=new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(Math.round(e.duration))));window.__po.observe({entryTypes:['longtask']});1");
await d.page.evaluate(async(id)=>{figma.currentPage.selection=[];await new Promise(r=>setTimeout(r,500));const n=figma.getNodeById(id);await figma.setCurrentPageAsync(n.parent.type==='PAGE'?n.parent:n.parent);figma.currentPage.selection=[n];},process.argv[2]);
await d.sleep(6000);
console.log('rows', await d.ui("document.querySelectorAll('.message-select').length"), 'select longtasks', await d.ui("JSON.stringify(window.__lt)"));
console.log(JSON.stringify(await d.ui("(async()=>{const sc=[...document.querySelectorAll('*')].filter(e=>e.scrollHeight>e.clientHeight+300&&getComputedStyle(e).overflowY!=='visible').sort((a,b)=>b.scrollHeight-a.scrollHeight)[0]; if(!sc) return 'no scroller'; const fr=[];let last=performance.now();let n=0;await new Promise(r=>{const step=()=>{const now=performance.now();fr.push(now-last);last=now;sc.scrollTop+=300;if(++n<100)requestAnimationFrame(step);else r()};requestAnimationFrame(step)});const s=[...fr].sort((a,b)=>a-b);return {h:sc.scrollHeight,median:Math.round(s[50]),max:Math.round(s[99]),over50:s.filter(x=>x>50).length}})()")));
await d.page.evaluate(()=>{figma.currentPage.selection=[]});
await d.close();
