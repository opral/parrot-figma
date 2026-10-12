import { ctx, DEEP, fieldExpr } from "./qa-lib.mjs"; import { state } from "./r4-lib.mjs";
const d=await ctx(process.env.FILE); const S=(l)=>state(d,l,"welcome.cta","1:7");
await d.fig("figma.currentPage.selection=[figma.getNodeById('1:2')]"); await d.sleep(800);
await S("start");
await d.clickEl(fieldExpr("welcome.cta",1)); await d.sleep(300); await d.key("Meta+a"); await d.type("Los geht's"); await d.sleep(1500); await S("typed");
await d.key("Meta+z"); await d.sleep(1800); await S("Cmd+Z in field");
await d.key("Meta+Shift+Z"); await d.sleep(1800); await S("Cmd+Shift+Z in field");
// focus in plugin but not in a field: click the tab bar blank area
await d.clickAt(300,12); await d.sleep(500); console.log("active:", await d.ui("document.activeElement.tagName+' '+(document.activeElement.className||'')"));
await d.key("Meta+z"); await d.sleep(1800); await S("Cmd+Z plugin non-field");
await d.key("Meta+z"); await d.sleep(1800); await S("Cmd+Z again");
await d.close();
