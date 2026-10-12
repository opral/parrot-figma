import { open } from "./drive.mjs";
export async function ctx(file="4Xgyn"){
  const d = await open(file);
  d.fo = async()=> d.page.evaluate(() => { const f = [...document.querySelectorAll("iframe")].map((x) => x.getBoundingClientRect()).filter((r) => r.width > 200).sort((a, b) => b.width * b.height - a.width * a.height)[0]; return { x: f.x, y: f.y }; });
  // real click at ui coords
  d.clickAt = async(x,y)=>{const o=await d.fo(); await d.page.mouse.click(o.x+x,o.y+y)};
  // click element by JS locator expression returning element; real mouse
  d.clickEl = async(expr)=>{const measure=`(()=>{const e=(${expr});if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`; let p=await d.ui(measure); if(!p) throw new Error('not found '+expr);
    // round 3: the layout shifts after a scroll / a save (sticky headers, lazy rows) - measure again right before the click so it does not land on a header
    if(process.env.QA_NO_SETTLE===undefined){ await d.sleep(250); p=await d.ui(measure)||p; }
    await d.clickAt(p[0],p[1]); return p;};
  d.fig = (js)=> d.page.evaluate(js);
  return d;
}
export async function waitUi(d){ for(let i=0;i<300;i++){ try{ if(await d.ui("!!document.querySelector('.tab')")) return; }catch{} await d.sleep(200);} throw new Error('ui not loaded'); }
export async function search(d, q){ await d.click(".tab","Messages"); await d.sleep(500); await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key("Meta+a"); await d.type(q); await d.sleep(900); }
// round 3 (messages-import-export): deep (shadow DOM piercing) search helpers for the Messages tab.
// d.field(bundleId, localeIndex) -> JS expression (string) that returns the contenteditable of that language row of the bundle (0 = reference).
export const DEEP = `(function deepAll(root, sel, out=[]){ root.querySelectorAll(sel).forEach(e=>out.push(e)); root.querySelectorAll('*').forEach(e=>{ if(e.shadowRoot) deepAll(e.shadowRoot, sel, out); }); return out; })`;
export function fieldExpr(bundleId, idx){ return `(()=>{const deep=${DEEP};const b=[...document.querySelectorAll('inlang-bundle')].find(b=>b.bundle?.id===${JSON.stringify(bundleId)}&&b.getBoundingClientRect().height>10);if(!b)return null;const f=deep(b,'[contenteditable]').filter(e=>e.getBoundingClientRect().height>10);return f[${idx}]})()`; }
// ICU round (composable editor): the pattern field of a language row of a message in the Messages tab.
// rowExpr(bundleId, locale) -> JS expression returning `.inlang-row[data-locale]` of the visible message; fieldOf(rowExpr) -> its contenteditable.
export function rowExpr(bundleId, locale){ return `(()=>{const ed=[...document.querySelectorAll('.figma-inlang-editor')].filter(e=>e.getBoundingClientRect().height>10).find(e=>{let p=e;for(let i=0;i<8&&p;i++,p=p.parentElement){const h=p.querySelector&&p.querySelector('.message-key, [class*=message-name], [class*=message-id]');if(h&&h.textContent.trim()===${JSON.stringify(bundleId)})return true;}return false})||[...document.querySelectorAll('.figma-inlang-editor')].filter(e=>e.getBoundingClientRect().height>10)[0];return ed?ed.querySelector('.inlang-row[data-locale=${JSON.stringify(locale)}]'):null})()`; }
export function fieldOf(row){ return `(()=>{const deep=${DEEP};const r=${row};if(!r)return null;const f=deep(r,'[contenteditable]').filter(e=>e.getBoundingClientRect().height>10);return f[f.length-1]})()`; }
