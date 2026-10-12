import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
await d.click(".tab", "Import"); await d.sleep(600);
console.log("Import tab:", await d.ui("document.querySelector('.transfer-language-detail')?.innerText"));
await d.click(".tab", "Layers"); await d.sleep(500);
await d.close();
