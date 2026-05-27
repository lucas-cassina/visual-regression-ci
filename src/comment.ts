import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from './config.ts';
import { COMMENT_MARKER } from './report.ts';

const API = process.env.GITHUB_API_URL ?? 'https://api.github.com';

interface GhComment {
  id: number;
  body: string;
}

function resolvePrNumber(): number | undefined {
  if (process.env.VRT_PR_NUMBER) return Number(process.env.VRT_PR_NUMBER);
  // GitHub Actions exposes refs/pull/<n>/merge for pull_request events.
  const ref = process.env.GITHUB_REF ?? '';
  const m = ref.match(/refs\/pull\/(\d+)\//);
  if (m) return Number(m[1]);
  return undefined;
}

async function gh<T>(path: string, init?: RequestInit): Promise<T> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GITHUB_TOKEN is required to post PR comments.');
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} for ${path}: ${await res.text()}`);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

export async function comment(configPath?: string): Promise<void> {
  const config = await loadConfig(configPath);
  const outDir = resolve(process.cwd(), config.outDir);
  const body = await readFile(join(outDir, 'report.md'), 'utf8');

  const repo = process.env.GITHUB_REPOSITORY;
  const prNumber = resolvePrNumber();
  if (!repo || !prNumber) {
    console.log('No GITHUB_REPOSITORY / PR number in env — printing report instead of commenting:\n');
    console.log(body);
    return;
  }

  const existing = await gh<GhComment[]>(`/repos/${repo}/issues/${prNumber}/comments?per_page=100`);
  const mine = existing.find((c) => c.body?.includes(COMMENT_MARKER));

  if (mine) {
    await gh(`/repos/${repo}/issues/comments/${mine.id}`, { method: 'PATCH', body: JSON.stringify({ body }) });
    console.log(`Updated existing comment ${mine.id} on PR #${prNumber}.`);
  } else {
    await gh(`/repos/${repo}/issues/${prNumber}/comments`, { method: 'POST', body: JSON.stringify({ body }) });
    console.log(`Created comment on PR #${prNumber}.`);
  }
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  comment().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
