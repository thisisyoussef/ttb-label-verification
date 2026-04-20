import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium, type Locator, type Page } from 'playwright';
import type { DemoConfig } from './recordAssistantDemoConfig';

function detectLatest<T extends { name: string; mtimeMs: number }>(files: T[]) {
  let latest = files[0];
  for (const file of files) {
    if (file.mtimeMs > latest.mtimeMs) {
      latest = file;
    }
  }
  return latest.name;
}

function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function clickIfVisible(locator: Locator) {
  const isVisible = await locator.isVisible().catch(() => false);
  if (!isVisible) return false;
  await locator.click({ timeout: 7000 }).catch(() => undefined);
  return true;
}

async function waitForAppReady(page: Page) {
  await page.waitForLoadState('networkidle');
  await page.waitForFunction(() => document.readyState === 'complete');
  await page.waitForFunction(async () => {
    const fonts = document.fonts;
    if (!fonts?.ready) return true;
    await fonts.ready;
    return true;
  });
}

async function openToolbench(page: Page, waits: DemoConfig['waits'], tabName = 'Samples') {
  await page
    .getByRole('button', { name: /toolbench/i })
    .click({ timeout: 8000 })
    .catch(() => undefined);
  await page.getByText('Assessor Toolbench').waitFor({ timeout: 14000 });
  await sleep(waits.short);
  const tab = page.getByRole('tab', {
    name: new RegExp(tabName, 'i')
  });
  if (await tab.isVisible().catch(() => false)) {
    await tab.click().catch(() => undefined);
  }
}

async function closeToolbench(page: Page, waits: DemoConfig['waits']) {
  const closeButton = page.getByRole('button', {
    name: /close toolbench/i
  });
  if (await clickIfVisible(closeButton)) {
    await sleep(waits.short);
    return;
  }
  await page.keyboard.press('Escape').catch(() => undefined);
  await sleep(waits.short);
}

async function setExtractionMode(page: Page, waits: DemoConfig['waits'], useCloud = true) {
  await openToolbench(page, waits, 'Actions');
  await sleep(waits.medium);

  const useModeButton = page.getByRole('button', {
    name: useCloud ? /use cloud extraction/i : /use local extraction/i
  });
  if (await useModeButton.isVisible().catch(() => false)) {
    await useModeButton.click({ timeout: 7000 }).catch(() => undefined);
    await sleep(waits.step);
  }

  await sleep(waits.long);
  await closeToolbench(page, waits);
}

async function loadSpecificLabel(page: Page, labelRegex: RegExp) {
  const button = page.locator('button', {
    hasText: labelRegex
  }).first();
  await button.waitFor({ state: 'visible', timeout: 22000 });
  await button.click({ timeout: 8000 }).catch(() => undefined);
}

type SingleReviewState =
  | 'results'
  | 'processing'
  | 'local-unavailable'
  | 'retry'
  | 'try-another'
  | 'continue-with-caution'
  | 'back-to-intake'
  | 'back-to-batch'
  | 'other';

async function detectSingleReviewState(page: Page): Promise<SingleReviewState> {
  const stateChecks: Array<[SingleReviewState, Locator]> = [
    ['results', page.getByRole('button', { name: /New Review/i })],
    ['local-unavailable', page.getByRole('button', { name: /Switch to Cloud/i })],
    ['retry', page.getByRole('button', { name: /Try again/i })],
    ['try-another', page.getByRole('button', { name: /Try another image/i })],
    [
      'continue-with-caution',
      page.getByRole('button', { name: /Continue with caution/i })
    ],
    ['back-to-intake', page.getByRole('button', { name: /Back to intake/i })],
    ['back-to-batch', page.getByRole('button', { name: /Back to batch review/i })]
  ];

  for (const [state, locator] of stateChecks) {
    if (await locator.isVisible().catch(() => false)) return state;
  }
  if (
    await page
      .getByRole('heading', { name: /Reviewing this label/i })
      .isVisible()
      .catch(() => false)
  ) {
    return 'processing';
  }
  return 'other';
}

async function waitForSingleResult(page: Page, timeoutMs = 220000) {
  const started = Date.now();
  while (true) {
    const state = await detectSingleReviewState(page);
    if (state !== 'processing' && state !== 'other') {
      return state;
    }
    if (Date.now() - started > timeoutMs) {
      throw new Error('Timed out waiting for single-review result state.');
    }
    await sleep(700);
  }
}

async function resolveSingleReviewTerminal(
  page: Page,
  waits: DemoConfig['waits']
) {
  let state = await waitForSingleResult(page);

  for (let attempt = 0; attempt < 12; attempt += 1) {
    if (state === 'results') return;

    if (state === 'local-unavailable') {
      if (
        await clickIfVisible(page.getByRole('button', { name: /Switch to Cloud/i }))
      ) {
        await sleep(waits.retry);
      } else {
        await setExtractionMode(page, waits, true);
      }
    } else if (state === 'retry') {
      await clickIfVisible(page.getByRole('button', { name: /Try again/i }));
      await sleep(waits.retry);
    } else if (state === 'continue-with-caution') {
      await clickIfVisible(
        page.getByRole('button', { name: /Continue with caution/i })
      );
      await sleep(waits.long);
    } else if (state === 'try-another') {
      await clickIfVisible(page.getByRole('button', { name: /Try another image/i }));
      await sleep(waits.long);
    } else if (state === 'back-to-intake') {
      await clickIfVisible(page.getByRole('button', { name: /Back to intake/i }));
      await sleep(waits.long);
    } else if (state === 'back-to-batch') {
      await clickIfVisible(
        page.getByRole('button', { name: /Back to batch review/i })
      );
      await sleep(waits.long);
    }

    state = await waitForSingleResult(page);
  }

  throw new Error('Could not settle single-review terminal state.');
}

async function openFirstEvidenceRows(page: Page, count = 5) {
  const buttons = page.getByRole('button', { name: /Show evidence/i });
  const found = await buttons.count();
  const targetCount = Math.min(count, found);

  for (let i = 0; i < targetCount; i += 1) {
    await buttons.nth(i).scrollIntoViewIfNeeded();
    await buttons.nth(i).click();
    await sleep(900);
  }
}

async function closeEvidenceRows(page: Page) {
  const hideButtons = page.getByRole('button', { name: /Hide evidence/i });
  const count = await hideButtons.count();

  for (let i = 0; i < count; i += 1) {
    await hideButtons.nth(i).scrollIntoViewIfNeeded();
    await hideButtons.nth(i).click();
    await sleep(500);
  }
}

async function returnToSingleStart(page: Page, waits: DemoConfig['waits']) {
  if (await clickIfVisible(page.getByRole('button', { name: /New Review/i }))) {
    await sleep(waits.short);
    return;
  }

  if (
    await clickIfVisible(page.getByRole('button', { name: /Start a new check/i }))
  ) {
    await sleep(waits.short);
    return;
  }

  await clickIfVisible(page.getByRole('button', { name: /Back to Single Review/i }));
  if (
    await page
      .getByRole('button', { name: /Back to intake/i })
      .isVisible()
      .catch(() => false)
  ) {
    await clickIfVisible(page.getByRole('button', { name: /Back to intake/i }));
  }
}

async function waitForBatchTerminal(page: Page) {
  await page.getByText('Batch review complete').waitFor({ timeout: 220000 });
}

async function openDashboard(page: Page) {
  const openDashboardButton = page.getByRole('button', {
    name: /Open Dashboard/i
  });
  await openDashboardButton.waitFor({ state: 'visible', timeout: 80000 });
  await openDashboardButton.click();
  await page.getByRole('heading', { name: 'Batch Results' }).waitFor({
    timeout: 120000
  });
}

export async function runRecordedDemo(config: DemoConfig, rawDir: string) {
  await fs.mkdir(rawDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    recordVideo: {
      dir: rawDir,
      size: { width: 1920, height: 1080 }
    }
  });
  const page = await context.newPage();

  try {
    await page.goto(config.baseUrl);
    await waitForAppReady(page);
    await sleep(config.waits.boot);

    await page
      .getByRole('button', { name: /Sign in with your Treasury username/i })
      .click();
    await page.getByPlaceholder('Any value (mock auth)').fill('DemoUser');
    await sleep(config.waits.short);
    await page.getByRole('button', { name: /^Continue$/i }).click();
    await page.getByText('TTB Label Verification Assistant').waitFor({ timeout: 30000 });
    await waitForAppReady(page);
    await sleep(config.waits.long);

    await setExtractionMode(page, config.waits, true);
    await openToolbench(page, config.waits, 'Samples');
    await sleep(config.waits.long);
    await loadSpecificLabel(page, /Simply Elegant/i);
    await sleep(config.waits.medium);
    await closeToolbench(page, config.waits);
    await sleep(config.waits.long);

    await page.getByRole('button', { name: 'Verify Label' }).click();
    await page.getByRole('heading', { name: 'Reviewing this label' }).waitFor({ timeout: 100000 });
    await sleep(config.waits.long);
    await resolveSingleReviewTerminal(page, config.waits);
    await sleep(config.waits.veryLong);

    await openFirstEvidenceRows(page, 5);
    await sleep(config.waits.long);
    await closeEvidenceRows(page);
    await sleep(config.waits.medium);
    await clickIfVisible(page.getByRole('button', { name: /Export Results/i }).first());
    await sleep(config.waits.long);
    await returnToSingleStart(page, config.waits);
    await sleep(config.waits.long);

    await openToolbench(page, config.waits, 'Upload');
    await sleep(config.waits.long);
    await clickIfVisible(
      page.getByRole('button', { name: /Load .*Warning Text Errors/i }).first()
    );
    await sleep(config.waits.medium);
    await closeToolbench(page, config.waits);
    await sleep(config.waits.long);

    await page.getByRole('button', { name: 'Verify Label' }).click();
    await page.getByRole('heading', { name: 'Reviewing this label' }).waitFor({ timeout: 100000 });
    await sleep(config.waits.long);
    await resolveSingleReviewTerminal(page, config.waits);
    await sleep(config.waits.long);
    await openFirstEvidenceRows(page, 6);
    await sleep(config.waits.long);
    await closeEvidenceRows(page);
    await sleep(config.waits.medium);
    await returnToSingleStart(page, config.waits);
    await sleep(config.waits.long);

    await page.getByRole('tab', { name: /Batch/i }).click();
    await waitForAppReady(page);
    await page.getByRole('heading', { name: /Batch Upload/i }).waitFor({ timeout: 30000 });
    await sleep(config.waits.long);

    await openToolbench(page, config.waits, 'Samples');
    await sleep(config.waits.medium);
    await clickIfVisible(page.getByRole('button', { name: /Load test batch/i }));
    await sleep(config.waits.medium);
    await closeToolbench(page, config.waits);
    await sleep(config.waits.long);
    await page.getByRole('heading', { name: /Matching review/i }).scrollIntoViewIfNeeded().catch(() => undefined);
    await sleep(config.waits.long);
    await page.getByLabel('Batch summary').scrollIntoViewIfNeeded().catch(() => undefined);
    await sleep(config.waits.medium);
    await page.getByRole('button', { name: /Start Batch Review/i }).click({ timeout: 12000 });
    await sleep(config.waits.long);
    await waitForBatchTerminal(page);
    await sleep(config.waits.long);

    await openDashboard(page);
    await sleep(config.waits.long);
    await page.locator('label', { hasText: 'Sort' }).locator('select').selectOption('filename');
    await sleep(config.waits.step);
    await clickIfVisible(page.getByRole('button', { name: /Needs review only/i }));
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /^Open$/i }).first());
    await page.getByRole('button', { name: /Back to Batch Results/i }).waitFor({ timeout: 30000 });
    await sleep(config.waits.long);
    await openFirstEvidenceRows(page, 4);
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /Next label/i }));
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /Previous label/i }));
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /Back to Batch Results/i }));
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /Export Results/i }).first());
    await sleep(config.waits.step);
    await clickIfVisible(page.getByRole('button', { name: /Confirm Export/i }));
    await sleep(config.waits.long);
    await clickIfVisible(page.getByRole('button', { name: /Start Another Batch/i }));
    await sleep(config.waits.long);
  } finally {
    await context.close();
    await browser.close();
  }

  const entries = await fs.readdir(rawDir, { withFileTypes: true });
  const videoFiles = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.webm'))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(rawDir, entry.name));
        return { name: entry.name, mtimeMs: stat.mtimeMs };
      })
  );
  if (videoFiles.length === 0) {
    throw new Error('No recorded video output found.');
  }

  return {
    rawVideoPath: path.join(rawDir, detectLatest(videoFiles))
  };
}
