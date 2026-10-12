// usage: FILE=4Xgyn node r3-mie-link.mjs <frameId> key1 key2 ... ; links the frame's texts (in order) to the keys with real typing
import { ctx } from "./qa-lib.mjs";
const [frameId, ...keys] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
try {
  await d.fig(`(()=>{figma.currentPage.selection=[figma.getNodeById(${JSON.stringify(frameId)})]})()`);
  await d.sleep(1200); await d.click(".tab", "Layers"); await d.sleep(800);
  for (let i = 0; i < keys.length; i++) {
    await d.clickEl(`[...document.querySelectorAll('.message-select')].filter(e=>e.getBoundingClientRect().height>10)[${i}]`);
    await d.sleep(250); await d.type(keys[i]); await d.key("Enter"); await d.sleep(900);
  }
  console.log(JSON.stringify(await d.fig(`figma.getNodeById(${JSON.stringify(frameId)}).findAll(n=>n.type==='TEXT').map(n=>[n.characters,n.getPluginData('mn')])`)));
} finally { await d.close(); }
