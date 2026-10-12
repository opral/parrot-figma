// usage: FILE=<file> node icu-search.mjs "<query>" [shot-name]   (Messages tab, search, optional plugin screenshot to ../shots/<shot>.png)
import { ctx, waitUi, search } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const FILE = process.env.FILE ?? "7cQCVw";
const d = await ctx(FILE); await waitUi(d); await search(d, process.argv[2]); await d.sleep(800);
if (process.argv[3]) execSync(`cd ${import.meta.dirname} && node cdp.mjs uishot ../shots/${process.argv[3]}.png ${FILE}`);
await d.close();
