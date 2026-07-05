// 소재 발굴 — ideas/{inbox,seeds,selected,discarded}/*.md 가 진실.
// AI는 inbox에 후보 파일을 만들 뿐이고, 상태 전이는 사람이 폴더 이동으로 결정한다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { LAYOUT, ideaDir, type IdeaStatus } from '$lib/core/layout';
import { nowIso, slugify, stamp, parseFrontmatter, renderFrontmatter } from '$lib/core/text';
import { parseIdeaSeedBatch, type IdeaSeed } from '$lib/schemas/contracts';
import type { Ctx, StageOutcome } from './types';

export type IdeaCriteria = {
  genres: string;
  mood: string;
  cliches: string;
  readerExperience: string;
  avoid: string;
  notes: string;
  count: number;
};

export type IdeaFile = { seed: IdeaSeed; status: IdeaStatus; path: string };

export function renderIdeaSeedFile(seed: IdeaSeed): string {
  return [
    renderFrontmatter({
      schema: seed.schema_version,
      id: seed.id,
      title: seed.title,
      genre_tags: seed.genre_tags,
      source: seed.source,
      created: seed.createdAt
    }),
    `# ${seed.title}`,
    '',
    `## 훅`,
    seed.hook,
    '',
    `## 감정 엔진`,
    seed.emotional_engine || '(미정)',
    '',
    `## 독자 약속 (반복되는 재미)`,
    seed.reader_promise,
    '',
    `## 장기 연재 잠재력`,
    seed.longform_potential || '(미정)',
    '',
    `## 첫 장면 이미지`,
    seed.first_scene_image || '(미정)',
    '',
    `## 리스크`,
    ...(seed.risks.length ? seed.risks.map((r) => `- ${r}`) : ['- (기록된 리스크 없음)']),
    ''
  ].join('\n');
}

export function parseIdeaSeedFile(content: string, path: string): IdeaFile | null {
  const fm = parseFrontmatter(content);
  if (!fm.present || fm.data.schema !== 'bindery.idea_seed.v1') return null;
  const section = (label: string): string => {
    const m = new RegExp(`##\\s*${label}[^\\n]*\\n([\\s\\S]*?)(?=\\n## |$)`).exec(fm.body);
    return m ? m[1].trim() : '';
  };
  const statusDir = path.split('/')[1] as IdeaStatus;
  const status: IdeaStatus = ['inbox', 'seeds', 'selected', 'discarded'].includes(statusDir) ? statusDir : 'inbox';
  return {
    status,
    path,
    seed: {
      schema_version: 'bindery.idea_seed.v1',
      id: String(fm.data.id ?? path),
      title: String(fm.data.title ?? '무제'),
      genre_tags: Array.isArray(fm.data.genre_tags) ? fm.data.genre_tags : [],
      hook: section('훅'),
      emotional_engine: section('감정 엔진'),
      reader_promise: section('독자 약속'),
      longform_potential: section('장기 연재 잠재력'),
      first_scene_image: section('첫 장면 이미지'),
      risks: section('리스크').split('\n').map((l) => l.replace(/^-\s*/, '').trim()).filter((l) => l && !l.startsWith('(')),
      source: (String(fm.data.source ?? 'manual') as IdeaSeed['source']),
      createdAt: String(fm.data.created ?? '')
    }
  };
}

/** 프로젝트의 모든 소재 파일을 읽는다. */
export async function listIdeas(ctx: Ctx): Promise<IdeaFile[]> {
  const nodes = await ctx.bridge.listTree(ctx.root);
  const ideasDir = nodes.find((n) => n.path === 'ideas');
  const out: IdeaFile[] = [];
  for (const statusNode of ideasDir?.children ?? []) {
    for (const file of statusNode.children ?? []) {
      if (file.kind !== 'file' || file.name.startsWith('.') || file.name === 'README.md') continue;
      try {
        const parsed = parseIdeaSeedFile(await ctx.bridge.readFile(ctx.root, file.path), file.path);
        if (parsed) out.push(parsed);
      } catch {
        /* 읽기 실패 파일은 건너뜀 */
      }
    }
  }
  return out.sort((a, b) => b.seed.createdAt.localeCompare(a.seed.createdAt));
}

function localIdeaFallback(criteria: IdeaCriteria): Omit<IdeaSeed, 'id' | 'source' | 'createdAt'>[] {
  // 정직한 오프라인 뼈대 — AI 흉내를 내지 않고, 작가가 채울 틀만 만든다.
  return [
    {
      schema_version: 'bindery.idea_seed.v1',
      title: `(오프라인 뼈대) ${criteria.genres || '장르 미정'} 소재 초안`,
      genre_tags: criteria.genres.split(/[,\s]+/).filter(Boolean).slice(0, 4),
      hook: criteria.notes || '(훅을 직접 적어 주세요 — AI 실행기 연결 후 다시 실행하면 후보가 채워집니다)',
      emotional_engine: criteria.mood || '(미정)',
      reader_promise: criteria.readerExperience || '(미정)',
      longform_potential: '(미정)',
      first_scene_image: '(미정)',
      risks: ['AI 미연결 상태에서 만든 뼈대입니다. 내용을 직접 채우거나 연결 후 재실행하세요.']
    }
  ];
}

/** 소재 후보 생성 — inbox에 파일로 남긴다. */
export async function discoverIdeas(ctx: Ctx, criteria: IdeaCriteria, existingTitles: string[]): Promise<{ files: IdeaFile[]; outcome: StageOutcome<unknown> }> {
  const now = nowIso();
  const outcome = await runStage(ctx, {
    stage: 'idea-discovery',
    scope: 'work',
    blueprint: BLUEPRINTS.ideaDiscovery,
    vars: {
      count: String(Math.max(1, Math.min(10, criteria.count))),
      genres: criteria.genres || '(지정 없음)',
      mood: criteria.mood || '(지정 없음)',
      cliches: criteria.cliches || '(지정 없음)',
      readerExperience: criteria.readerExperience || '(지정 없음)',
      avoid: criteria.avoid || '(없음)',
      notes: criteria.notes || '(없음)',
      existingTitles: existingTitles.join(', ') || '(없음)'
    },
    parse: (text) => parseIdeaSeedBatch(text, now),
    fallback: () => localIdeaFallback(criteria),
    repairHint: '{"schema_version":"bindery.idea_seed_batch.v1","seeds":[{"title":"...","genre_tags":["..."],"hook":"...","emotional_engine":"...","reader_promise":"...","longform_potential":"...","first_scene_image":"...","risks":["..."]}]}'
  });

  const files: IdeaFile[] = [];
  let n = 0;
  for (const partial of outcome.output as Omit<IdeaSeed, 'id' | 'source' | 'createdAt'>[]) {
    const id = `idea-${stamp()}-${++n}`;
    const seed: IdeaSeed = { ...partial, id, source: outcome.source === 'agent' ? 'agent' : 'local', createdAt: now };
    const path = `${LAYOUT.ideas.inbox}/${id}-${slugify(seed.title)}.md`;
    await ctx.bridge.writeFile(ctx.root, path, renderIdeaSeedFile(seed));
    files.push({ seed, status: 'inbox', path });
  }
  await writeArtifact(
    ctx, 'work', 'idea-discovery',
    `소재 후보 ${files.length}건${outcome.source === 'fallback' ? ' (로컬 뼈대)' : ''}`,
    files.map((f) => `- [${f.seed.id}] ${f.seed.title} — ${f.seed.hook}`).join('\n'),
    outcome.source
  );
  return { files, outcome };
}

/** 상태 전이 = 폴더 이동. 사람의 결정이며 AI는 하지 않는다. */
export async function moveIdea(ctx: Ctx, idea: IdeaFile, to: IdeaStatus): Promise<IdeaFile> {
  const name = idea.path.split('/').pop()!;
  const toPath = `${ideaDir(to)}/${name}`;
  await ctx.bridge.moveFile(ctx.root, idea.path, toPath);
  return { ...idea, status: to, path: toPath };
}

/** 소재 선별 권고 (idea_triage) — 권고 보고서 artifact만 만든다. 결정은 사람. */
export async function triageIdeas(ctx: Ctx, ideas: IdeaFile[], priorities: string): Promise<StageOutcome<string>> {
  const seedList = ideas
    .map((i) => `### ${i.seed.title} (${i.status})\n- 훅: ${i.seed.hook}\n- 약속: ${i.seed.reader_promise}\n- 리스크: ${i.seed.risks.join('; ') || '없음'}`)
    .join('\n\n');
  const outcome = await runStage<string>(ctx, {
    stage: 'idea-triage',
    scope: 'work',
    blueprint: BLUEPRINTS.ideaTriage,
    vars: { seedList, priorities: priorities || '(지정 없음)' },
    parse: (text) => (text.trim().includes('##') ? text.trim() : null),
    fallback: () => '## 선별 권고 없음\n\nAI 실행기가 연결되지 않아 권고를 만들지 못했습니다. 소재 카드의 리스크 항목을 직접 비교하세요.'
  });
  await writeArtifact(ctx, 'work', 'idea-triage', '소재 선별 권고', outcome.output, outcome.source);
  return outcome;
}
