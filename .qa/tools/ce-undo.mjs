// node ce-undo.mjs <name> <locale> "<text>" [undos=1]: edit a field (REPLACE text), wait, click empty canvas, Cmd+Z x N, Cmd+Shift+Z; poll stored / canvas / field
const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text, undos = '1'] = ${a};
const pageName = process.env.PAGE || 'QA messages-editor';
const snap = async () => {
  const stored = await fig(\`(()=>{const r=figma.root.getPluginData('prt_ib__'+\${JSON.stringify(name)});if(!r)return null;return JSON.parse(r).messages.map(m=>m.locale+':'+m.variants.map(v=>v.pattern.map(p=>p.value??'{'+p.arg?.name+'}').join('')).join('/')).join(',')})()\`);
  const canvas = await fig(\`figma.root.children.find(p=>p.name===\${JSON.stringify(pageName)}).findAll(n=>n.type==='TEXT'&&n.getPluginData('mn')===\${JSON.stringify(name)}).map(n=>n.characters).join('|')\`);
  return 'stored[' + loc + ']=' + (stored||'').split(',').find(x=>x.startsWith(loc+':')) + ' canvas=' + canvas + ' field=' + JSON.stringify(await d.val(name, loc)) + ' active=' + await d.ui('document.activeElement.tagName');
};
const poll = async (label, ms) => { const t0 = Date.now(); let last = ''; while (Date.now() - t0 < ms) { const s = await snap(); if (s !== last) { console.log(label, String(Date.now() - t0).padStart(5), s); last = s; } await d.sleep(250); } };
console.log('start', await snap());
await d.clickEl(F(name, loc)); await d.key('Meta+a'); await d.page.keyboard.type(text, {delay: 20});
await poll('edit', 2500);
await d.page.mouse.click(832, 113); await d.sleep(700);
for (let i = 0; i < Number(undos); i++) { await d.key('Meta+z'); await poll('undo' + (i + 1), 3000); }
await d.key('Meta+Shift+Z'); await poll('redo', 3000);
`;
await import("./ce.mjs");
