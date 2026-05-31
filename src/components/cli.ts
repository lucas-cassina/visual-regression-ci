import { scan } from './scan.js';
import { embed } from './embed.js';
import { compare } from './compare.js';
import { report } from './report.js';
import { componentComment } from './comment.js';

const HELP = `vrt components — component similarity analysis

Subcommands:
  scan     Scan srcDir for .tsx components → out/components-manifest.json
  embed    Embed each component via OpenAI  → out/components-embeddings.json
  compare  Cosine similarity + clustering   → out/components-similarity.json
  report   Build the markdown report        → out/components-report.md
  comment  Upsert report as sticky PR comment
  analyze  scan + embed + compare + report`;

export async function componentsMain(): Promise<void> {
  const sub = process.argv[3];
  switch (sub) {
    case 'scan':    await scan();    break;
    case 'embed':   await embed();   break;
    case 'compare': await compare(); break;
    case 'report':  await report();  break;
    case 'comment': await componentComment(); break;
    case 'analyze':
      await scan();
      await embed();
      await compare();
      await report();
      break;
    case 'help':
    case undefined:
      console.log(HELP);
      break;
    default:
      console.error(`Unknown components subcommand: ${sub}\n`);
      console.log(HELP);
      process.exit(1);
  }
}
