// node ce2-profile.mjs <name> <locale> "<text>": CPU profile (UI iframe) of one Cmd+Z; prints the heaviest functions + timeline of long synchronous stretches
const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text] = ${a};
await d.msg(name); await d.sleep(800);
await d.setText(name, loc, ''); await d.sleep(500);
await d.clickEl(F(name, loc)); await d.key('Meta+a'); await d.page.keyboard.type(text, {delay: 15}); await d.sleep(1500);
await d.page.mouse.click(832, 113); await d.sleep(800);
await d.send('Profiler.enable'); await d.send('Profiler.setSamplingInterval', {interval: 200}); await d.send('Profiler.start');
const t0 = Date.now(); await d.key('Meta+z'); await d.sleep(1200);
const { result } = await d.send('Profiler.stop');
const p = result.profile; const byId = new Map(p.nodes.map(n=>[n.id,n])); const self = new Map();
p.samples.forEach((id,i)=>{ const dt=p.timeDeltas[i]/1000; const n=byId.get(id); const k=n.callFrame.functionName+' '+n.callFrame.url.split('/').slice(-2).join('/')+':'+n.callFrame.lineNumber; self.set(k,(self.get(k)||0)+dt)});
console.log([...self.entries()].sort((x,y)=>y[1]-x[1]).slice(0,25).map(([k,v])=>v.toFixed(1).padStart(7)+' ms  '+k).join('\\n'));
// busy timeline: ms since t0 of non-idle samples in 50ms buckets
let t=p.startTime/1000; const buckets={}; p.samples.forEach((id,i)=>{t+=p.timeDeltas[i]/1000; const n=byId.get(id); if(n.callFrame.functionName==='(idle)'||n.callFrame.functionName==='(program)') return; const b=Math.floor((t-p.startTime/1000)/50)*50; buckets[b]=(buckets[b]||0)+p.timeDeltas[i]/1000;});
console.log('busy ms per 50ms bucket since profile start:', JSON.stringify(Object.fromEntries(Object.entries(buckets).map(([k,v])=>[k,Math.round(v)]))));
`;
await import("./ce.mjs");
