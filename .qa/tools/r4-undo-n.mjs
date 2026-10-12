import { ctx } from "./qa-lib.mjs"; import { state } from "./r4-lib.mjs";
const d=await ctx(process.env.FILE); const S=(l)=>state(d,l,"welcome.cta","1:7");
const seq=process.argv.slice(2);
await d.page.mouse.click(832,113); await d.sleep(300);
for(const k of seq){ await d.key(k); await d.sleep(1800); await S(k); }
await d.close();
