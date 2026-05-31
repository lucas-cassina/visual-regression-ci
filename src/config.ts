import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface Viewport {
  /** Label used in filenames, e.g. "desktop" | "mobile". */
  name: string;
  width: number;
  height: number;
  deviceScaleFactor?: number;
  isMobile?: boolean;
}

export interface RouteConfig {
  /** Stable label used in filenames, e.g. "landing". */
  name: string;
  /** Path appended to baseUrl, e.g. "/" or "/terminos". */
  path: string;
  /** Optional selector to wait for before capturing. */
  waitFor?: string;
  /** Extra selectors to mask on this route (added to the global mask). */
  mask?: string[];
}

export interface ClassifyConfig {
  enabled: boolean;
  provider: 'openai';
  model: string;
}

export interface VrtConfig {
  /** Base URL of the running app, e.g. "http://localhost:3000". */
  baseUrl: string;
  routes: RouteConfig[];
  viewports: Viewport[];
  /** Selectors masked on every route (dynamic/non-deterministic regions). */
  mask: string[];
  /** Per-pixel color sensitivity passed to pixelmatch (0..1). Lower = stricter. */
  threshold: number;
  /** Fraction of changed pixels above which a screen is flagged as changed. */
  diffRatioThreshold: number;
  /** Output directory for screenshots, diffs and reports. */
  outDir: string;
  classify: ClassifyConfig;
}

export type UserVrtConfig = Partial<Omit<VrtConfig, 'classify'>> &
  Pick<VrtConfig, 'baseUrl' | 'routes' | 'viewports'> & {
    classify?: Partial<ClassifyConfig>;
  };

const DEFAULTS = {
  mask: [] as string[],
  threshold: 0.1,
  diffRatioThreshold: 0.001,
  outDir: 'out',
  classify: { enabled: true, provider: 'openai' as const, model: 'gpt-4o' },
};

const CONFIG_CANDIDATES = [
  'vrt.config.js',
  'vrt.config.mjs',
  'vrt.config.json',
];

function findConfigPath(explicit?: string): string {
  const candidate = explicit ?? process.env.VRT_CONFIG;
  if (candidate) {
    const abs = resolve(process.cwd(), candidate);
    if (!existsSync(abs)) {
      throw new Error(`VRT config not found at ${abs}`);
    }
    return abs;
  }
  for (const name of CONFIG_CANDIDATES) {
    const abs = resolve(process.cwd(), name);
    if (existsSync(abs)) return abs;
  }
  throw new Error(
    `No VRT config found. Create vrt.config.js (see vrt.config.example.js) or set VRT_CONFIG.`,
  );
}

export async function loadConfig(explicit?: string): Promise<VrtConfig> {
  const configPath = findConfigPath(explicit);
  const mod = await import(pathToFileURL(configPath).href);
  const user = (mod.default ?? mod) as UserVrtConfig;

  if (!user.baseUrl) throw new Error('VRT config: "baseUrl" is required.');
  if (!user.routes?.length) throw new Error('VRT config: "routes" must be a non-empty array.');
  if (!user.viewports?.length) throw new Error('VRT config: "viewports" must be a non-empty array.');

  return {
    baseUrl: user.baseUrl.replace(/\/$/, ''),
    routes: user.routes,
    viewports: user.viewports,
    mask: user.mask ?? DEFAULTS.mask,
    threshold: user.threshold ?? DEFAULTS.threshold,
    diffRatioThreshold: user.diffRatioThreshold ?? DEFAULTS.diffRatioThreshold,
    outDir: user.outDir ?? DEFAULTS.outDir,
    classify: { ...DEFAULTS.classify, ...user.classify },
  };
}

/** Stable filename stem for a route+viewport pair, e.g. "landing__mobile". */
export function shotName(route: RouteConfig, viewport: Viewport): string {
  return `${route.name}__${viewport.name}`;
}
