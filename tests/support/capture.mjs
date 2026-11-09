import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("test-results/preview", { recursive: true });
const browser = await chromium.launch({ channel: "msedge" });
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://localhost:3000");
  await page.locator("article").first().waitFor();
  await page.screenshot({
    path: "test-results/preview/home-desktop.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000/products");
  await page.locator("article").first().waitFor();
  const productHref = await page
    .locator("article a")
    .first()
    .getAttribute("href");
  await page.screenshot({
    path: "test-results/preview/catalog-desktop.png",
    fullPage: true,
  });
  await page.goto(`http://localhost:3000${productHref}`);
  await page.locator("dl").waitFor();
  await page.screenshot({
    path: "test-results/preview/details-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.screenshot({
    path: "test-results/preview/details-mobile.png",
    fullPage: true,
  });
  await page.goto("http://localhost:3000");
  await page.locator("article").first().waitFor();
  await page.screenshot({
    path: "test-results/preview/home-mobile.png",
    fullPage: true,
  });
  console.log("Saved desktop and mobile screenshots in test-results/preview.");
} finally {
  await browser.close();
}
