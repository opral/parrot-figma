import { chromium } from "playwright-core";
import { open } from "./drive.mjs";
const t0=Date.now();
const { execFileSync } = await import("node:child_process");
const out = execFileSync("node",["run-plugin.mjs","4Xgyn"]).toString().trim();
const tUi=Date.now()-t0; console.log(out,'UI loaded at',tUi);
const d = await open("4Xgyn");
let tTabs=null,tRows=null;
for(let i=0;i<400;i++){
  const s = await d.ui(`JSON.stringify({tabs:!!document.querySelector('.tab'), rows:document.querySelectorAll('.message-group,.layer-row,[data-message-id]').length, txt:document.body.innerText.slice(0,60)})`).catch(()=>null);
  if(s){const o=JSON.parse(s); if(o.tabs&&tTabs===null)tTabs=Date.now()-t0; if(o.tabs) break;}
  await d.sleep(100);
}
console.log('tabs at',tTabs);
await d.click(".tab","Messages");
const tm=Date.now();
for(let i=0;i<400;i++){ const n=await d.ui("document.querySelectorAll('[data-message-id]').length"); if(n>0){tRows=Date.now()-t0;console.log('rows at',tRows,'(msgs tab click +'+(Date.now()-tm)+')');break;} await d.sleep(100);}
await d.close();
