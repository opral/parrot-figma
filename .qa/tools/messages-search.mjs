import { ctx, waitUi, search } from "./qa-lib.mjs";
const d = await ctx(); await waitUi(d); await search(d, process.argv[2]); await d.close();
