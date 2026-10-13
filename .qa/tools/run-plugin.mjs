// Opens Parrot (development) (env PARROT_PLUGIN_NAME / PARROT_UI_ORIGIN for a released build) in the Figma file via Quick Actions. Usage: node run-plugin.mjs [fileMatch]
import { chromium } from "playwright-core";
import { assertNotProtected, guardInput, uiOrigin, pluginName } from "./ui-target.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const pages = browser.contexts().flatMap((c) => c.pages());
const p = pages.find((x) => x.url().includes(process.argv[2] ?? process.env.FILE ?? "4Xgyn0xmwQsJLHyUaRfpX0"));
assertNotProtected(p.url());
guardInput(p); // QA_FRONT=<file id>: front-tab check before every input
// no bringToFront(): the owner may be looking at another tab. Playwright emulates focus per page, so keyboard / mouse input still reaches this (background) tab.
await p.mouse.click(1000, 900); // focus canvas (empty area)
await p.keyboard.press("Escape");
await p.keyboard.press("Meta+/");
await p.waitForTimeout(600);
await p.keyboard.type(pluginName(), { delay: 20 });
await p.waitForTimeout(1200);
await p.keyboard.press("Enter");
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(500);
  if (p.frames().some((f) => f.url().startsWith(uiOrigin()))) { console.log("Parrot UI loaded"); break; }
  if (i === 39) console.log("Parrot UI frame not detected; frames:", p.frames().map((f) => f.url().slice(0, 80)));
}
await browser.close();
