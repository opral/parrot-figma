// node ce-typing.mjs <name> <locale> "<text>" [gapMs]: clear the field, type char by char with real keys, log mutations
process.argv[2] = `
const [name, loc, text, gap] = ${JSON.stringify(process.argv.slice(2))};
await d.setText(name, loc, ''); await d.sleep(1500);
await d.clickEl(F(name, loc));
await d.ui('(()=>{window.__log=[];const f='+F(name,loc)+';new MutationObserver(()=>window.__log.push([Math.round(performance.now()),f.innerText,getSelection().anchorOffset,document.activeElement===f])).observe(f,{subtree:true,childList:true,characterData:true});return 1})()');
for (const c of text) { await d.page.keyboard.type(c,{delay:0}); await d.sleep(Number(gap||40)); }
await d.sleep(1500);
const log = await d.ui('window.__log');
const bad = log.filter((e,i)=>i>0 && !(e[1].startsWith(log[i-1][1].slice(0,0))) );
console.log('final:', JSON.stringify(await d.val(name, loc)), 'expected:', JSON.stringify(text), 'focus:', await d.ui('document.activeElement.className'));
let regress = 0; for (let i=1;i<log.length;i++) if (log[i][1].length < log[i-1][1].length) regress++;
console.log('mutations', log.length, 'length regressions', regress);
`;
await import("./ce.mjs");
