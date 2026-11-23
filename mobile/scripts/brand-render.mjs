// Renders assets/brand/*.svg to the PNGs Expo expects. Uses Playwright's
// bundled Chromium: `node scripts/brand-render.mjs`.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PLAYWRIGHT_PATH ?? "playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const jobs = [
  ["icon.svg", "icon.png", 1024, false],
  ["adaptive-foreground.svg", "adaptive-icon.png", 1024, true],
  ["adaptive-background.svg", "adaptive-background.png", 1024, false],
  ["monochrome.svg", "monochrome-icon.png", 1024, true],
  ["splash-mark.svg", "splash-icon.png", 1024, true],
  ["icon.svg", "favicon.png", 256, false],
];
const browser = await chromium.launch();
for (const [src, dest, size, transparent] of jobs) {
  const svg = readFileSync(join(root, "assets/brand", src), "utf8");
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0;background:transparent">${svg.replace('width="1024" height="1024"', `width="${size}" height="${size}"`)}</body>`);
  await page.screenshot({ path: join(root, "assets", dest), omitBackground: transparent });
  await page.close();
}
await browser.close();
console.log("rendered", jobs.length, "images");
