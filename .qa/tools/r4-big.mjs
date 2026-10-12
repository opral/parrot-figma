import { open } from "./drive.mjs";
const d = await open("4Xgyn");
await d.page.evaluate(async()=>{const n=figma.getNodeById('51:26');await figma.setCurrentPageAsync(n.parent);figma.currentPage.selection=[n];});
await d.sleep(2000); await d.click('.tab','Layers'); await d.sleep(1000);
const lt=[]; 
for (const lang of ["German","English"]) {
  await d.click(".select-menu__button", undefined, 0); await d.sleep(500);
  const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())");
  const t0=Date.now(); await d.click("[class*=select-menu__item]", items.find(t=>t.includes(lang)));
  let tdone=null; for(let i=0;i<600;i++){ const l=await d.page.evaluate(()=>figma.getNodeById('51:26').getPluginData('l')); const code=lang==='German'?'de':'en'; const first=await d.page.evaluate(()=>figma.getNodeById('51:26').findAll(n=>n.type==='TEXT').map(n=>n.characters).join('').length); if(l===code){ tdone=Date.now()-t0; break;} await d.sleep(100);}
  console.log(lang,'frame lang set after',tdone,'ms'); await d.sleep(3000);
}
await d.close();
