// usage: FILE=4Xgyn node r3-mie-chain.mjs <bundleA> <bundleB> [rounds=6] [gapMs=800]
// Types into field 0 of bundle A, waits gapMs, clicks into field 0 of bundle B and types: both fields must keep exactly what was typed (focus-theft regression test).
import { ctx, fieldExpr } from "./qa-lib.mjs";
const [A, B, rounds = "6", gap = "800"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
const read = (id) => d.ui(`(()=>{const e=${fieldExpr(id, 0)};return e&&e.textContent})()`);
let bad = 0;
try {
  for (let i = 1; i <= Number(rounds); i++) {
    const ta = `Alpha {name} run ${i} ${"x".repeat(i % 3)}`, tb = `Beta run ${i}`;
    await d.clickEl(fieldExpr(A, 0)); await d.key("Meta+a"); await d.type(ta); await d.sleep(Number(gap));
    await d.ui(`(()=>{window.__tl=[];const t0=Date.now();window.__L=(x)=>window.__tl.push([Date.now()-t0,x]);if(!window.__fi2){window.__fi2=1;document.addEventListener('focusin',e=>{const b=e.composedPath().find(n=>n.tagName==='INLANG-BUNDLE');window.__L('focusin '+(b?.bundle?.id)+' '+new Error().stack.split('\\n').slice(1,12).map(x=>x.trim().replace(/\\(.*\\//,'(')).join(' | '))},true)}})()`);
    const rectB0 = await d.ui(`JSON.stringify(${fieldExpr(B, 0)}.getBoundingClientRect())`);
    const pos = await d.clickEl(fieldExpr(B, 0)); await d.ui(`window.__L('clicked at ${pos} active='+(()=>{let a=document.activeElement;const p=[];while(a){p.push(a.tagName+(a.className?'.'+String(a.className).slice(0,30):''));a=a.shadowRoot?.activeElement}return p.join('>')})()+' top='+(()=>{const e=document.elementFromPoint(${pos[0]},${pos[1]});return e&&(e.tagName+'.'+String(e.className).slice(0,40))})())`); await d.key("Meta+a"); await d.type(tb); await d.sleep(2500);
    const [ra, rb] = [await read(A), await read(B)];
    const ok = ra === ta && rb === tb; if (!ok) bad++;
    console.log(i, ok ? "OK " : "BAD", JSON.stringify([ra, rb]));
    if (!ok) console.log("   ", rectB0, await d.ui("JSON.stringify(window.__tl)"));
  }
  console.log("bad:", bad);
} finally { await d.close(); }
