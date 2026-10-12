// FILE=ZXC9xq node mt-state.mjs "<frame>" : frame l + texts with mn / l / aim
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
console.log(JSON.stringify(await d.fig(`(()=>{const f=figma.currentPage.findOne(n=>n.name===${JSON.stringify(process.argv[2])}); return {l:f.getPluginData('l'), texts:f.findAll(n=>n.type==='TEXT').map(t=>[t.characters, t.getPluginData('mn'), t.getPluginData('l'), t.getPluginData('aim')?'aim':''])}})()`)));
await d.close();
