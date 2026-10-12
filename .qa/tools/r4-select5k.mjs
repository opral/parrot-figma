import { open } from "./drive.mjs";
const d = await open("4Xgyn");
await d.ui("window.__lt=[];new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push(Math.round(e.duration)))).observe({entryTypes:['longtask']});1");
await d.click('.tab','Layers'); await d.sleep(500);
const t0=Date.now();
await d.page.evaluate(async()=>{const n=figma.getNodeById('6:48987');await figma.setCurrentPageAsync(n.parent);figma.currentPage.selection=[n];});
let t=null; for(let i=0;i<300;i++){ const s=await d.ui("document.body.innerText.length").catch(()=>0); if(s>200){t=Date.now()-t0;break;} await d.sleep(100);}
console.log('layers content after',t,'ms'); await d.sleep(3000);
console.log('rows', await d.ui("document.querySelectorAll('.message-select').length"), 'longtasks', await d.ui("JSON.stringify(window.__lt)"));
await d.close();
