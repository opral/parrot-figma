// act.mjs with the round-3 helpers: node act2.mjs "<async js with d, shot, F(bundleId, idx) -> field expr>"
import { ctx, fieldExpr } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const d = await ctx(process.env.FILE||"4Xgyn");
const shot=(n)=>execSync(`node cdp.mjs uishot ../shots/${n}.png ${process.env.FILE||"4Xgyn"}`);
try { await (new Function("d","shot","F","return (async()=>{"+process.argv[2]+"})()"))(d,shot,fieldExpr); } finally { await d.close(); }
