/**
 * Capture README preview screenshots.
 *
 * Prerequisites:
 *   npm run dev:stack          (Solr + Next.js on :3000)
 *   npx playwright install chromium   (once)
 *
 * Usage:
 *   npm run screenshots
 *   APP_URL=http://localhost:3000 npm run screenshots
 */

import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const APP_URL = process.env.APP_URL ?? "http://localhost:3000";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, "..", "docs", "screenshots");

async function assertAppReachable(page) {
  try {
    const res = await page.goto(APP_URL, {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });
    if (!res?.ok()) {
      throw new Error(`HTTP ${res?.status() ?? "unknown"}`);
    }
  } catch (err) {
    console.error(
      `\nCould not reach ${APP_URL}. Start the stack first:\n  npm run dev:stack\n`
    );
    throw err;
  }
}

async function waitForCores(page) {
  const coreTrigger = page.getByRole("combobox").nth(1);
  await coreTrigger.waitFor({ state: "visible", timeout: 60_000 });
  for (let i = 0; i < 60; i++) {
    if (!(await coreTrigger.isDisabled())) break;
    await page.waitForTimeout(1000);
  }
  if (await coreTrigger.isDisabled()) {
    throw new Error(
      "Core switcher stayed disabled — is Solr running on :8983?"
    );
  }
}

async function selectCore(page, name) {
  const coreTrigger = page.getByRole("combobox").nth(1);
  await coreTrigger.click();
  await page.getByRole("option", { name, exact: true }).click();
  await page.getByRole("heading", { name: new RegExp(`Search\\s+${name}`, "i") }).waitFor({
    timeout: 15_000,
  });
}

async function clickPlayTab(page) {
  await page.getByRole("tab", { name: "Play" }).click();
}

async function clickAnalyzeTab(page) {
  await page.getByRole("tab", { name: "Analyze" }).click();
}

async function captureBuilderScreenshot(page) {
  await clickPlayTab(page);
  await page.getByRole("tab", { name: "Query builder" }).click();

  await page.locator("#builder-search").fill("Par");
  await page.getByRole("button", { name: "city", exact: true }).click();

  const fieldCard = page.locator("li").filter({ hasText: "city" }).first();
  await fieldCard.getByRole("button", { name: "Add matcher" }).click();

  const matchSelects = fieldCard.getByRole("combobox");
  await matchSelects.nth(1).click();
  await page.getByRole("option", { name: "Fuzzy" }).click();

  await page
    .getByRole("button", { name: "Run" })
    .last()
    .click();
  await page.getByText(/\d+\s+hits/).waitFor({ timeout: 30_000 });

  const section = page.locator("section").filter({ hasText: "Search customers" });
  await section.screenshot({
    path: path.join(OUT_DIR, "play-query-builder.png"),
  });
}

async function captureClassicScreenshot(page) {
  await clickPlayTab(page);
  await page.getByRole("tab", { name: "Classic syntax" }).click();
  await page.locator("#classic-q").fill("(city:Par OR city:Par~2)");

  const section = page.locator("section").filter({ hasText: "Search customers" });
  await section.screenshot({
    path: path.join(OUT_DIR, "play-classic.png"),
  });
}

async function captureAnalyzeScreenshot(page) {
  await clickAnalyzeTab(page);
  await page.getByRole("columnheader", { name: "Name" }).waitFor({
    timeout: 30_000,
  });
  await page.waitForTimeout(500);

  const panel = page.locator("div.max-w-6xl").first();
  await panel.screenshot({
    path: path.join(OUT_DIR, "analyze-schema.png"),
  });
}

async function captureHeaderScreenshot(page) {
  await clickPlayTab(page);
  const header = page.locator("header").first();
  await header.screenshot({
    path: path.join(OUT_DIR, "header-connection.png"),
  });
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  const page = await context.newPage();

  await assertAppReachable(page);
  await waitForCores(page);
  await selectCore(page, "customers");

  await captureHeaderScreenshot(page);
  await captureBuilderScreenshot(page);
  await captureClassicScreenshot(page);
  await captureAnalyzeScreenshot(page);

  await browser.close();

  console.log(`Wrote screenshots to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
