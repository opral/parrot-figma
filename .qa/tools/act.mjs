// usage: node act.mjs "<js using d (ctx), async>" ; one-off driver script runner
import { ctx } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const d = await ctx(process.env.FILE||"4Xgyn");
const shot=(n)=>execSync(`node cdp.mjs uishot ../shots/${n}.png`);
try { await (new Function("d","shot","return (async()=>{"+process.argv[2]+"})()"))(d,shot); } finally { await d.close(); }
