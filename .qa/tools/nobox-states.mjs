// usage: node nobox-states.mjs <theme tag> ; states of the price message: hover header, hover new-variant, focused match, selector menu
import { ctx, DEEP } from "./qa-lib.mjs";
import {execSync} from "node:child_process";
const tag=process.argv[2]; const f=process.env.FILE||"4Xgyn";
const shot=(n)=>execSync(`node cdp.mjs uishot ../shots/nobox-${n}-${tag}.png ${f}`);
const d = await ctx(f);
const vis=(sel,i=0,minY=80)=>`(()=>{const deep=${DEEP};const l=deep(document,${JSON.stringify(sel)}).filter(e=>e.getBoundingClientRect().height>10&&e.getBoundingClientRect().y>${minY});return l[${i}]})()`;
const pos=async(expr)=>{const p=await d.ui(`(()=>{const e=(${expr});const r=e.getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`);return p};
const hover=async(expr)=>{const p=await pos(expr);const o=await d.fo();await d.page.mouse.move(o.x+p[0],o.y+p[1]);await d.sleep(400)};
try{
 await hover(vis('.message-group-header-name'));
 shot('hdr-hover');
 await hover(vis('.new-variant'));
 shot('newvariant-hover');
 await hover(vis('.selector'));
 shot('selector-hover');
 await d.clickEl(vis('sl-input.match',0));
 await d.sleep(300);
 shot('match-focus');
 await d.key('Escape');
 await d.clickEl(vis('.inlang-pattern-editor-contenteditable',0,130));
 await d.sleep(300);
 shot('field-focus');
 await d.clickEl(vis('.selector'));
 await d.sleep(500);
 shot('selector-menu');
 await d.key('Escape');
}finally{await d.close()}
