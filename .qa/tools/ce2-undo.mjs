// node ce2-undo.mjs <name> <locale> "<text>" [rounds=3]  (FILE=<id>): edit a field, click the empty canvas, press Cmd+Z / Cmd+Shift+Z and measure
// (inside the UI iframe, same clock as node) how long the sandbox -> UI cacheUpdate message and the field take after the key press.
const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text, rounds = '3'] = ${a};
await d.msg(name); await d.sleep(800);
await d.ui(\`(()=>{window.__t={msgs:[],field:[]};window.addEventListener('message',e=>{const m=e.data?.pluginMessage;if(m?.type==='cacheUpdate')window.__t.msgs.push(Date.now())});return 1})()\`);
const hook = async () => d.ui('(()=>{const f='+F(name,loc)+';if(window.__obs)window.__obs.disconnect();window.__obs=new MutationObserver(()=>window.__t.field.push([Date.now(),f.innerText])); window.__obs.observe(f,{subtree:true,childList:true,characterData:true});return 1})()');
await d.setText(name, loc, ''); await d.sleep(500);
await d.clickEl(F(name, loc)); await d.key('Meta+a'); await d.page.keyboard.type(text, {delay: 15}); await d.sleep(1500);
await d.page.mouse.click(832, 113); await d.sleep(800);
const stored = () => fig(\`(()=>{const r=figma.root.getPluginData('prt_ib__'+\${JSON.stringify(name)});return r?JSON.parse(r).messages.map(m=>m.locale+':'+m.variants.map(v=>v.pattern.map(p=>p.value??'').join('')).join('/')).join(','):null})()\`);
console.log('stored before', await stored());
for (const key of ['Meta+z','Meta+Shift+Z','Meta+z','Meta+Shift+Z'].slice(0, Number(rounds))) {
  await hook(); await d.ui('window.__t.msgs=[];window.__t.field=[];1');
  const t0 = Date.now(); await d.key(key);
  let storedAt, fieldAt;
  const before = await d.val(name, loc);
  for (let i = 0; i < 400; i++) { const s = await stored(); if (storedAt === undefined && s.includes(loc+':'+ (key==='Meta+z' ? '' : text)) ) storedAt = Date.now()-t0; if (storedAt!==undefined) break; await d.sleep(5); }
  await d.sleep(1500);
  const t = await d.ui('window.__t');
  console.log(key.padEnd(13), 'stored>=' + storedAt + 'ms', 'cacheUpdate msg +' + (t.msgs[0]-t0) + 'ms', 'field +' + (t.field[0]?t.field[0][0]-t0:'none') + 'ms', 'field text', JSON.stringify(await d.val(name, loc)), 'was', JSON.stringify(before));
}
`;
await import("./ce.mjs");
