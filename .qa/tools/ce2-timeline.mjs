const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text] = ${a};
await d.msg(name); await d.sleep(800);
await d.setText(name, loc, ''); await d.sleep(500);
await d.clickEl(F(name, loc)); await d.key('Meta+a'); await d.page.keyboard.type(text, {delay: 15}); await d.sleep(1500);
await d.page.mouse.click(832, 113); await d.sleep(800);
await d.ui(\`(()=>{window.__tl=[];window.__tt=[];window.addEventListener('message',e=>{const m=e.data?.pluginMessage;window.__tl.push([Date.now(),'msg '+(m?.type||'')+' '+(m?.name||m?.target||'')])},true);
 const g=\${G(name)}; const f=\${F(name,loc)}; new MutationObserver(()=>window.__tl.push([Date.now(),'field '+JSON.stringify(f.innerText)])).observe(f,{subtree:true,childList:true,characterData:true});
 new MutationObserver(()=>window.__tl.push([Date.now(),'group dom'])).observe(g,{subtree:true,childList:true,characterData:true,attributes:true}); return 1})()\`);
const t0 = Date.now(); await d.key('Meta+z'); await d.sleep(1500);
const tl = await d.ui('window.__tl'); const tt = await d.ui('window.__tt');
console.log('key press returned at +' + (Date.now()-t0));
for (const [t, s] of tl) console.log('+' + (t - t0), s);
for (const [s, t] of tt) console.log('+' + (t - t0), s);
`;
await import("./ce.mjs");
