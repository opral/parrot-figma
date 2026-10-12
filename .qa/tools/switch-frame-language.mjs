// FILE=<id> node switch-frame-language.mjs "<menu item text>" ...  - switch the selected frame (Layers tab) to each language and print all text nodes of the page
import { open } from "./drive.mjs";
const d = await open(process.env.FILE || "4Xgyn");
for (const lang of process.argv.slice(2)) {
  await d.click(".select-menu__button", undefined, 0); await d.sleep(400);
  const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())");
  const it = items.find(t=>t.includes(lang));
  if (!it) { console.log("no item", lang, items); continue; }
  await d.click("[class*=select-menu__item]", it); await d.sleep(4500);
  const texts = await d.page.evaluate("figma.currentPage.findAll(n=>n.type==='TEXT').map(n=>n.characters)");
  console.log(lang, JSON.stringify(texts));
}
await d.close();
