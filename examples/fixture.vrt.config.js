// Config for the built-in demo (`npm run demo`). Points at test-fixture/.
export default {
  baseUrl: process.env.VRT_BASE_URL || 'http://localhost:4173',
  routes: [
    { name: 'home', path: '/' },
    { name: 'pricing', path: '/pricing.html' },
    { name: 'signup', path: '/signup.html' },
    { name: 'news', path: '/news.html' },
    { name: 'about', path: '/about.html' },
  ],
  viewports: [
    { name: 'desktop', width: 1280, height: 800 },
    { name: 'mobile', width: 390, height: 844, deviceScaleFactor: 2, isMobile: true },
  ],
  mask: ['[data-vrt-mask]'],
  threshold: 0.1,
  diffRatioThreshold: 0.001,
  outDir: 'out',
  classify: { enabled: true, provider: 'openai', model: 'gpt-4o' },
};
