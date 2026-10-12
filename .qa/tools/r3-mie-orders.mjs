// FILE=<id> node r3-mie-orders.mjs : language order shown by every view (frame menu needs a selected frame)
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "4Xgyn");
try {
  await d.click(".tab", "Layers"); await d.sleep(800);
  await d.click(".select-menu__button", undefined, 0); await d.sleep(600);
  console.log("frame menu:", JSON.stringify(await d.ui(`[...new Set([...document.querySelectorAll('[class*=select-menu__item]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent.replace(/ref/,'').trim()).filter(Boolean))]`)));
  await d.key("Escape");
  await d.click(".tab", "Messages"); await d.sleep(900);
  console.log("messages  :", JSON.stringify(await d.ui(`(()=>{const b=[...document.querySelectorAll('inlang-bundle')].find(b=>b.getBoundingClientRect().height>10);return [...b.querySelectorAll('inlang-message')].map(m=>m.message?.locale)})()`)));
  for (const t of ["Import", "Export"]) { await d.click(".tab", t); await d.sleep(800); console.log(t.padEnd(10) + ":", JSON.stringify(await d.ui(`[...document.querySelectorAll('.transfer-language-row .transfer-language-name')].map(e=>e.textContent.split('· ')[1])`))); }
  await d.click(".tab", "Setup"); await d.sleep(800);
  console.log("setup     :", await d.ui(`document.body.innerText.replace(/\\n+/g,' | ').replace(/.*(Reference language)/,'$1').slice(0,400)`));
} finally { await d.close(); }
