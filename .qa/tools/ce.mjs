// Composable-editor QA driver: node ce.mjs "<async js with d, shot, G, F, R, fig>"   (FILE=<id>, default 4Xgyn)
//   G(name)        -> JS expr: the visible Messages group (.message-group-inlang) whose header name is exactly `name`
//   F(name, locale)-> JS expr: the contenteditable of that language row
//   R(name, locale)-> JS expr: the .inlang-row element
//   fig(js)        -> evaluate in the Figma page; d.val(name, locale) -> text of the field
import { ctx, waitUi } from "./qa-lib.mjs";
import { execSync } from "node:child_process";
const file = process.env.FILE || "4Xgyn";
const d = await ctx(file);
const shot = (n) => execSync(`node cdp.mjs uishot ../shots/${n}.png ${file}`);
const G = (name) => `[...document.querySelectorAll('.message-group-inlang')].find(g=>g.querySelector('.message-group-header-name')?.textContent.trim()===${JSON.stringify(name)}&&g.getBoundingClientRect().height>10)`;
const R = (name, locale) => `[...(${G(name)})?.querySelectorAll('.inlang-row')??[]].find(r=>r.querySelector('.inlang-row-locale span')?.textContent.trim()===${JSON.stringify(locale)})`;
const F = (name, locale) => `(${R(name, locale)})?.querySelector('[contenteditable]')`;
d.val = (name, locale) => d.ui(`(${F(name, locale)})?.innerText`);
d.setText = async (name, locale, text, delay = 0) => { await d.clickEl(F(name, locale)); await d.key('Meta+a'); if (text === '') await d.key('Backspace'); else await d.page.keyboard.type(text, { delay }); await d.sleep(900); };
d.msg = async (name) => { await d.click('.tab', 'Messages'); await d.sleep(300); await d.clickEl("document.querySelector('.message-filter-search-input')"); await d.key('Meta+a'); await d.type('name:' + name); await d.sleep(900); };
const fig = (js) => d.page.evaluate(js);
try { await (new Function("d", "shot", "G", "F", "R", "fig", "waitUi", "return (async()=>{" + process.argv[2] + "})()"))(d, shot, G, F, R, fig, waitUi); } finally { await d.close(); }
