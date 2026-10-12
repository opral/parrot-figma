// round 4 helpers: import { ctx } ...; state(d, bundleId, nodeId) prints canvas text + visible Messages fields + stored bundle variants
import { DEEP } from "./qa-lib.mjs";
export async function state(d, label, bundleId, nodeId) {
  const c = await d.fig(`(()=>{const n=figma.getNodeById(${JSON.stringify(nodeId)}); return n? n.characters : null})()`);
  const fld = await d.ui(`(()=>{const deep=${DEEP};const b=[...document.querySelectorAll('inlang-bundle')].find(b=>b.bundle?.id===${JSON.stringify(bundleId)});return b? deep(b,'[contenteditable]').filter(e=>e.getBoundingClientRect().height>10).map(e=>e.textContent):null})()`);
  const act = await d.ui("document.activeElement.tagName+' focus='+document.hasFocus()");
  console.log(label.padEnd(28), "canvas=", JSON.stringify(c), "fields=", JSON.stringify(fld), act);
}
