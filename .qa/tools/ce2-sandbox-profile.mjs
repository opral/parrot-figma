// node ce2-sandbox-profile.mjs <name> <locale> "<text>": CPU profile of the FIGMA PAGE (plugin sandbox runs there) around one Cmd+Z
const a = JSON.stringify(process.argv.slice(2));
process.argv[2] = `
const [name, loc, text] = ${a};
await d.msg(name); await d.sleep(800);
await d.setText(name, loc, ''); await d.sleep(500);
await d.clickEl(F(name, loc)); await d.key('Meta+a'); await d.page.keyboard.type(text, {delay: 15}); await d.sleep(1500);
await d.page.mouse.click(832, 113); await d.sleep(800);
const s = await d.page.context().newCDPSession(d.page);
await s.send('Profiler.enable'); await s.send('Profiler.setSamplingInterval', {interval: 300}); await s.send('Profiler.start');
await d.key('Meta+z'); await d.sleep(1000);
const { profile: p } = await s.send('Profiler.stop');
const byId = new Map(p.nodes.map(n=>[n.id,n])); const parent = new Map(); p.nodes.forEach(n=>(n.children||[]).forEach(c=>parent.set(c,n.id)));
const self = new Map(); const total = new Map();
p.samples.forEach((id,i)=>{ const dt=p.timeDeltas[i]/1000; const n=byId.get(id); const k=n.callFrame.functionName+' '+n.callFrame.url.split('/').slice(-1)[0].slice(0,40)+':'+n.callFrame.lineNumber; self.set(k,(self.get(k)||0)+dt);
  const seen=new Set(); let c=id; while(c){ const nn=byId.get(c); const kk=nn.callFrame.functionName+' '+nn.callFrame.url.split('/').slice(-1)[0].slice(0,40)+':'+nn.callFrame.lineNumber; if(!seen.has(kk)){seen.add(kk); total.set(kk,(total.get(kk)||0)+dt);} c=parent.get(c);} });
const top = (m,n)=>[...m.entries()].filter(([k])=>!k.startsWith('(idle)')&&!k.startsWith('(root)')).sort((x,y)=>y[1]-x[1]).slice(0,n).map(([k,v])=>v.toFixed(1).padStart(7)+' ms  '+k).join('\\n');
console.log('SELF\\n'+top(self,14)+'\\nTOTAL\\n'+top(total,30));
`;
await import("./ce.mjs");
