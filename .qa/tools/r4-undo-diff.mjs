import { chromium } from "playwright-core"; import {snap} from "./r4-snap.mjs";
const b = await chromium.connectOverCDP("http://localhost:9222");
const p = b.contexts().flatMap(c=>c.pages()).find(x=>x.url().includes(process.env.FILE));
await p.mouse.click(832,113); await p.waitForTimeout(500);
const a=await snap(p); await p.keyboard.press(process.argv[2]||"Meta+z"); await p.waitForTimeout(2000); const c=await snap(p);
for(const k of new Set([...Object.keys(a),...Object.keys(c)])) if(a[k]!==c[k]) console.log(k,'\n  before:',a[k],'\n  after: ',c[k]);
await b.close();
