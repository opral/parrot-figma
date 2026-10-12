import { open } from "./drive.mjs";
const d = await open(process.env.FILE); const gap=+process.argv[2]; const seq=process.argv.slice(3);
await d.page.evaluate(()=>{figma.currentPage.selection=[figma.getNodeById('1:2')]}); await d.sleep(1200); await d.click('.tab','Layers'); await d.sleep(800);
for(const lang of seq){ await d.click(".select-menu__button", undefined, 0); await d.sleep(450);
  const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].map(e=>e.textContent.trim())");
  await d.click("[class*=select-menu__item]", items.find(t=>t.includes(lang))); await d.sleep(gap); }
await d.sleep(9000);
console.log(await d.page.evaluate(()=>{const f=figma.getNodeById('1:2');return [f.getPluginData('l'), f.findAll(n=>n.type==='TEXT').map(n=>n.getPluginData('l')+':'+n.characters.slice(0,18)).join(' | ')]}));
await d.close();
