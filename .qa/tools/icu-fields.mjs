// usage: FILE=<file> node icu-fields.mjs "<query>"  -> search, then print the visible pattern fields (innerHTML)
import { ctx, waitUi, search, DEEP } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE ?? "7cQCVw"); await waitUi(d); await search(d, process.argv[2]); await d.sleep(800);
console.log(await d.ui(`(()=>{const deep=${DEEP};return deep(document,"[contenteditable]").filter(e=>e.getBoundingClientRect().height>10).map(e=>e.innerHTML.replace(/ data-lexical-text="true"| spellcheck="false"| dir="ltr"/g,'').slice(0,700))})()`));
await d.close();
