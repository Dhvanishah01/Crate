// Screenshots the deck idle and mid-play for comparison with /references.
// Usage: node scripts/shot.mjs [url] [outDir]
import { chromium } from "playwright";

const url = process.argv[2] ?? "http://localhost:3000";
const out = process.argv[3] ?? "screenshots";
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
for (const [name, viewport] of [["desktop", { width: 1440, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
  page.on("console", (m) => m.type() === "error" && console.log(`[${name}] console:`, m.text()));
  page.on("pageerror", (e) => console.log(`[${name}] pageerror:`, e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.screenshot({ path: `${out}/${name}-idle.png` });
  await page.getByRole("button", { name: "Power" }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${out}/${name}-playing.png` });
  if (name === "desktop") await page.locator(".deck").screenshot({ path: `${out}/deck-closeup.png` });
  await page.close();
}
await browser.close();
