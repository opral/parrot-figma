// usage: node shotall.mjs <prefix> [width height] ; screenshots each tab (Layers needs selection set beforehand)
import { ctx } from "./qa-lib.mjs";
const prefix = process.argv[2]; const w=+process.argv[3]||800, h=+process.argv[4]||600;
const d = await ctx(process.env.FILE||"4Xgyn");
await d.fig(`figma.ui.resize(${w},${h})`);
await d.sleep(800);
for (const t of ["Layers","Messages","Import","Export","Setup"]) {
  await d.click(".tab", t); await d.sleep(900);
  await d.page.evaluate(()=>0);
  const {execSync}=await import("node:child_process");
  execSync(`node cdp.mjs uishot ../shots/${prefix}-${t.toLowerCase()}.png ${process.env.FILE||"4Xgyn"}`);
}
await d.close();
