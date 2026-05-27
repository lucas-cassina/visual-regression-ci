import OpenAI from 'openai';
import { readFile, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { loadConfig } from './config.ts';
import type { DiffResult } from './diff.ts';

export type Verdict = 'bug' | 'expected' | 'unreviewed';
export type Category = 'layout' | 'contrast' | 'spacing' | 'content' | 'color' | 'other';

export interface Classification {
  verdict: Verdict;
  category: Category;
  severity: 'low' | 'medium' | 'high';
  reason: string;
}

export interface ClassifiedResult extends DiffResult {
  classification?: Classification;
}

const SYSTEM_PROMPT = `You are a senior frontend engineer reviewing a UI change for visual regressions.
You are given two screenshots of the SAME screen: the BASELINE (current main branch) and the CURRENT (the pull request), plus a DIFF overlay highlighting changed pixels in red.

Decide whether the difference is a likely BUG (an unintended visual regression) or an EXPECTED change (intentional redesign or content update).

Treat as BUG: broken or shifted layout, overlapping or cut-off elements, misaligned components, elements that disappeared unintentionally, unreadable or low-contrast text, a button/control that looks broken — especially on mobile.
Treat as EXPECTED: deliberate copy/content edits, intentional restyling that still looks coherent, added sections that render cleanly.

Respond ONLY with a JSON object:
{
  "verdict": "bug" | "expected",
  "category": "layout" | "contrast" | "spacing" | "content" | "color" | "other",
  "severity": "low" | "medium" | "high",
  "reason": "one concise sentence explaining the decision"
}`;

async function imageDataUrl(path: string): Promise<string> {
  const buf = await readFile(path);
  return `data:image/png;base64,${buf.toString('base64')}`;
}

function coerce(raw: unknown): Classification {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const verdict: Verdict = obj.verdict === 'bug' || obj.verdict === 'expected' ? obj.verdict : 'unreviewed';
  const validCats: Category[] = ['layout', 'contrast', 'spacing', 'content', 'color', 'other'];
  const category = validCats.includes(obj.category as Category) ? (obj.category as Category) : 'other';
  const validSev = ['low', 'medium', 'high'];
  const severity = (validSev.includes(obj.severity as string) ? obj.severity : 'medium') as Classification['severity'];
  const reason = typeof obj.reason === 'string' ? obj.reason : 'No explanation provided.';
  return { verdict, category, severity, reason };
}

async function classifyOne(
  client: OpenAI,
  model: string,
  result: DiffResult,
): Promise<Classification> {
  const images = [
    { label: 'BASELINE (main)', path: result.baselineFile },
    { label: 'CURRENT (pull request)', path: result.currentFile },
    { label: 'DIFF overlay (changed pixels in red)', path: result.diffFile },
  ].filter((i): i is { label: string; path: string } => Boolean(i.path));

  const content: OpenAI.Chat.Completions.ChatCompletionContentPart[] = [
    { type: 'text', text: `Screen: ${result.route} at ${result.viewport} viewport. Changed pixel ratio: ${(result.ratio * 100).toFixed(3)}%.` },
  ];
  for (const img of images) {
    content.push({ type: 'text', text: img.label });
    content.push({ type: 'image_url', image_url: { url: await imageDataUrl(img.path), detail: 'high' } });
  }

  const completion = await client.chat.completions.create({
    model,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content },
    ],
  });

  const text = completion.choices[0]?.message?.content ?? '{}';
  try {
    return coerce(JSON.parse(text));
  } catch {
    return { verdict: 'unreviewed', category: 'other', severity: 'medium', reason: 'Model returned unparseable output.' };
  }
}

export async function classify(configPath?: string): Promise<ClassifiedResult[]> {
  const config = await loadConfig(configPath);
  const outDir = resolve(process.cwd(), config.outDir);
  const report: DiffResult[] = JSON.parse(await readFile(join(outDir, 'diff-report.json'), 'utf8'));

  const toReview = report.filter((r) => r.status === 'changed' && r.diffFile);
  const results: ClassifiedResult[] = report.map((r) => ({ ...r }));

  if (!config.classify.enabled || !process.env.OPENAI_API_KEY) {
    const why = !config.classify.enabled ? 'classification disabled in config' : 'OPENAI_API_KEY not set';
    console.log(`Skipping AI classification (${why}). ${toReview.length} changed screens left unreviewed.`);
    for (const r of results) {
      if (r.status === 'changed') {
        r.classification = { verdict: 'unreviewed', category: 'other', severity: 'medium', reason: why };
      }
    }
  } else {
    const client = new OpenAI();
    console.log(`Classifying ${toReview.length} changed screens with ${config.classify.model}...`);
    for (const r of results) {
      if (r.status !== 'changed' || !r.diffFile) continue;
      r.classification = await classifyOne(client, config.classify.model, r);
      console.log(`  ${r.stem}: ${r.classification.verdict} (${r.classification.category})`);
    }
  }

  await writeFile(join(outDir, 'classification.json'), JSON.stringify(results, null, 2));
  return results;
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {
  classify().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
