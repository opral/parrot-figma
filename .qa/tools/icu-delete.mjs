// usage: FILE=<file> node icu-delete.mjs <key>...  -> deletes messages through the Messages tab (trash + "Delete message")
import { ctx, waitUi, search } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE ?? "7cQCVw"); await waitUi(d);
for (const key of process.argv.slice(2)) {
  await search(d, key); await d.sleep(800);
  await d.clickEl(`[...document.querySelectorAll("[data-tooltip-content='Delete this Message']")].filter(b=>b.getBoundingClientRect().height>5).pop()`);
  for (let i = 0; i < 40; i++) { await d.sleep(250); if (await d.ui(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Delete message'&&b.getBoundingClientRect().height>5&&!b.disabled)`)) break; }
  await d.clickEl(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Delete message'&&b.getBoundingClientRect().height>5)`);
  await d.sleep(1500);
  console.log(key, "deleted");
}
await d.close();
