#!/usr/bin/env node
import { capture } from './capture.js';
import { diff } from './diff.js';
import { classify } from './classify.js';
import { report } from './report.js';
import { comment } from './comment.js';
import { componentsMain } from './components/cli.js';

const HELP = `visual-regression-ci

Usage: vrt <command> [options]

Commands:
  capture <label>   Capture screenshots into out/<label> (label: baseline | current)
  diff              Pixel-diff baseline vs current, emit overlays
  classify          Classify changed screens with the vision model
  report            Build the markdown report (out/report.md)
  comment           Upsert the report as a sticky PR comment
  analyze           diff + classify + report (no capture, no comment)
  components        Component similarity analysis (see: vrt components help)

Config is read from vrt.config.js (or $VRT_CONFIG). See vrt.config.example.js.`;

function failOnBugIfRequested(summary: { bugs: number }): void {
  if (process.env.VRT_FAIL_ON_BUG === 'true' && summary.bugs > 0) {
    console.error(`Exiting non-zero: ${summary.bugs} likely bug(s) detected (VRT_FAIL_ON_BUG=true).`);
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const [cmd, arg] = process.argv.slice(2);
  switch (cmd) {
    case 'capture':
      await capture(arg ?? process.env.VRT_LABEL ?? 'current');
      break;
    case 'diff':
      await diff();
      break;
    case 'classify':
      await classify();
      break;
    case 'report':
      failOnBugIfRequested(await report());
      break;
    case 'comment':
      await comment();
      break;
    case 'analyze':
      await diff();
      await classify();
      failOnBugIfRequested(await report());
      break;
    case 'components':
      await componentsMain();
      break;
    case 'help':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      console.log(HELP);
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
