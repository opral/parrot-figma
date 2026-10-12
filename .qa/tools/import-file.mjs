// usage (FILE=<file id> env, default 4Xgyn): node import-file.mjs <fmt|-> <file> <language row prefix> [shot] [--noimport]
import { open } from "./drive.mjs";
const [fmt, file, lang, shot] = process.argv.slice(2);
const FILE = process.env.FILE ?? "4Xgyn";
const d = await open(FILE);
await d.click(".tab", "Import"); await d.sleep(600);
if (fmt !== "-") {
  await d.click(".transfer-format .select-menu__button"); await d.sleep(600);
  await d.click("[class*=select-menu__item]", fmt); await d.sleep(600);
}
const idx = await d.ui(`[...document.querySelectorAll('.transfer-language-row')].findIndex(r=>r.textContent.startsWith(${JSON.stringify(lang)}))+1`);
if (!idx) throw new Error("no row " + lang);
let t0 = Date.now();
await d.upload(`.transfer-language-row:nth-child(${idx}) input[type=file]`, file.startsWith("/") ? file : "/tmp/parrot-qa/" + file);
for (let i = 0; i < 100; i++) { await d.sleep(200); if (await d.ui("!!document.querySelector('.top-drawer.open')||!!document.querySelector('[role=alert]')")) break; }
const preview = await d.ui(`document.querySelector('.top-drawer.open')?.innerText.replace(/\\n+/g,' | ').slice(0,700) ?? null`);
const err = await d.ui("document.querySelector('[role=alert]')?.textContent ?? null");
console.log(`### ${fmt} -> ${lang} (${file}) preview ${Date.now()-t0}ms\npreview: ${preview}\nalert: ${err}`);
if (shot) await (await import("node:child_process")).execSync(`cd ${import.meta.dirname} && node cdp.mjs uishot ../shots/${shot}.png ${FILE}`);
if (preview && !process.argv.includes("--noimport")) {
  t0 = Date.now();
  await d.click("button", "Import");
  for (let i = 0; i < 2000; i++) { await d.sleep(200); const s = await d.ui("document.querySelector('[role=status]')?.textContent ?? ''"); if (/Imported/.test(s)) break; }
  console.log("result:", Date.now() - t0, "ms", await d.ui("(document.querySelector('[role=alert]')?.textContent ?? '') + ' / ' + (document.querySelector('[role=status]')?.textContent ?? '')"));
} else if (process.argv.includes("--noimport") && preview) { await d.click("button", "Cancel"); }
await d.close();
