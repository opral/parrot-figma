// usage: FILE=<file> node icu-type.mjs "<query>" <bundleId> <locale> "<text>" [shot]  -> click at the end of the language's field, type text
import { ctx, waitUi, search, rowExpr, fieldOf } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE ?? "7cQCVw";
const [q, id, locale, text, shot] = process.argv.slice(2);
const d = await ctx(FILE); await waitUi(d); await search(d, q); await d.sleep(800);
const f = fieldOf(rowExpr(id, locale));
const p = await d.ui(`(()=>{const e=${f};if(!e)return null;e.scrollIntoView({block:'center'});const r=e.getBoundingClientRect();return [r.right-6,r.y+r.height/2]})()`);
if (!p) throw new Error("field not found");
await d.clickAt(p[0], p[1]); await d.sleep(300);
await d.key("End"); await d.type(text); await d.sleep(1500);
console.log(await d.ui(`(()=>{const e=${f};return e&&e.textContent})()`));
if (shot) execSync(`cd ${import.meta.dirname} && node cdp.mjs uishot ../shots/${shot}.png ${FILE}`);
await d.close();
