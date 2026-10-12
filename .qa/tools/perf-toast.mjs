import { ctx } from "./qa-lib.mjs";
const d = await ctx("ZXC9xq");
const row = process.argv[2], key = process.argv[3];
await d.clickEl(`document.querySelectorAll('.layer')[${row}].querySelector('.input-select-menu')`);
await d.sleep(500); await d.type(key); await d.sleep(300); await d.key("Enter");
await d.sleep(1800);
console.log("offer:", await d.ui("document.querySelector('.link-identical-toast')?.innerText"));
const t0 = Date.now();
await d.clickEl("document.querySelector('.link-identical-toast-action')");
for (let i = 0; i < 100; i++) { await d.sleep(100); const t = await d.ui("document.querySelector('.link-identical-toast')?.innerText"); if (/^Linked/.test(t || "")) { console.log("done after", Date.now() - t0, "ms:", t); break; } }
await d.close();
