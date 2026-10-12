// node feat-snap.mjs : prints text nodes + frame language of every top-level container on the current page (FILE=)
import { ctx } from "./qa-lib.mjs";
const d = await ctx(process.env.FILE || "ZXC9xq");
const r = await d.fig(`(()=>{const o=[];const walk=(n,top)=>{ if(n.type==='TEXT'){o.push(top+' | '+n.characters.replace(/\\n/g,'/')+' | mn='+(n.getPluginData('mn')?'y':'-')+' l='+n.getPluginData('l'));return;} if('children' in n) n.children.forEach(c=>walk(c, (n.type==='PAGE'||n.type==='SECTION')?n.name+'/'+c.name+'['+c.getPluginData('l')+']':top)); }; walk(figma.currentPage,'');return o.join('\\n')})()`);
console.log(r);
await d.close();
