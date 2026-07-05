// 바이블 조립 — 승인된 자산 파일을 근거로 canon/setting-bible.md 후보를 만든다.
// 기존 바이블은 스냅샷 후에만 교체된다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { snapshotFile } from './snapshots';
import { LAYOUT, candidatePath } from '$lib/core/layout';
import { clip, nowIso, stamp } from '$lib/core/text';
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

function localBibleFallback(title: string, assets: Array<{ path: string; content: string }>): string {
  const names = assets.map((a) => `- ${a.path}`).join('\n');
  return [
    `# 설정 바이블 — ${title}`,
    '',
    '> 오프라인 조립본: AI 없이 자산 파일 목록만 정리했습니다. 각 파일을 열어 요약을 직접 채우거나 AI 연결 후 재실행하세요.',
    '',
    '## 자산 파일',
    names || '- (승인된 자산 없음)',
    '',
    '## 세계 규칙 (어기면 안 되는 것)',
    '- ',
    '',
    '## 미확정 (열어둔 것)',
    '- '
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
      const t = text.trim();
      return t.startsWith('#') && t.includes('##') && t.length > 200 ? t : null;
    },
    fallback: () => localBibleFallback(title, assets)
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
