import { chromium, type Browser, type Page } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig, shotName, type VrtConfig, type Viewport } from './config.ts';

export interface ShotRecord {
  route: string;
  viewport: string;
  path: string;
  file: string;
}

const DISABLE_ANIMATIONS_CSS = `
  *, *::before, *::after {
    transition-duration: 0s !important;
    transition-delay: 0s !important;
    animation-duration: 0s !important;
    animation-delay: 0s !important;
    animation-iteration-count: 1 !important;
    caret-color: transparent !important;
    scroll-behavior: auto !important;
  }
`;

async function stabilize(page: Page, waitFor?: string): Promise<void> {
  if (waitFor) {
    await page.waitForSelector(waitFor, { state: 'visible', timeout: 15_000 });
  }
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
}

async function captureViewport(
  browser: Browser,
  config: VrtConfig,
  viewport: Viewport,
  labelDir: string,
): Promise<ShotRecord[]> {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    deviceScaleFactor: viewport.deviceScaleFactor ?? 1,
    isMobile: viewport.isMobile ?? false,
    hasTouch: viewport.isMobile ?? false,
    reducedMotion: 'reduce',
  });
  await context.addInitScript((css: string) => {
    const style = document.createElement('style');
    style.textContent = css;
    document.documentElement.appendChild(style);
  }, DISABLE_ANIMATIONS_CSS);

  const shots: ShotRecord[] = [];
  const page = await context.newPage();

  for (const route of config.routes) {
    const url = `${config.baseUrl}${route.path}`;
    const stem = shotName(route, viewport);
    const file = join(labelDir, `${stem}.png`);
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await stabilize(page, route.waitFor);
      const maskSelectors = [...config.mask, ...(route.mask ?? [])];
      await page.screenshot({
        path: file,
        fullPage: true,
        animations: 'disabled',
        caret: 'hide',
        mask: maskSelectors.map((sel) => page.locator(sel)),
      });
      shots.push({ route: route.name, viewport: viewport.name, path: route.path, file });
      console.log(`  captured ${stem}`);
    } catch (err) {
      console.error(`  FAILED ${stem}: ${(err as Error).message}`);
      throw err;
    }
  }

  await context.close();
  return shots;
}

export async function capture(label: string, configPath?: string): Promise<ShotRecord[]> {
  const config = await loadConfig(configPath);
  const labelDir = resolve(process.cwd(), config.outDir, label);
  await mkdir(labelDir, { recursive: true });

  console.log(`Capturing "${label}" from ${config.baseUrl} → ${config.outDir}/${label}`);
  const browser = await chromium.launch();
  try {
    const all: ShotRecord[] = [];
    for (const viewport of config.viewports) {
      console.log(`viewport ${viewport.name} (${viewport.width}x${viewport.height})`);
      all.push(...(await captureViewport(browser, config, viewport, labelDir)));
    }
    await writeFile(join(labelDir, 'manifest.json'), JSON.stringify(all, null, 2));
    console.log(`Done: ${all.length} screenshots.`);
    return all;
  } finally {
    await browser.close();
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  const label = process.argv[2] ?? process.env.VRT_LABEL ?? 'current';
  capture(label).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
