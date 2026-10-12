const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text] = ${a};
await d.msg(name); await d.sleep(800);
await d.setText(name, loc, 'Eins'); await d.sleep(1000);
await d.setText(name, loc, text); await d.sleep(1500);
await fig(\`(()=>{window.__dbg=[];const t0=Date.now();window.__h=(e)=>window.__dbg.push([Date.now()-t0,'rev='+figma.root.getPluginData('prt_ib_rev'),e.documentChanges.map(c=>c.type+':'+c.origin).join(',')]);figma.on('documentchange',window.__h);window.__t0=t0;return 1})()\`);
console.log('rev before', await fig("figma.root.getPluginData('prt_ib_rev')"));
await d.page.mouse.click(832, 113); await d.sleep(800);
await d.key('Meta+z'); await d.sleep(1500);
console.log(await fig("JSON.stringify(window.__dbg)"));
console.log('rev after', await fig("figma.root.getPluginData('prt_ib_rev')"), await d.val(name, loc));
await fig("figma.off('documentchange',window.__h)");
`;
await import("./ce.mjs");
