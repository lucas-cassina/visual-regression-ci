import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from './config.ts';

export type ShotStatus = 'changed' | 'unchanged' | 'added' | 'removed';

export interface DiffResult {
  stem: string;
  route: string;
  viewport: string;
  status: ShotStatus;
  ratio: number;
  diffPixels: number;
  baselineFile?: string;
  currentFile?: string;
  diffFile?: string;
}

function parseStem(stem: string): { route: string; viewport: string } {
  const idx = stem.lastIndexOf('__');
  if (idx === -1) return { route: stem, viewport: 'default' };
  return { route: stem.slice(0, idx), viewport: stem.slice(idx + 2) };
}

async function listShots(dir: string): Promise<Set<string>> {
  if (!existsSync(dir)) return new Set();
  const files = await readdir(dir);
  return new Set(
    files.filter((f) => f.endsWith('.png')).map((f) => f.replace(/\.png$/, '')),
  );
}

function padTo(png: PNG, width: number, height: number): PNG {
  if (png.width === width && png.height === height) return png;
  const out = new PNG({ width, height });
  out.data.fill(0xff); // white background
  PNG.bitblt(png, out, 0, 0, png.width, png.height, 0, 0);
  return out;
}

async function comparePair(
  stem: string,
  baselinePath: string,
  currentPath: string,
  diffPath: string,
  threshold: number,
  diffRatioThreshold: number,
): Promise<{ status: ShotStatus; ratio: number; diffPixels: number }> {
  const baseRaw = PNG.sync.read(await readFile(baselinePath));
  const currRaw = PNG.sync.read(await readFile(currentPath));

  const width = Math.max(baseRaw.width, currRaw.width);
  const height = Math.max(baseRaw.height, currRaw.height);
  const base = padTo(baseRaw, width, height);
  const curr = padTo(currRaw, width, height);

  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(base.data, curr.data, diff.data, width, height, {
    threshold,
    includeAA: false,
    alpha: 0.4,
    diffColor: [255, 0, 0],
  });

  const ratio = diffPixels / (width * height);
  const changed = ratio > diffRatioThreshold;
  if (changed) {
    await writeFile(diffPath, PNG.sync.write(diff));
  }
  return { status: changed ? 'changed' : 'unchanged', ratio, diffPixels };
}

export async function diff(configPath?: string): Promise<DiffResult[]> {
  const config = await loadConfig(configPath);
  const outDir = resolve(process.cwd(), config.outDir);
  const baselineDir = join(outDir, 'baseline');
  const currentDir = join(outDir, 'current');
  const diffDir = join(outDir, 'diff');
  await mkdir(diffDir, { recursive: true });

  const baseShots = await listShots(baselineDir);
  const currShots = await listShots(currentDir);
  const allStems = [...new Set([...baseShots, ...currShots])].sort();

  const results: DiffResult[] = [];
  for (const stem of allStems) {
    const { route, viewport } = parseStem(stem);
    const inBase = baseShots.has(stem);
    const inCurr = currShots.has(stem);

    if (inBase && !inCurr) {
      results.push({ stem, route, viewport, status: 'removed', ratio: 0, diffPixels: 0, baselineFile: join(baselineDir, `${stem}.png`) });
      continue;
    }
    if (!inBase && inCurr) {
      results.push({ stem, route, viewport, status: 'added', ratio: 1, diffPixels: 0, currentFile: join(currentDir, `${stem}.png`) });
      continue;
    }

    const baselineFile = join(baselineDir, `${stem}.png`);
    const currentFile = join(currentDir, `${stem}.png`);
    const diffFile = join(diffDir, `${stem}.png`);
    const { status, ratio, diffPixels } = await comparePair(
      stem, baselineFile, currentFile, diffFile, config.threshold, config.diffRatioThreshold,
    );
    results.push({
      stem, route, viewport, status, ratio, diffPixels,
      baselineFile, currentFile,
      diffFile: status === 'changed' ? diffFile : undefined,
    });
  }

  await writeFile(join(outDir, 'diff-report.json'), JSON.stringify(results, null, 2));
  const changed = results.filter((r) => r.status !== 'unchanged');
  console.log(`Compared ${results.length} screens — ${changed.length} changed/added/removed.`);
  for (const r of changed) {
    console.log(`  [${r.status}] ${r.stem} (ratio ${(r.ratio * 100).toFixed(3)}%)`);
  }
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  diff().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
