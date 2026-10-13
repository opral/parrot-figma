// Brings the Figma tab of a file to the front and verifies it (QA_FRONT=<file id>, default 4Xgyn0xmwQsJLHyUaRfpX0). Usage: node front.mjs
import { chromium } from "playwright-core";
import { ensureFront } from "./ui-target.mjs";
process.env.QA_FRONT ??= "4Xgyn0xmwQsJLHyUaRfpX0";
const browser = await chromium.connectOverCDP("http://localhost:9222");
const page = browser.contexts().flatMap((c) => c.pages()).find((p) => p.url().includes(process.env.QA_FRONT));
if (!page) throw new Error("no page for " + process.env.QA_FRONT);
await ensureFront(page);
console.log("front OK:", page.url().slice(0, 80));
await browser.close();
