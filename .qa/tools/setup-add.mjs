// FILE=<id> node setup-add.mjs "<query>|<option label>" ...  - Setup tab: add target languages (empty label = first option)
import { open } from "./drive.mjs";
const d = await open(process.env.FILE ?? "4Xgyn");
const adds = process.argv.slice(2); // pairs query|label
await d.click(".tab", "Setup"); await d.sleep(600);
console.log(await d.ui("document.body.innerText.replace(/\\n+/g,' | ').slice(0,500)"));
// open the Target languages 'Change'
const changes = await d.ui("[...document.querySelectorAll('.choosen-language-change')].map(e=>e.textContent)");
console.log(changes);
await d.click(".choosen-language-change", "Change", changes.length-1); await d.sleep(400);
for (const a of adds) {
  const [q,label] = a.split("|");
  if (!(await d.ui("!!document.querySelector('.react-select__menu')"))) { await d.click(".react-select__control"); await d.sleep(300); }
  await d.type(q); await d.sleep(400);
  const opts = await d.ui("[...document.querySelectorAll('.react-select__option')].map(e=>e.textContent)");
  console.log(q, "->", opts.slice(0,6));
  await d.click(".react-select__option", label || undefined); await d.sleep(400);
}
await d.close();
