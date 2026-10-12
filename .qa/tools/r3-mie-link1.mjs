// usage: FILE=4Xgyn node r3-mie-link1.mjs <frameId> <textIndex> <key>   (link ONE text of the frame, by index among the rows)
import { ctx } from "./qa-lib.mjs";
const [frameId, idx, key] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
try {
  await d.fig(`(()=>{figma.currentPage.selection=[figma.getNodeById(${JSON.stringify(frameId)})]})()`);
  await d.sleep(1200); await d.click(".tab", "Layers"); await d.sleep(800);
  await d.clickEl(`[...document.querySelectorAll('.message-select')].filter(e=>e.getBoundingClientRect().height>10)[${idx}]`);
  await d.sleep(250); await d.type(key); await d.key("Enter"); await d.sleep(1500);
  console.log(JSON.stringify(await d.fig(`figma.getNodeById(${JSON.stringify(frameId)}).findAll(n=>n.type==='TEXT').map(n=>[n.characters,n.getPluginData('mn')])`)));
} finally { await d.close(); }
