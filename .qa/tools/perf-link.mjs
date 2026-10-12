// node perf-link.mjs [search|link|both]  (FILE env default 4Xgyn) - times "Link matching layers on this page" and linking the offered layers.
// Needs the Import tab on a page with unlinked layers. Records rAF gaps + longtasks in the UI during both steps.
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const F = process.env.FILE || "4Xgyn";
const mode = process.argv[2] || "both";
const d = await ctx(F);
await d.click(".tab", "Import"); await d.sleep(700);
await d.ui(`window.__raf=[];window.__lt=[];(function loop(){window.__raf.push(Math.round(performance.now()));requestAnimationFrame(loop)})();try{new PerformanceObserver(l=>l.getEntries().forEach(e=>window.__lt.push([Math.round(e.startTime),Math.round(e.duration)]))).observe({entryTypes:['longtask']})}catch(e){};0`);
const stats = async (t0, t1) => d.ui(`(()=>{const a=window.__raf.filter(t=>t>=${t0}&&t<=${t1});const gaps=a.map((t,i)=>i?t-a[i-1]:0);return JSON.stringify({frames:a.length,maxGap:Math.max(0,...gaps),gaps_gt100:gaps.filter(g=>g>100),longtasks:window.__lt.filter(x=>x[0]>=${t0}&&x[0]<=${t1}).map(x=>x[1])})})()`);
const now = () => d.ui("Math.round(performance.now())");
if (mode !== "link") {
  await d.ui("document.querySelector('.transfer-link-layers button').scrollIntoView({block:'center'})"); await d.sleep(400);
  const p = await d.ui("(()=>{const b=document.querySelector('.transfer-link-layers button');const r=b.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()");
  const t0 = await now();
  const w0 = Date.now();
  await d.clickAt(p[0], p[1]);
  let rows = 0;
  for (let i = 0; i < 600; i++) {
    await d.sleep(50);
    const s = await d.ui(`JSON.stringify([document.querySelector('.link-review-drawer')?.classList.contains('open'), document.querySelectorAll('.link-review-drawer .link-review-row').length, document.querySelector('[role=status]')?.innerText])`);
    const [open, n, note] = JSON.parse(s);
    if (open && n > 0) { rows = n; break; }
    if (/No unlinked/.test(note || "")) break;
  }
  const w1 = Date.now();
  console.log("SEARCH wall", w1 - w0, "ms (incl. ~50ms poll + CDP), drawer rows", rows);
  console.log("search ui stats", await stats(t0, await now()));
}
if (mode !== "search") {
  await d.sleep(1500);
  const t0 = await now();
  const label = await d.ui("[...document.querySelectorAll('.top-drawer.open button')].map(b=>b.innerText).join('|')");
  console.log("buttons", label);
  const w0 = Date.now();
  await d.click(".top-drawer.open button", label.split("|")[0]);
  let note = "";
  for (let i = 0; i < 1200; i++) {
    await d.sleep(100);
    note = await d.ui("document.querySelector('[role=status]')?.innerText||''");
    if (/Linked \d+ layer/.test(note)) break;
  }
  const w1 = Date.now();
  console.log("LINK wall", w1 - w0, "ms; notice:", note);
  console.log("link ui stats", await stats(t0, await now()));
}
await d.close();
