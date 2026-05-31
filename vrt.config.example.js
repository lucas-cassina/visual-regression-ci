// Visual Regression CI — example configuration.
// Copy to vrt.config.js and adjust to your app.
export default {
  // URL where the built app is being served during CI.
  baseUrl: process.env.VRT_BASE_URL || 'http://localhost:3000',

  // Screens to capture. Keep `name` stable — it's used in filenames and reports.
  routes: [
    { name: 'home', path: '/' },
    { name: 'pricing', path: '/pricing' },
    { name: 'contact', path: '/contact', waitFor: 'form' },
  ],

  // Capture each route at every viewport. Mobile matters: many regressions only
  // show up at narrow widths.
  viewports: [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  ],

  // CSS selectors masked on every route to avoid false positives from dynamic
  // content (dates, carousels, ads, randomized data...).
  mask: [
    '[data-vrt-mask]',
    'time',
    '.carousel',
  ],

  // pixelmatch per-pixel color sensitivity (0..1). Lower = stricter.
  threshold: 0.1,
  // Fraction of changed pixels above which a screen is flagged as changed.
  diffRatioThreshold: 0.001,

  outDir: 'out',

  classify: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-4o',
    // Image fidelity sent to the vision model. 'auto' is cheapest sensible default;
    // bump to 'high' if you see the model missing subtle regressions.
    detail: 'auto',
    // Max parallel classification requests.
    concurrency: 4,
  },

  // Component similarity analysis — detects near-duplicate React components.
  // Run with: vrt components analyze && vrt components comment
  // components: {
  //   enabled: true,
  //   srcDir: 'src/components',   // directory to scan for .tsx files (recursive)
  //   threshold: 0.85,            // cosine similarity score above which two components are flagged
  //   model: 'text-embedding-3-small',
  //   concurrency: 8,
  // },
};
