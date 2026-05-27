#!/usr/bin/env -S npx tsx
import { capture } from './capture.ts';
import { diff } from './diff.ts';
import { classify } from './classify.ts';
import { report } from './report.ts';
import { comment } from './comment.ts';

const HELP = `visual-regression-ci

Usage: vrt <command> [options]

Commands:
  capture <label>   Capture screenshots into out/<label> (label: baseline | current)
  diff              Pixel-diff baseline vs current, emit overlays
  classify          Classify changed screens with the vision model
  report            Build the markdown report (out/report.md)
  comment           Upsert the report as a sticky PR comment
  analyze           diff + classify + report (no capture, no comment)

Config is read from vrt.config.js (or $VRT_CONFIG). See vrt.config.example.js.`;

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
      await report();
      break;
    case 'comment':
      await comment();
      break;
    case 'analyze':
      await diff();
      await classify();
      await report();
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
