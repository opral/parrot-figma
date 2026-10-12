// node b2-import.mjs <file in /tmp/parrot-qa> "<language row prefix>" [shot]  (FILE env, default ZXC9xq)
// Import tab -> upload -> click Import in the review drawer -> waits for the link review drawer / notice, prints rows + timing
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const [file, lang, shot] = process.argv.slice(2);
const F = process.env.FILE || "ZXC9xq";
const d = await ctx(F);
await d.click(".tab", "Import"); await d.sleep(700);
const idx = await d.ui(`[...document.querySelectorAll('.transfer-language-row')].findIndex(r=>r.textContent.startsWith(${JSON.stringify(lang)}))+1`);
await d.upload(`.transfer-language-row:nth-child(${idx}) input[type=file]`, "/tmp/parrot-qa/" + file);
for (let i = 0; i < 100; i++) { await d.sleep(200); if (await d.ui("!!document.querySelector('.top-drawer.open')||!!document.querySelector('[role=alert]')")) break; }
await d.sleep(500);
const t0 = Date.now();
await d.click(".top-drawer.open button", "Import");
let seen = "";
for (let i = 0; i < 600; i++) {
  await d.sleep(100);
  const s = await d.ui(`(()=>{const b=document.querySelector('.transfer-link-layers button')?.innerText;const dr=document.querySelector('.link-review-drawer');return JSON.stringify([b, dr?.classList.contains('open'), document.querySelector('[role=status]')?.innerText])})()`);
  if (s !== seen) { seen = s; console.log(Date.now() - t0, "ms", s); }
  if (JSON.parse(s)[1] || /No unlinked/.test(JSON.parse(s)[2] || "")) break;
}
await d.sleep(500);
console.log(await d.ui(`[...document.querySelectorAll('.link-review-drawer .link-review-row')].map(r=>r.innerText.replace(/\\n/g,' | ')+' chk='+r.querySelector('input[type=checkbox]').checked)`));
if (shot) execSync(`node cdp.mjs uishot ../shots/${shot}.png ${F}`);
await d.close();
