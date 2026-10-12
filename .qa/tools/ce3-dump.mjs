// ce3 QA helper (FILE=<id>): node ce3-dump.mjs <message key> [shot]  -> per language: the forms strip (+ Add form = missing), the problems line
import { ctx } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const file = process.env.FILE || "4Xgyn";
const [key, shotName] = process.argv.slice(2);
const d = await ctx(file);
try {
  await d.click(".tab", "Messages"); await d.sleep(300);
  await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key("Meta+a"); await d.type("name:" + key); await d.sleep(1200);
  const rows = await d.ui(`(() => { const g=[...document.querySelectorAll('.message-group-inlang')].find(g=>g.querySelector('.message-group-header-name')?.textContent.trim()===${JSON.stringify(key)}&&g.getBoundingClientRect().height>10);
    if(!g) return 'no group';
    return [...g.querySelectorAll('.inlang-row')].map(r=>{ const f=r.querySelector('inlang-message-forms');
      const forms=f?[...f.shadowRoot.querySelectorAll('button.form')].map(b=>(b.classList.contains('missing')?'MISSING ':b.classList.contains('optional')?'optional ':'')+b.getAttribute('aria-label').slice(0,60)):[];
      return { locale: r.querySelector('.inlang-row-locale span')?.textContent, forms, problems: r.querySelector('.translation-problems')?.innerText ?? '' }; }); })()`);
  console.log(JSON.stringify(rows, null, 1));
  if (shotName) execSync(`node cdp.mjs uishot ../shots/${shotName}.png ${file}`, { cwd: import.meta.dirname });
} finally { await d.close(); }
