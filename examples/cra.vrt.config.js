// visual-regression-ci — example config for a Create React App project.
// Copy into your app repo as vrt.config.js and adjust routes/viewports.
export default {
  baseUrl: process.env.VRT_BASE_URL || 'http://localhost:3000',

  routes: [
    { name: 'home', path: '/' },
    { name: 'terms', path: '/terms' },
    { name: 'contact', path: '/contact', waitFor: 'form' },
  ],

  viewports: [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  ],

  // Mask non-deterministic regions to avoid noisy diffs. Add `data-vrt-mask`
  // to any element you want ignored, or extend this list.
  mask: [
    '[data-vrt-mask]',
    '[class*="carousel" i]',
    'video',
    'iframe',
    'time',
  ],

  threshold: 0.1,
  diffRatioThreshold: 0.001,
  outDir: 'out',

  classify: {
    enabled: true,
    provider: 'openai',
    model: 'gpt-4o',
  },
};
