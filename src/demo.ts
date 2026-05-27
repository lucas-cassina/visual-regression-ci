import { createServer, type Server } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, normalize, resolve } from 'node:path';
import { capture } from './capture.ts';
import { diff } from './diff.ts';
import { classify } from './classify.ts';
import { report } from './report.ts';

const CONFIG = process.env.VRT_CONFIG ?? 'examples/fixture.vrt.config.js';
const PORT = Number(new URL(process.env.VRT_BASE_URL ?? 'http://localhost:4173').port || 4173);

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

function serveDir(dir: string): Promise<Server> {
  const root = resolve(dir);
  const server = createServer(async (req, res) => {
    const urlPath = decodeURIComponent((req.url ?? '/').split('?')[0]);
    const rel = urlPath === '/' ? 'index.html' : normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
    const file = join(root, rel);
    if (!file.startsWith(root)) {
      res.writeHead(403).end();
      return;
    }
    try {
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
      res.end(body);
    } catch {
      res.writeHead(404).end('Not found');
    }
  });
  return new Promise((ok) => server.listen(PORT, () => ok(server)));
}

function close(server: Server): Promise<void> {
  return new Promise((ok) => server.close(() => ok()));
}

async function main(): Promise<void> {
  console.log('Demo: capturing baseline (test-fixture/before)...');
  let server = await serveDir('test-fixture/before');
  await capture('baseline', CONFIG);
  await close(server);

  console.log('Demo: capturing current (test-fixture/after)...');
  server = await serveDir('test-fixture/after');
  await capture('current', CONFIG);
  await close(server);

  await diff(CONFIG);
  await classify(CONFIG);
  await report(CONFIG);
  console.log('\nDemo done. See out/report.md and out/diff/.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
