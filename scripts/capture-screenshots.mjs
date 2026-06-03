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

async function clickCompareTab(page) {
  await page.getByRole("tab", { name: "Compare" }).click();
  await page.getByRole("heading", { name: /Compare/i }).waitFor({
    timeout: 15_000,
  });
}

async function clickAnalyzeTab(page) {
  await page.getByRole("tab", { name: "Analyze" }).click();
}

async function clickQueryBuilderTab(page) {
  await page.getByRole("tab", { name: "Query builder" }).click();
}

async function setupBuilderSearch(page) {
  await clickPlayTab(page);
  await clickQueryBuilderTab(page);

  await page.locator("#builder-search").fill("Par");

  const cityChip = page.getByRole("button", { name: "city", exact: true });
  if ((await cityChip.getAttribute("aria-pressed")) !== "true") {
    await cityChip.click();
  }

  const fieldCard = page
    .locator("li")
    .filter({ has: page.locator("summary span.font-mono", { hasText: "city" }) })
    .first();
  await fieldCard.waitFor({ state: "visible", timeout: 15_000 });

  const fieldDetails = fieldCard.locator("details").first();
  if (!(await fieldDetails.evaluate((el) => el.open))) {
    await fieldDetails.locator("summary").click();
  }

  const matchSelect = fieldCard.getByRole("combobox").first();
  await matchSelect.click();
  await page.getByRole("option", { name: "Fuzzy" }).click();

  if (!(await page.getByText(/\d+\s+hits/).isVisible().catch(() => false))) {
    await page.getByRole("button", { name: "Run" }).last().click();
    await page.getByText(/\d+\s+hits/).waitFor({ timeout: 30_000 });
  }
}

async function loadCompareSource(page, columnTitle, url) {
  const column = page
    .locator("div.flex-1.flex-col.rounded-lg.border")
    .filter({
      has: page.getByRole("heading", { name: columnTitle, exact: true, level: 3 }),
    });

  const details = column.locator("details").first();
  if (!(await details.evaluate((el) => el.open))) {
    await details.locator("summary").click();
  }

  await column.getByRole("button", { name: "From Solr URL" }).click();
  await column.locator('input[placeholder*="select?q"]').fill(url);
  await column.getByRole("button", { name: "Load" }).click();
  await column.getByText(/Loaded:/).waitFor({ timeout: 15_000 });
}

async function captureBuilderScreenshot(page) {
  await setupBuilderSearch(page);

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

async function captureCompareScreenshot(page) {
  await clickCompareTab(page);

  await loadCompareSource(
    page,
    "Source A",
    "http://localhost:8983/solr/customers/select?q=city:Par&wt=json"
  );
  await loadCompareSource(
    page,
    "Source B",
    "http://localhost:8983/solr/customers/select?q=first_name:Par&wt=json"
  );

  await page.locator("#compare-search").fill("Par");
  await page.getByRole("button", { name: "Compare queries" }).click();
  await page.getByText("Source A vs Source B").waitFor({ timeout: 30_000 });
  await page.getByText(/\d+\s+hits/).first().waitFor({ timeout: 30_000 });
  await page.waitForTimeout(500);

  const section = page.locator("section").filter({ hasText: "Compare" }).first();
  await section.screenshot({
    path: path.join(OUT_DIR, "compare-overview.png"),
  });
}

async function captureResultsExpandedScreenshot(page) {
  const firstHit = page.locator("article").first();
  await firstHit.getByRole("button").first().click();
  await page.getByText("indexed", { exact: true }).first().waitFor({
    timeout: 30_000,
  });
  await page.waitForTimeout(500);

  const section = page.locator("section").filter({ hasText: "Search customers" });
  await section.screenshot({
    path: path.join(OUT_DIR, "play-results-expanded.png"),
  });
}

async function captureLoadFromSourceScreenshot(page) {
  await clickPlayTab(page);
  await clickQueryBuilderTab(page);

  const details = page.locator("details").filter({ hasText: "Load from source" }).first();
  if (!(await details.evaluate((el) => el.open))) {
    await details.locator("summary").click();
  }
  await details.getByRole("button", { name: "From query template" }).click();
  await page.waitForTimeout(300);

  await details.screenshot({
    path: path.join(OUT_DIR, "load-from-source.png"),
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
  await captureLoadFromSourceScreenshot(page);
  await captureBuilderScreenshot(page);
  await captureResultsExpandedScreenshot(page);
  await captureClassicScreenshot(page);
  await captureCompareScreenshot(page);
  await captureAnalyzeScreenshot(page);

  await browser.close();

  console.log(`Wrote screenshots to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
