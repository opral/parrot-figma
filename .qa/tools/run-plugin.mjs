// Opens Parrot (development) in the Figma file via Quick Actions. Usage: node run-plugin.mjs [fileMatch]
import { chromium } from "playwright-core";
import { assertNotProtected } from "./ui-target.mjs";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const pages = browser.contexts().flatMap((c) => c.pages());
const p = pages.find((x) => x.url().includes(process.argv[2] ?? process.env.FILE ?? "4Xgyn0xmwQsJLHyUaRfpX0"));
assertNotProtected(p.url());
// no bringToFront(): the owner may be looking at another tab. Playwright emulates focus per page, so keyboard / mouse input still reaches this (background) tab.
await p.mouse.click(1000, 900); // focus canvas (empty area)
await p.keyboard.press("Escape");
await p.keyboard.press("Meta+/");
await p.waitForTimeout(600);
await p.keyboard.type("Parrot (development)", { delay: 20 });
await p.waitForTimeout(1200);
await p.keyboard.press("Enter");
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(500);
  if (p.frames().some((f) => f.url().startsWith("http://localhost:5180"))) { console.log("Parrot UI loaded"); break; }
  if (i === 39) console.log("Parrot UI frame not detected; frames:", p.frames().map((f) => f.url().slice(0, 80)));
}
await browser.close();
