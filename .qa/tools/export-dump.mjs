// usage (FILE=<file id> env): node export-dump.mjs <fmt> <outdir> [lang codes comma]  (exports every language row, captures blobs)
import { open } from "./drive.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
const [fmt, out, only] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const d = await open(process.env.FILE ?? "4Xgyn");
await d.click(".tab", "Export"); await d.sleep(600);
await d.click(".transfer-format .select-menu__button"); await d.sleep(600);
await d.click("[class*=select-menu__item]", fmt); await d.sleep(600);
const picked = await d.ui("document.querySelector('.transfer-format .select-menu__button').textContent");
if (picked.trim() !== fmt) throw new Error(`format picker shows "${picked}" instead of "${fmt}"`);
await d.ui(`(()=>{if(window.__patched)return;window.__exports=[];window.__patched=true;const o=URL.createObjectURL.bind(URL);URL.createObjectURL=(b)=>{if(b instanceof Blob)b.text().then(t=>window.__exports.push({size:b.size,text:t}));return o(b)}})()`);
const langs = await d.ui("[...document.querySelectorAll('.transfer-language-row')].map(r=>r.querySelector('.transfer-language-name').textContent.split('· ')[1])");
for (const [i, l] of langs.entries()) {
  if (only && !only.split(",").includes(l)) continue;
  const n = await d.ui("window.__exports.length");
  await d.click(`.transfer-language-row:nth-child(${i+1}) .transfer-action`); 
  for (let k=0;k<50;k++){ await d.sleep(100); if ((await d.ui("window.__exports.length"))>n) break; }
  const e = await d.ui("window.__exports.at(-1)");
  const fn = await d.ui("document.querySelector('[role=status]')?.textContent");
  console.log(l, fn, e?.size);
  writeFileSync(`${out}/${fmt.replace(/\W+/g,"_")}-${l}.txt`, e?.text ?? "");
}
await d.close();
