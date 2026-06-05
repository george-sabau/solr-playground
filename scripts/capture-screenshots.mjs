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

const COMPARE_TEMPLATE_A = "customers from paris search";
const COMPARE_TEMPLATE_B = "customers from paris search2";
const COMPARE_SEARCH = "Pari design";
const COMPARE_ENDPOINT_ID = "default-local";
const COMPARE_CORE = "customers";

function compareMatcher(mode, boost = 1) {
  return {
    id: "",
    mode,
    boost,
    fuzzyDistance: 2,
    required: false,
    prohibited: false,
  };
}

function compareTemplatePayloadA() {
  return {
    version: 1,
    parser: "lucene",
    builder: {
      searchText: "",
      combineWith: "OR",
      edismax: { mm: "", min: "", tie: "", qfOverride: "" },
      filterQueries: [],
      boostQueries: [],
      fields: [
        {
          id: "",
          field: "city",
          matchers: [compareMatcher("fuzzy"), compareMatcher("fuzzy")],
        },
        {
          id: "",
          field: "country",
          matchers: [compareMatcher("term"), compareMatcher("wildcard")],
        },
        {
          id: "",
          field: "state",
          matchers: [compareMatcher("wildcard"), compareMatcher("term")],
        },
      ],
    },
  };
}

function compareTemplatePayloadB() {
  return {
    version: 1,
    parser: "lucene",
    builder: {
      searchText: "",
      combineWith: "OR",
      edismax: { mm: "", min: "", tie: "", qfOverride: "" },
      filterQueries: [],
      boostQueries: [],
      fields: [
        {
          id: "",
          field: "city",
          matchers: [compareMatcher("fuzzy"), compareMatcher("fuzzy", 10)],
        },
        {
          id: "",
          field: "country",
          matchers: [compareMatcher("term"), compareMatcher("wildcard")],
        },
        {
          id: "",
          field: "state",
          matchers: [compareMatcher("wildcard"), compareMatcher("term")],
        },
        {
          id: "",
          field: "interests",
          matchers: [compareMatcher("term"), compareMatcher("wildcard")],
        },
      ],
    },
  };
}

async function ensureCompareTemplates(request) {
  const listRes = await request.get(
    `${APP_URL}/api/presets/templates?endpointId=${COMPARE_ENDPOINT_ID}&core=${COMPARE_CORE}`
  );
  if (!listRes.ok()) {
    console.warn("Could not list templates — compare capture may fail");
    return;
  }
  const list = await listRes.json();
  const names = new Set(list.map((t) => t.name));

  const seeds = [
    [COMPARE_TEMPLATE_A, compareTemplatePayloadA()],
    [COMPARE_TEMPLATE_B, compareTemplatePayloadB()],
  ];

  for (const [name, payload] of seeds) {
    if (names.has(name)) continue;
    const res = await request.post(`${APP_URL}/api/presets/templates`, {
      data: {
        endpointId: COMPARE_ENDPOINT_ID,
        core: COMPARE_CORE,
        name,
        parser: "lucene",
        payload,
      },
    });
    if (!res.ok()) {
      console.warn(`Failed to seed template "${name}" (${res.status()})`);
    }
  }
}

async function loadCompareTemplate(page, columnTitle, templateName) {
  const column = page
    .locator("div.flex-1.flex-col.rounded-lg.border")
    .filter({
      has: page.getByRole("heading", { name: columnTitle, exact: true, level: 3 }),
    });

  const details = column.locator("details").first();
  if (!(await details.evaluate((el) => el.open))) {
    await details.locator("summary").click();
  }

  await column.getByRole("button", { name: "From query template" }).click();
  await page
    .getByText("Loading templates…")
    .waitFor({ state: "hidden", timeout: 15_000 })
    .catch(() => {});
  await column.getByRole("combobox").click();
  await page.getByRole("option", { name: templateName, exact: true }).click();
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

async function runCompareScenario(page) {
  await clickCompareTab(page);
  await ensureCompareTemplates(page.request);

  await loadCompareTemplate(page, "Source A", COMPARE_TEMPLATE_A);
  await loadCompareTemplate(page, "Source B", COMPARE_TEMPLATE_B);

  await page.locator("#compare-search").fill(COMPARE_SEARCH);
  await page.getByRole("button", { name: "Compare queries" }).click();
  await page.getByRole("heading", { name: "Comparison summary" }).waitFor({
    timeout: 30_000,
  });
  await page.getByText(/\d+\s+hits/).first().waitFor({ timeout: 30_000 });

  const aiDetails = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: "AI summary" }) })
    .first();
  if (!(await aiDetails.evaluate((el) => el.open))) {
    await aiDetails.locator("summary").click();
  }
  await page
    .getByRole("button", { name: "Evaluate relevance (AI)" })
    .waitFor({ state: "visible", timeout: 15_000 });

  await page.waitForTimeout(500);
}

async function captureCompareScreenshot(page) {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await runCompareScenario(page);

  const section = page.locator("section").filter({ hasText: "Compare" }).first();
  await section.screenshot({
    path: path.join(OUT_DIR, "compare-overview.png"),
  });
}

async function captureCompareAiScreenshot(page) {
  await runCompareScenario(page);

  const evaluateRes = await page.request.get(`${APP_URL}/api/compare/evaluate`);
  const { available } = await evaluateRes.json();
  if (!available) {
    console.warn(
      "Skipping compare-ai-summary.png — set GEMINI_API_KEY in .env.local and restart dev:stack"
    );
    return;
  }

  const aiBtn = page.getByRole("button", { name: "Evaluate relevance (AI)" });
  for (let i = 0; i < 120; i++) {
    if (!(await aiBtn.isDisabled())) break;
    await page.waitForTimeout(500);
  }
  if (await aiBtn.isDisabled()) {
    console.warn(
      "Skipping compare-ai-summary.png — AI button stayed disabled (need hits on both sides)"
    );
    return;
  }

  await aiBtn.click();
  try {
    await page.getByText("AI verdict:").waitFor({ timeout: 90_000 });
  } catch {
    console.warn(
      "Skipping compare-ai-summary.png — AI evaluation timed out (Gemini slow or unavailable)"
    );
    return;
  }
  await page.waitForTimeout(500);

  const aiPanel = page
    .locator("details")
    .filter({ has: page.getByRole("heading", { name: "AI summary" }) })
    .first();
  await aiPanel.screenshot({
    path: path.join(OUT_DIR, "compare-ai-summary.png"),
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
  await captureCompareAiScreenshot(page);
  await captureAnalyzeScreenshot(page);

  await browser.close();

  console.log(`Wrote screenshots to ${OUT_DIR}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
