// node onboard.mjs <file> "<ref query>|<option label contains>" "<target query>|<label>" ...
import { open } from "./drive.mjs";
const [file, ref, ...targets] = process.argv.slice(2);
const d = await open(file);
const pick = async (q, label) => {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (!(await d.ui("!!document.querySelector('.react-select__menu')"))) { await d.click(".react-select__control", undefined, 0); await d.sleep(400); }
    await d.key("Meta+a"); await d.type(q); await d.sleep(700);
    const items = await d.ui("[...document.querySelectorAll('.react-select__option')].map(e=>e.textContent)");
    const it = items.find(t => t.includes(label));
    if (it) { await d.click(".react-select__option", it); await d.sleep(500); return; }
  }
  throw new Error("no option " + label);
};
await pick(...ref.split("|"));
for (const t of targets) await pick(...t.split("|"));
console.log(await d.ui("document.body.innerText.replace(/\\n+/g,' | ').slice(0,500)"));
await d.click("button","Finish setup"); await d.sleep(1000);
if (!(await d.ui("document.querySelectorAll('.tab').length"))) { await d.click("button","Finish setup"); await d.sleep(1500); }
console.log(await d.ui("[...document.querySelectorAll('.tab')].map(t=>t.textContent)"));
await d.close();
