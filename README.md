# visual-regression-ci

Catch the visual regressions your tests don't.

Unit and integration tests verify behavior, not pixels. A button that drifts off-screen on
mobile, text that loses contrast, a layout that collapses at a narrow width — all of these pass
CI and ship. This tool runs on every PR that touches UI: it screenshots the affected screens,
diffs them against `main`, and asks a vision model whether each difference is a **real bug** or
an **expected change**, then comments on the PR with the visual diffs.

## How it works

```
PR opened (touches UI)
        │
        ▼
  capture current ──┐
                    ├──▶  pixel diff  ──▶  changed screens only  ──▶  GPT-4o classify
  capture baseline ─┘     (pixelmatch)                                (bug | expected)
   (built from main)                                                       │
                                                                           ▼
                                              sticky PR comment with baseline / current / diff
```

The pipeline is **hybrid on purpose**: a cheap pixel diff decides *what* changed, and the vision
model only looks at the screens that actually changed — so the AI cost stays proportional to the
size of the change, not the size of the app.

The baseline is built from `main` in the same CI job, so there's no snapshot storage to maintain
and no stale baselines: every run compares against a fresh build of the target branch.

## Stack

- **Playwright** (Chromium) for deterministic, full-page screenshots at desktop and mobile viewports
- **pixelmatch** + **pngjs** for the per-pixel diff and highlighted overlays
- **OpenAI GPT-4o** (swappable) to classify each changed screen as a bug or an expected change
- **GitHub Actions** to orchestrate, with sticky PR comments via the GitHub REST API

## Quick start (local)

```bash
npm install
npx playwright install --with-deps chromium
cp examples/cra.vrt.config.js vrt.config.js   # edit routes, viewports, baseUrl

# capture two states of your app and compare them
npm run vrt -- capture baseline      # against the "before" build
npm run vrt -- capture current       # against the "after" build
OPENAI_API_KEY=sk-... npm run vrt -- analyze   # diff + classify + report
open out/report.md
```

`analyze` runs `diff` → `classify` → `report`. Run `npm run vrt -- help` for all commands.
When installed as a dependency in your own app (`npm i -D visual-regression-ci`), the same
commands are available as `npx vrt <command>`.

### Try the built-in demo

The repo ships a tiny fixture with two states — a layout regression and a low-contrast
regression — so you can see a report without wiring up an app:

```bash
npm run demo
open out/report.md   # add OPENAI_API_KEY to also get bug/expected verdicts
```

## Configuration

`vrt.config.js` (see [`vrt.config.example.js`](./vrt.config.example.js)):

| Key | What it controls |
| --- | --- |
| `baseUrl` | Where the running app is served during capture |
| `routes` | Screens to capture (`{ name, path, waitFor?, mask? }`) |
| `viewports` | Sizes to capture each route at — include a mobile one |
| `mask` | CSS selectors masked on every route (dates, carousels, ads…) to avoid false positives |
| `threshold` | pixelmatch per-pixel sensitivity (0–1) |
| `diffRatioThreshold` | fraction of changed pixels above which a screen is flagged |
| `classify` | `{ enabled, provider, model }` for the vision step |

Determinism matters: animations and transitions are disabled, web fonts are awaited, the caret is
hidden, and masked regions are painted over before each screenshot. Mask anything non-deterministic
or you'll get noisy diffs.

## CI setup (GitHub Actions)

Copy [`.github/workflows/visual-regression.yml`](./.github/workflows/visual-regression.yml) into
your app's repo and adapt the three `APP-SPECIFIC` lines (install / build / serve). Then:

1. Add an `OPENAI_API_KEY` repository secret.
2. Open a PR that touches UI — the workflow captures both branches, diffs, classifies, and comments.

Diff images are pushed to a `vrt-results` branch and referenced from the comment via
`raw.githubusercontent.com`, so they render inline without any external image host.

> Using GitLab instead of GitHub? See [`examples/gitlab-ci.yml`](./examples/gitlab-ci.yml) — the
> core scripts are CI-agnostic.

## Results

<!-- Replace with real before/after captures from a run on your app. -->
_Add screenshots of the PR comment here — e.g. a layout regression and a low-contrast regression
caught on mobile._

## License

MIT
