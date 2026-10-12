// usage: FILE=4Xgyn node r3-race.mjs <frameId> <keyPrefix> <gapMs> <language label e.g. "French"> [nTexts=1] [settleMs=9000]
// Real-UI race repro: link the first nTexts texts of the frame (type key + Enter), wait gapMs after the LAST Enter, then pick the language in the frame menu.
// Prints canvas text + mn plugin data per text after settling. Frame must be selectable by id (selected through the figma API).
import { ctx, waitUi } from "./qa-lib.mjs";
const [frameId, prefix, gapMs, lang, n = "1", settle = "9000"] = process.argv.slice(2);
const d = await ctx(process.env.FILE || "4Xgyn");
const snap = () => d.fig(`(()=>{const f=figma.getNodeById(${JSON.stringify(frameId)});return f.findAll(n=>n.type==='TEXT').map(n=>[n.name,n.characters,n.getPluginData('mn')||'', n.getPluginData('lng')||''])})()`);
try {
  await d.fig(`(()=>{const f=figma.getNodeById(${JSON.stringify(frameId)});figma.currentPage.selection=[f]})()`);
  await d.sleep(1200);
  await d.click(".tab", "Layers");
  await d.sleep(800);
  if (process.env.R3DELAY) await d.ui(`window.__r3Delay=${Number(process.env.R3DELAY)}`); // needs the temporary delay hook in linkMessage
  const before = await snap();
  for (let i = 0; i < Number(n); i++) {
    await d.clickEl(`document.querySelectorAll('.message-select input, .message-select')[0] && [...document.querySelectorAll('.message-select')][${i}]`);
    await d.sleep(250);
    await d.type(`${prefix}.t${i}`);
    await d.key("Enter");
  }
  const t0 = Date.now();
  await d.sleep(Number(gapMs));
  await d.click(".select-menu__button", undefined, 0);
  await d.sleep(450); // > 350 ms double click guard
  const items = await d.ui("[...document.querySelectorAll('[class*=select-menu__item]')].filter(e=>e.getBoundingClientRect().width>0).map(e=>e.textContent.trim())");
  const it = items.find((t) => t.includes(lang));
  if (!it) throw new Error("no menu item " + lang + " in " + JSON.stringify(items));
  await d.click("[class*=select-menu__item]", it);
  console.log("gap(link->menu click) ~", Date.now() - t0 - 450, "ms");
  await d.sleep(Number(settle));
  console.log("before", JSON.stringify(before));
  console.log("after ", JSON.stringify(await snap()));
  console.log("frame language label:", await d.ui("document.querySelector('.select-menu__button')?.textContent"));
} finally { await d.close(); }
