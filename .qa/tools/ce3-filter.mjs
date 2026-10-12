// ce3 QA helper (FILE=<id>): node ce3-filter.mjs "<search>" "<filter label prefix>" [shot] -> visible message names
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const file = process.env.FILE || "4Xgyn";
const [search, filter, shotName] = process.argv.slice(2);
const d = await ctx(file);
try {
  await d.click(".tab", "Messages"); await d.sleep(300);
  await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key("Meta+a"); await d.type(search); await d.sleep(900);
  await d.clickEl("document.querySelector('.message-filter-missing')"); await d.sleep(500);
  const options = await d.ui(`[...document.querySelectorAll('.message-filter-missing [class*=item], .message-filter-missing [role=option], [class*=select-menu__item]')].filter(e=>e.getBoundingClientRect().height>5).map(e=>e.textContent.trim())`);
  await d.clickEl(`[...document.querySelectorAll('[class*=select-menu__item], [role=option]')].filter(e=>e.getBoundingClientRect().height>5).find(e=>e.textContent.trim().startsWith(${JSON.stringify(filter)}))`);
  await d.sleep(900);
  const names = await d.ui(`[...document.querySelectorAll('.message-group')].filter(g=>g.getBoundingClientRect().height>10).map(g=>g.querySelector('.message-group-header-name')?.textContent.trim())`);
  console.log(JSON.stringify({ options: [...new Set(options)], names }));
  if (shotName) execSync(`node cdp.mjs uishot ../shots/${shotName}.png ${file}`, { cwd: import.meta.dirname });
} finally { await d.close(); }
