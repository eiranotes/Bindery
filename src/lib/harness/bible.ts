// 바이블 조립 — 승인된 자산 파일을 근거로 canon/setting-bible.md 후보를 만든다.
// 기존 바이블은 스냅샷 후에만 교체된다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { snapshotFile } from './snapshots';
import { LAYOUT, candidatePath } from '$lib/core/layout';
import { clip, nowIso, parseFrontmatter, stamp } from '$lib/core/text';
import type { Ctx, StageOutcome } from './types';
import type { IdeaFile } from './ideas';

/** characters/, world/, relationships/ 아래 승인 자산 파일을 모은다. */
export async function collectAssetFiles(ctx: Ctx): Promise<Array<{ path: string; content: string }>> {
  const nodes = await ctx.bridge.listTree(ctx.root);
  const out: Array<{ path: string; content: string }> = [];
  const walk = async (list: typeof nodes): Promise<void> => {
    for (const node of list) {
      if (node.kind === 'file' && /^(characters|world|relationships)\//.test(node.path) && node.name.endsWith('.md') && node.name !== 'README.md') {
        try {
          out.push({ path: node.path, content: await ctx.bridge.readFile(ctx.root, node.path) });
        } catch {
          /* skip */
        }
      }
      if (node.children) await walk(node.children);
    }
  };
  await walk(nodes);
  return out;
}

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:markdown|md)?\s*\n([\s\S]*?)\n```$/i.exec(trimmed);
  return fenced ? fenced[1].trim() : trimmed;
}

function assetName(asset: { path: string; content: string }): string {
  const fm = parseFrontmatter(asset.content);
  const fromFm = typeof fm.data.name === 'string' ? fm.data.name.trim() : '';
  const heading = /^#\s+(.+)$/m.exec(fm.body)?.[1]?.trim() ?? '';
  return fromFm || heading || asset.path.split('/').pop()?.replace(/\.md$/, '') || asset.path;
}

function assetFunction(asset: { content: string }): string {
  const body = parseFrontmatter(asset.content).body;
  const quote = /^>\s*기능:\s*(.+)$/m.exec(body)?.[1]?.trim();
  if (quote) return quote;
  const paragraph = body
    .split(/\n{2,}/)
    .map((p) => p.replace(/^#+\s+.*$/gm, '').trim())
    .find(Boolean);
  return paragraph ? clip(paragraph.replace(/\s+/g, ' '), 140) : '(요약 없음)';
}

function assetKind(asset: { path: string; content: string }): string {
  const fm = parseFrontmatter(asset.content);
  return typeof fm.data.kind === 'string' ? fm.data.kind : asset.path.split('/')[0] ?? 'asset';
}

function localBibleFallback(title: string, assets: Array<{ path: string; content: string }>, selectedIdeas: IdeaFile[]): string {
  const rows = assets
    .map((a) => `| ${assetName(a)} | ${assetFunction(a)} | ${assetKind(a)} | ${a.path} |`)
    .join('\n');
  const seedLines = selectedIdeas
    .map((i) => `- ${i.seed.title}: ${i.seed.hook}${i.seed.reader_promise ? ` (독자 약속: ${i.seed.reader_promise})` : ''}`)
    .join('\n');
  const rules = assets
    .filter((a) => /\/rules?\//.test(a.path) || assetKind(a) === 'rule')
    .map((a) => `- ${assetName(a)}: ${assetFunction(a)} (${a.path})`)
    .join('\n');
  const terms = assets
    .filter((a) => /\/terms?\//.test(a.path) || assetKind(a) === 'term' || assetKind(a) === 'system')
    .map((a) => `- ${assetName(a)}: ${assetFunction(a)} (${a.path})`)
    .join('\n');
  return [
    `# 설정 바이블 — ${title}`,
    '',
    '> 로컬 조립본: AI 바이블 조립이 실패했거나 오프라인일 때, 승인된 자산 파일에서 직접 뽑은 최소 집필 기준입니다.',
    '',
    '## 전제',
    selectedIdeas.length
      ? '- 채택 기획과 승인 자산을 기준으로 플롯과 회차를 이어갑니다. 세부 사실은 각 자산 파일이 원본입니다.'
      : assets.length
        ? '- 아래 승인 자산을 기준으로 플롯과 회차를 이어갑니다. 세부 사실은 각 자산 파일이 원본입니다.'
        : '- (승인된 자산 없음)',
    '',
    '## 채택 기획',
    seedLines || '- (채택 기획 기록 없음)',
    '',
    '## 세계 규칙 (어기면 안 되는 것)',
    rules || '- (명시된 규칙 자산 없음)',
    '',
    '## 주요 자산',
    '| 이름 | 기능 | 종류 | 파일 |',
    '|---|---|---|---|',
    rows || '| (없음) |  |  |  |',
    '',
    '## 용어',
    terms || '- (명시된 용어/시스템 자산 없음)',
    '',
    '## 미확정 (열어둔 것)',
    '- AI 조립본이 아니므로 금지·주의 항목은 자산 파일을 보며 보강해야 합니다.'
  ].join('\n');
}

/** 바이블 후보 생성 — 후보 파일로 저장하고 경로를 돌려준다. 적용은 별도. */
export async function assembleBible(ctx: Ctx, title: string, selectedIdeas: IdeaFile[]): Promise<{ candidatePath: string; outcome: StageOutcome<string> }> {
  const assets = await collectAssetFiles(ctx);
  const assetFiles = assets.map((a) => `### ${a.path}\n${clip(a.content, 1800)}`).join('\n\n');
  const existing = await readOptional(ctx, LAYOUT.canon.bible);
  const outcome = await runStage<string>(ctx, {
    stage: 'bible-assembly',
    scope: 'work',
    blueprint: BLUEPRINTS.bibleAssembly,
    vars: {
      assetFiles: clip(assetFiles, 16000) || '(승인된 자산 파일 없음)',
      selectedSeeds: selectedIdeas.map((i) => `- ${i.seed.title}: ${i.seed.hook}`).join('\n') || '(없음)',
      existingBible: clip(existing, 5000) || '(기존 바이블 없음)'
    },
    parse: (text) => {
      const t = stripMarkdownFence(text);
      return t.startsWith('#') && t.includes('##') && t.length > 200 ? t : null;
    },
    fallback: () => localBibleFallback(title, assets, selectedIdeas)
  });
  const path = candidatePath('work', `bible-${stamp()}.md`);
  await ctx.bridge.writeFile(ctx.root, path, outcome.output);
  await writeArtifact(ctx, 'work', 'bible-assembly', `바이블 후보 (${nowIso().slice(0, 16)})`, outcome.output, outcome.source);
  return { candidatePath: path, outcome };
}

/** 바이블 후보 적용 — 기존 바이블 스냅샷 후 교체. 사람의 명시적 액션으로만 호출된다. */
export async function applyBibleCandidate(ctx: Ctx, fromCandidatePath: string): Promise<void> {
  const content = await ctx.bridge.readFile(ctx.root, fromCandidatePath);
  await snapshotFile(ctx, LAYOUT.canon.bible, '바이블 교체 전');
  await ctx.bridge.writeFile(ctx.root, LAYOUT.canon.bible, content);
}
