// measures: after clicking the "Link matching layers" button, did the UI get a rendering frame (rAF) before the sandbox blocked it?
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "4Xgyn");
await d.ui(`window.__raf=[];window.__go=false;(function loop(){window.__raf.push(Math.round(performance.now()));requestAnimationFrame(loop)})();0`);
await d.sleep(300);
const p = await d.ui("(()=>{const b=document.querySelector('.transfer-link-layers button');window.__t0=0;b.addEventListener('click',()=>{window.__t0=Math.round(performance.now())},true);const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()");
await d.clickAt(p[0], p[1]);
await d.sleep(6000);
console.log(await d.ui(`(()=>{const t0=window.__t0;const a=window.__raf.filter(t=>t>=t0-50);return JSON.stringify({t0,label:document.querySelector('.transfer-link-layers button').innerText,gaps:a.map((t,i)=>[t-t0,i?t-a[i-1]:0]).filter(x=>x[1]>100), n:a.length})})()`));
await d.close();
