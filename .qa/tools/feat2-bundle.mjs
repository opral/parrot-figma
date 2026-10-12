// FILE=.. node feat2-bundle.mjs <bundleId> : stored variant texts of a bundle read from the plugin's inlang store (via UI bundle elements) 
import { ctx, DEEP } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(await d.ui(`(()=>{const deep=${DEEP};const bs=[...document.querySelectorAll('inlang-bundle')].filter(b=>b.bundle?.id===${JSON.stringify(process.argv[2])});return JSON.stringify(bs.map(b=>deep(b,'[contenteditable]').map(e=>e.textContent)))})()`));
await d.close();
