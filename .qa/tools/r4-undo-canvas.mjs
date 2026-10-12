import { ctx } from "./qa-lib.mjs"; import { state } from "./r4-lib.mjs"; import {execSync} from "node:child_process";
const F=process.env.FILE; const d=await ctx(F); const S=(l)=>state(d,l,"welcome.cta","1:7");
await d.sleep(1500); await S("before");
await d.page.mouse.click(832,113); await d.sleep(300);
await d.key("Meta+z"); await d.sleep(1800); await S("after undo (canvas)");
await d.key("Meta+Shift+Z"); await d.sleep(1800); await S("after redo (canvas)");
await d.close();
