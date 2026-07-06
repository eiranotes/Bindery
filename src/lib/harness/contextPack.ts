// 로컬 정적 컨텍스트 라우터 — AI를 쓰지 않는 1차 선별 계층.
//
// 문제: 초안/설계 프롬프트가 바이블·인물·세계 문서를 통짜 clip으로 주입해
// 1화당 사전 토큰이 크고, 관련 없는 설정이 현재 회차를 오염시킨다.
// 해법(설계안 §5~6): 문서를 섹션으로 쪼개고(섹션 인덱스), 이번 화 플롯 row·요약·메모의
// 엔티티/질의어와의 관련도로 점수를 매긴 뒤(멘션·관계 근사), 문자 예산 안에서만 조립한다.
// 무엇이 왜 포함/제외됐는지 manifest로 남긴다 (Prompt Audit).
//
// 이 계층은 항상 로컬·결정적으로 동작한다. 선별 결과가 여전히 크면
// distillContextCapsule이 경량 모델로 집필용 캡슐로 2차 압축한다.
import { LAYOUT, artifactPath, summaryPath } from '$lib/core/layout';
import { clip, extractJsonObject, nowIso, parseFrontmatter, safeString } from '$lib/core/text';
import { BLUEPRINTS } from '$lib/prompts';
import type { PlotEpisodeRow } from '$lib/schemas/contracts';
import { hasSubstance, previousEpisode, renderPlotRowText } from './context';
import { loadPlotPlan } from './plot';
import { readOptional } from './project';
import { runStage } from './runner';
import type { Ctx } from './types';
import type { FileNode } from '$lib/bridge';

export type PackSection = {
  /** path#heading */
  id: string;
  path: string;
  docTitle: string;
  heading: string;
  text: string;
  chars: number;
  score: number;
  reasons: string[];
};

export type PackItem = Pick<PackSection, 'id' | 'path' | 'heading' | 'chars' | 'score' | 'reasons'>;

export type ContextPackManifest = {
  schema_version: 'bindery.context_pack.v1';
  episode: string;
  builtAt: string;
  budgetChars: number;
  usedChars: number;
  candidateCount: number;
  queryTerms: string[];
  included: PackItem[];
  excluded: PackItem[];
  /** 정제 결과 — 로컬 팩 이후 단계의 기록 */
  distill?: { source: 'agent' | 'fallback' | 'skipped'; inputChars: number; capsuleChars: number };
};

export type ContextPack = {
  text: string;
  manifest: ContextPackManifest;
};

const DEFAULT_BUDGET_CHARS = 6000;
const SECTION_CLIP_CHARS = 1600;

const STOPWORDS = new Set([
  '그리고', '하지만', '그러나', '있다', '없다', '한다', '했다', '되는', '되어', '이번',
  '있는', '하는', '위해', '통해', '대한', '함께', '가장', '것을', '것이', '수록',
  'the', 'and', 'for', 'with'
]);

/** 질의어 추출 — 플롯 row/요약/메모에서 2자 이상 낱말을 뽑는다 (결정적, AI 없음). */
export function extractQueryTerms(text: string, max = 60): string[] {
  const words = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  const seen = new Set<string>();
  for (const raw of words) {
    const w = raw.toLowerCase();
    if (STOPWORDS.has(w)) continue;
    seen.add(w);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/** Markdown을 heading 단위 섹션으로 쪼갠다. heading이 없으면 문서 전체가 한 섹션. */
export function splitSections(path: string, docTitle: string, markdown: string): PackSection[] {
  const body = parseFrontmatter(markdown).body ?? markdown;
  const lines = body.split('\n');
  const out: PackSection[] = [];
  let heading = docTitle;
  let buf: string[] = [];
  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) {
      out.push({
        id: `${path}#${heading}`,
        path,
        docTitle,
        heading,
        text,
        chars: text.length,
        score: 0,
        reasons: []
      });
    }
    buf = [];
  };
  for (const line of lines) {
    const m = /^(#{1,3})\s+(.+)$/.exec(line);
    if (m) {
      flush();
      heading = m[2].trim();
      continue;
    }
    buf.push(line);
  }
  flush();
  return out;
}

function countHits(text: string, term: string, cap = 3): number {
  let count = 0;
  let idx = 0;
  const lower = text.toLowerCase();
  while (count < cap) {
    idx = lower.indexOf(term, idx);
    if (idx === -1) break;
    count++;
    idx += term.length;
  }
  return count;
}

/** 섹션 점수 — 문서 제목 멘션(관계 근사) > 헤딩 일치 > 본문 질의어 일치. */
export function scoreSection(section: PackSection, queryText: string, terms: string[]): PackSection {
  const reasons: string[] = [];
  let score = 0;
  const queryLower = queryText.toLowerCase();

  // 관계 라우팅 근사: 이번 화 질의(플롯 row·요약·메모)에 이 문서/섹션의 이름이 등장하는가.
  const titleTerms = extractQueryTerms(`${section.docTitle} ${section.heading}`, 8);
  const mentioned = titleTerms.filter((t) => t.length >= 2 && queryLower.includes(t));
  if (mentioned.length) {
    score += 24 * Math.min(mentioned.length, 2);
    reasons.push(`이번 화 자료에 등장 (${mentioned.slice(0, 2).join(', ')})`);
  }

  let termHits = 0;
  for (const term of terms) {
    termHits += countHits(section.text, term);
  }
  if (termHits > 0) {
    score += Math.min(termHits, 24);
    reasons.push(`질의어 일치 ${termHits}회`);
  }

  return { ...section, score, reasons };
}

function walkMdFiles(nodes: FileNode[], prefix: string): FileNode[] {
  const out: FileNode[] = [];
  const walk = (list: FileNode[]) => {
    for (const node of list) {
      if (node.kind === 'file' && node.path.startsWith(prefix) && node.name.endsWith('.md') && !node.name.startsWith('.')) {
        out.push(node);
      }
      if (node.children) walk(node.children);
    }
  };
  walk(nodes);
  return out;
}

/** 이번 회차 집필/설계용 설정 자료 팩을 로컬에서 조립한다. */
export async function buildEpisodeContextPack(
  ctx: Ctx,
  episode: string,
  opts: { note?: string; extraQuery?: string } = {}
): Promise<ContextPack> {
  const budgetChars = ctx.contextBudgetChars ?? DEFAULT_BUDGET_CHARS;
  const prev = previousEpisode(episode);

  const [bibleRaw, threadsRaw, plan, prevSummaryRaw, tree] = await Promise.all([
    readOptional(ctx, LAYOUT.canon.bible),
    readOptional(ctx, LAYOUT.plot.openThreads),
    loadPlotPlan(ctx),
    prev ? readOptional(ctx, summaryPath(prev)) : Promise.resolve(''),
    ctx.bridge.listTree(ctx.root).catch(() => [] as FileNode[])
  ]);
  const plotRow: PlotEpisodeRow | null = plan?.episodes.find((e) => e.episode === episode) ?? null;

  // 질의 = 이번 화가 실제로 다루는 것 (플롯 row + 직전 요약 + 작가 메모).
  const queryText = [
    plotRow ? renderPlotRowText(plotRow) : '',
    prevSummaryRaw,
    opts.note ?? '',
    opts.extraQuery ?? ''
  ].join('\n');
  const terms = extractQueryTerms(queryText);

  // 섹션 후보 수집: 바이블 + 인물/세계/관계 노트 + 열린 떡밥.
  const sections: PackSection[] = [];
  if (hasSubstance(bibleRaw)) {
    sections.push(...splitSections(LAYOUT.canon.bible, '설정 바이블', bibleRaw));
  }
  const vaultFiles = [
    ...walkMdFiles(tree, 'characters/'),
    ...walkMdFiles(tree, 'world/'),
    ...walkMdFiles(tree, 'relationships/')
  ];
  for (const file of vaultFiles) {
    const raw = await readOptional(ctx, file.path);
    if (!hasSubstance(raw, 20)) continue;
    sections.push(...splitSections(file.path, file.name.replace(/\.md$/, ''), raw));
  }
  if (hasSubstance(threadsRaw, 20)) {
    sections.push(...splitSections(LAYOUT.plot.openThreads, '열린 떡밥', threadsRaw));
  }

  const scored = sections.map((s) => scoreSection(s, queryText, terms));

  // 바이블 첫 섹션(개요/전제)은 관련도와 무관하게 기본 포함 — 작품의 최소 정체성.
  const bibleAnchor = scored.find((s) => s.path === LAYOUT.canon.bible);
  if (bibleAnchor && !bibleAnchor.reasons.includes('바이블 기본 포함')) {
    bibleAnchor.score += 100;
    bibleAnchor.reasons.unshift('바이블 기본 포함');
  }

  const ranked = [...scored].sort((a, b) => b.score - a.score);
  const included: PackSection[] = [];
  const excluded: PackItem[] = [];
  let used = 0;
  for (const section of ranked) {
    const effectiveChars = Math.min(section.chars, SECTION_CLIP_CHARS);
    if (section.score <= 0) {
      excluded.push({ ...toItem(section), reasons: ['이번 화와 관련도 없음'] });
      continue;
    }
    if (used + effectiveChars > budgetChars) {
      excluded.push({ ...toItem(section), reasons: [...section.reasons, `예산 초과 (${budgetChars.toLocaleString()}자)`] });
      continue;
    }
    used += effectiveChars;
    included.push(section);
  }

  // 파일 순서를 유지해 읽기 좋은 팩 텍스트로 조립한다.
  const byDoc = new Map<string, PackSection[]>();
  for (const s of included) {
    const list = byDoc.get(s.path) ?? [];
    list.push(s);
    byDoc.set(s.path, list);
  }
  const parts: string[] = [];
  for (const [path, list] of byDoc) {
    parts.push(`### ${list[0].docTitle} — ${path}`);
    for (const s of list) {
      if (s.heading !== s.docTitle) parts.push(`#### ${s.heading}`);
      parts.push(clip(s.text, SECTION_CLIP_CHARS));
    }
    parts.push('');
  }
  const text = parts.join('\n').trim() || '(관련 설정 자료 없음 — 보수적으로 쓰고 새 설정은 후보로 분리)';

  const manifest: ContextPackManifest = {
    schema_version: 'bindery.context_pack.v1',
    episode,
    builtAt: nowIso(),
    budgetChars,
    usedChars: used,
    candidateCount: scored.length,
    queryTerms: terms.slice(0, 24),
    included: included.map(toItem),
    excluded: excluded.slice(0, 40),
    distill: { source: 'skipped', inputChars: text.length, capsuleChars: text.length }
  };
  return { text, manifest };
}

function toItem(s: PackSection): PackItem {
  return { id: s.id, path: s.path, heading: s.heading, chars: s.chars, score: s.score, reasons: s.reasons };
}

export type CapsuleResult = {
  capsule: string;
  pack: ContextPack;
  distillSource: 'agent' | 'fallback' | 'skipped';
};

function parseCapsule(text: string, episode: string): string | null {
  const obj = extractJsonObject(text);
  if (!obj || typeof obj !== 'object') return null;
  const raw = obj as Record<string, unknown>;
  if (safeString(raw.schema_version) !== 'bindery.context_capsule.v1') return null;
  const capsule = safeString(raw.capsule_md).trim();
  if (!capsule || capsule.length < 200) return null;
  void episode;
  return capsule;
}

export function contextPackPath(episode: string): string {
  return artifactPath(episode, 'context-pack.json');
}

export function contextCapsulePath(episode: string): string {
  return artifactPath(episode, 'context-capsule.md');
}

/**
 * 집필용 컨텍스트 준비: 로컬 정적 선별 → (팩이 크면) 경량 모델 정제 캡슐.
 * 결과와 manifest를 `.bindery/artifacts/<ep>/`에 남겨 "생성 근거 보기"가 읽는다.
 */
export async function prepareDraftContext(
  ctx: Ctx,
  episode: string,
  opts: { note?: string; extraQuery?: string } = {}
): Promise<CapsuleResult> {
  const pack = await buildEpisodeContextPack(ctx, episode, opts);
  const threshold = ctx.distillThresholdChars ?? 3000;

  let capsule = pack.text;
  let distillSource: CapsuleResult['distillSource'] = 'skipped';

  const agent = ctx.agentFor?.('context-distill') ?? ctx.agent;
  if (!ctx.offline && agent.command.trim() && pack.text.length > threshold) {
    const outcome = await runStage<string>(ctx, {
      stage: 'context-distill',
      scope: episode,
      blueprint: BLUEPRINTS.contextDistill,
      vars: {
        episode,
        goal: opts.extraQuery || (pack.manifest.queryTerms.length ? pack.manifest.queryTerms.join(', ') : '(질의 없음)'),
        pack: pack.text,
        budgetChars: String(Math.max(1200, Math.floor(threshold * 0.8)))
      },
      parse: (text) => parseCapsule(text, episode),
      // 정제 실패는 품질 저하가 아니라 압축 미적용일 뿐 — 로컬 팩을 그대로 쓴다.
      fallback: () => pack.text,
      repairHint: `{"schema_version":"bindery.context_capsule.v1","episode":"${episode}","capsule_md":"...","dropped_notes":[]}`
    });
    capsule = outcome.output;
    distillSource = outcome.source;
  }

  pack.manifest.distill = {
    source: distillSource,
    inputChars: pack.text.length,
    capsuleChars: capsule.length
  };

  // Prompt Audit 기록 — 근거 보기와 Detail 진단이 읽는다. 실패해도 흐름을 막지 않는다.
  try {
    await ctx.bridge.writeFile(ctx.root, contextPackPath(episode), JSON.stringify(pack.manifest, null, 2));
    await ctx.bridge.writeFile(ctx.root, contextCapsulePath(episode), capsule);
  } catch {
    /* 기록 실패 무시 */
  }

  return { capsule, pack, distillSource };
}

/** 저장된 manifest 로드 — UI 근거 보기용. */
export async function loadContextPackManifest(ctx: Ctx, episode: string): Promise<ContextPackManifest | null> {
  try {
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, contextPackPath(episode))) as ContextPackManifest;
    return raw.schema_version === 'bindery.context_pack.v1' ? raw : null;
  } catch {
    return null;
  }
}
