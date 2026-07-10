// 회차 루프 — 브리프 → 장면 계획 → 초안 후보 → QA → 수정 계획 → 수정 후보.
// 계획 산출물은 회차 폴더의 파일(brief.md, scene-plan.md)로 남고 사람이 직접 수정할 수 있다.
// 원고 후보는 .bindery/candidates/에만 쓰이고, 적용은 diff 검토 + 스냅샷 이후다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { snapshotFile } from './snapshots';
import { LAYOUT, episodePaths, candidatePath, summaryPath } from '$lib/core/layout';
import { clip, contentHash, excerptWindow, nowIso, parseFrontmatter, stamp } from '$lib/core/text';
import {
  parseEpisodeBrief,
  parseScenePlan,
  parseDraftCandidate,
  parseQAReport,
  parseRevisionPlan,
  type EpisodeBrief,
  type ScenePlan,
  type DraftCandidate,
  type QAReport,
  type QAAspect,
  type RevisionPlan
} from '$lib/schemas/contracts';
import { loadEpisodeContext } from './context';
import { buildEpisodeContextPack, prepareDraftContext } from './contextPack';
import { buildStyleCapsule } from './styleTransfer';
import { qualitySummary, scoreDraftQuality, type QualityStatus } from './quality';
import type { Ctx, StageOutcome } from './types';

// 회차 번호 헬퍼는 context.ts가 원본이다 (기초자료 로더와의 순환 참조 방지).
export { previousEpisode, nextEpisode } from './context';

const JSON_BLOCK = /<!--\s*bindery:json\s*([\s\S]*?)-->/;

export type PlanningApprovalStatus = 'draft' | 'approved';
/** 승인 주체 — 계획 산출물(soft output)은 autopilot이 자동 승인할 수 있다.
 *  hard commit(원고 적용·canon 변경·픽스)은 여전히 human만 가능하다. */
export type PlanningApprover = 'human' | 'autopilot';
export type PlanningApproval = {
  status: PlanningApprovalStatus;
  updatedAt: string;
  approvedAt?: string;
  approvedBy: PlanningApprover;
};
export type ApprovedEpisodeBrief = EpisodeBrief & { bindery_approval?: PlanningApproval };
export type ApprovedScenePlan = ScenePlan & { bindery_approval?: PlanningApproval };
export type PlanningKind = 'brief' | 'scene-plan';

function embedJson(markdown: string, payload: unknown): string {
  return `${markdown.trimEnd()}\n\n<!-- bindery:json\n${JSON.stringify(payload, null, 2)}\n-->\n`;
}

function replaceEmbeddedJson(content: string, payload: unknown): string {
  const block = `<!-- bindery:json\n${JSON.stringify(payload, null, 2)}\n-->`;
  return JSON_BLOCK.test(content) ? content.replace(JSON_BLOCK, block) : `${content.trimEnd()}\n\n${block}\n`;
}

function withPlanningApproval<T extends object>(
  payload: T,
  status: PlanningApprovalStatus,
  by: PlanningApprover = 'human'
): T & { bindery_approval: PlanningApproval } {
  const previous = (payload as { bindery_approval?: PlanningApproval }).bindery_approval;
  return {
    ...payload,
    bindery_approval: {
      status,
      updatedAt: nowIso(),
      approvedAt: status === 'approved' ? (previous?.approvedAt ?? nowIso()) : undefined,
      approvedBy: by
    }
  };
}

export function approvalStatus(payload: { bindery_approval?: PlanningApproval } | null): PlanningApprovalStatus {
  return payload?.bindery_approval?.status === 'approved' ? 'approved' : 'draft';
}

export function extractEmbeddedJson<T>(content: string): T | null {
  const m = JSON_BLOCK.exec(content);
  if (!m) return null;
  try {
    return JSON.parse(m[1]) as T;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 회차 브리프
// ---------------------------------------------------------------------------

export function renderBriefMarkdown(b: EpisodeBrief): string {
  return [
    `# ${b.episode} 회차 브리프${b.source === 'local' ? ' (로컬 뼈대)' : ''}`,
    '',
    `- 목적: ${b.goal}`,
    `- POV: ${b.pov} · 목표 분량: ${b.target_length.toLocaleString()}자`,
    '',
    '## 필수 사건',
    ...b.must_events.map((e) => `- ${e}`),
    '',
    `## 등장 인물 · 장소`,
    `- 인물: ${b.characters.join(', ') || '(미정)'}`,
    `- 장소: ${b.locations.join(', ') || '(미정)'}`,
    '',
    '## 변화',
    `- 정보: ${b.knowledge_change.join(' / ') || '-'}`,
    `- 감정: ${b.emotion_change.join(' / ') || '-'}`,
    `- 갈등: ${b.conflict_change || '-'}`,
    '',
    '## 떡밥',
    ...(b.threads_touch.length ? b.threads_touch.map((t) => `- ${t}`) : ['- (없음)']),
    '',
    '## 금지 (이 회차에서 하면 안 되는 것)',
    ...(b.forbidden.length ? b.forbidden.map((f) => `- ${f}`) : ['- (없음)']),
    '',
    `## 마지막 hook`,
    b.exit_hook || '(미정)'
  ].join('\n');
}

function localBrief(ctxInfo: { episode: string; plotGoal: string; beats: string[]; threads: string[]; hook: string }): EpisodeBrief {
  return {
    schema_version: 'bindery.episode_brief.v1',
    episode: ctxInfo.episode,
    goal: ctxInfo.plotGoal || '(플롯 row가 없어 목적을 만들지 못했습니다 — 직접 채우세요)',
    must_events: ctxInfo.beats.length ? ctxInfo.beats : ['(필수 사건을 직접 정하세요)'],
    characters: [],
    locations: [],
    pov: '미정',
    knowledge_change: [],
    emotion_change: [],
    conflict_change: '',
    threads_touch: ctxInfo.threads,
    forbidden: [],
    target_length: 5000,
    exit_hook: ctxInfo.hook,
    source: 'local'
  };
}

export async function generateBrief(ctx: Ctx, episode: string, notes: string, targetLength: number): Promise<StageOutcome<ApprovedEpisodeBrief>> {
  const paths = episodePaths(episode);
  const base = await loadEpisodeContext(ctx, episode);
  const row = base.plotRow;
  // 바이블 통짜 clip 대신 로컬 관련도 선별 팩 — 설계 단계는 AI 정제 없이 결정적 선별만 쓴다.
  const pack = await buildEpisodeContextPack(ctx, episode, { note: notes });

  const outcome = await runStage(ctx, {
    stage: 'episode-brief',
    scope: episode,
    blueprint: BLUEPRINTS.episodeBrief,
    vars: {
      episode,
      plotRow: base.plotRowText,
      resumeState: base.resumeState,
      bible: pack.text,
      openThreads: base.openThreads,
      previousTail: base.previousTail,
      notes: notes || '(없음)',
      targetLength: String(targetLength)
    },
    parse: (text) => parseEpisodeBrief(text, episode),
    fallback: () => localBrief({ episode, plotGoal: row?.goal ?? '', beats: row?.beats ?? [], threads: [...(row?.threads_open ?? []), ...(row?.threads_close ?? [])], hook: row?.hook ?? '' }),
    repairHint: `{"schema_version":"bindery.episode_brief.v1","episode":"${episode}","goal":"...","must_events":["..."],"characters":[],"locations":[],"pov":"...","knowledge_change":[],"emotion_change":[],"conflict_change":"...","threads_touch":[],"forbidden":[],"target_length":${targetLength},"exit_hook":"..."}`
  });

  const approved = withPlanningApproval(outcome.output, 'draft');
  const content = embedJson(renderBriefMarkdown(approved), approved);
  await ctx.bridge.writeFile(ctx.root, paths.brief, content);
  await writeArtifact(ctx, episode, 'episode-brief', `회차 브리프${outcome.source === 'fallback' ? ' (로컬)' : ''}`, content, outcome.source);
  return { ...outcome, output: approved };
}

export async function loadBrief(ctx: Ctx, episode: string): Promise<ApprovedEpisodeBrief | null> {
  const content = await readOptional(ctx, episodePaths(episode).brief);
  if (!content) return null;
  return extractEmbeddedJson<ApprovedEpisodeBrief>(content);
}

export async function saveWebBrief(ctx: Ctx, brief: EpisodeBrief): Promise<ApprovedEpisodeBrief> {
  const paths = episodePaths(brief.episode);
  const payload = withPlanningApproval({ ...brief, source: 'web-import' as const }, 'draft');
  const content = embedJson(renderBriefMarkdown(payload), payload);
  await ctx.bridge.writeFile(ctx.root, paths.brief, content);
  await writeArtifact(ctx, brief.episode, 'episode-brief', '회차 브리프 (웹 교환)', content, 'web-import');
  return payload;
}

// ---------------------------------------------------------------------------
// 장면 계획
// ---------------------------------------------------------------------------

export function renderScenePlanMarkdown(p: ScenePlan): string {
  const lines = [`# ${p.episode} 장면 계획${p.source === 'local' ? ' (로컬 뼈대)' : ''}`, ''];
  for (const s of p.scenes) {
    lines.push(
      `## ${s.id} — ${s.purpose}`,
      `- 배경: ${s.setting || '-'} · 인물: ${s.characters.join(', ') || '-'}`,
      `- 갈등: ${s.conflict || '-'}`,
      `- turn: ${s.turn}`,
      `- 나르는 것: ${s.carries.join(', ') || '-'}`,
      `- 분량: ${s.target_length.toLocaleString()}자 · 출구: ${s.exit || '-'}`,
      ''
    );
  }
  if (p.risks.length) lines.push('## 리스크', ...p.risks.map((r) => `- ${r}`));
  return lines.join('\n');
}

export async function generateScenePlan(ctx: Ctx, episode: string): Promise<StageOutcome<ApprovedScenePlan> | { error: string }> {
  const brief = await loadBrief(ctx, episode);
  if (!brief) return { error: '회차 브리프가 없습니다. 브리프를 먼저 생성/작성하세요.' };
  if (approvalStatus(brief) !== 'approved') return { error: '회차 브리프를 먼저 명시적으로 승인하세요.' };
  const paths = episodePaths(episode);
  const outcome = await runStage(ctx, {
    stage: 'scene-plan',
    scope: episode,
    blueprint: BLUEPRINTS.scenePlan,
    vars: {
      episode,
      brief: renderBriefMarkdown(brief),
      styleGuide: clip(await readOptional(ctx, LAYOUT.style.guide), 2000)
    },
    parse: (text) => parseScenePlan(text, episode),
    fallback: () => ({
      schema_version: 'bindery.scene_plan.v1' as const,
      episode,
      scenes: brief.must_events.map((event, i) => ({
        id: `s${i + 1}`,
        purpose: event,
        setting: '',
        characters: brief.characters,
        conflict: '',
        turn: '(turn을 직접 정하세요)',
        carries: [event],
        target_length: Math.round(brief.target_length / Math.max(1, brief.must_events.length)),
        exit: ''
      })),
      risks: ['오프라인 뼈대 장면 계획 — 필수 사건을 1:1로 장면화했을 뿐입니다.'],
      source: 'local' as const
    }),
    repairHint: `{"schema_version":"bindery.scene_plan.v1","episode":"${episode}","scenes":[{"id":"s1","purpose":"...","setting":"...","characters":[],"conflict":"...","turn":"...","carries":[],"target_length":1200,"exit":"..."}],"risks":[]}`
  });
  const approved = withPlanningApproval(outcome.output, 'draft');
  const content = embedJson(renderScenePlanMarkdown(approved), approved);
  await ctx.bridge.writeFile(ctx.root, paths.scenePlan, content);
  await writeArtifact(ctx, episode, 'scene-plan', `장면 계획 ${outcome.output.scenes.length}장면${outcome.source === 'fallback' ? ' (로컬)' : ''}`, content, outcome.source);
  return { ...outcome, output: approved };
}

export async function loadScenePlan(ctx: Ctx, episode: string): Promise<ApprovedScenePlan | null> {
  const content = await readOptional(ctx, episodePaths(episode).scenePlan);
  if (!content) return null;
  return extractEmbeddedJson<ApprovedScenePlan>(content);
}

export async function saveWebScenePlan(ctx: Ctx, plan: ScenePlan): Promise<ApprovedScenePlan> {
  const paths = episodePaths(plan.episode);
  const payload = withPlanningApproval({ ...plan, source: 'web-import' as const }, 'draft');
  const content = embedJson(renderScenePlanMarkdown(payload), payload);
  await ctx.bridge.writeFile(ctx.root, paths.scenePlan, content);
  await writeArtifact(ctx, plan.episode, 'scene-plan', `장면 계획 ${plan.scenes.length}장면 (웹 교환)`, content, 'web-import');
  return payload;
}

export async function setPlanningApproval(
  ctx: Ctx,
  episode: string,
  kind: PlanningKind,
  status: PlanningApprovalStatus,
  by: PlanningApprover = 'human'
): Promise<ApprovedEpisodeBrief | ApprovedScenePlan> {
  const path = kind === 'brief' ? episodePaths(episode).brief : episodePaths(episode).scenePlan;
  const content = await ctx.bridge.readFile(ctx.root, path);
  const payload = kind === 'brief'
    ? extractEmbeddedJson<ApprovedEpisodeBrief>(content)
    : extractEmbeddedJson<ApprovedScenePlan>(content);
  if (!payload) throw new Error(`${kind} JSON 블록을 찾지 못했습니다`);
  const next = withPlanningApproval(payload, status, by);
  await ctx.bridge.writeFile(ctx.root, path, replaceEmbeddedJson(content, next));
  return next;
}

// ---------------------------------------------------------------------------
// 초안·수정 후보
// ---------------------------------------------------------------------------

export type CandidateFile = {
  id: string;
  label: string;
  path: string;
  episode: string;
  kind: 'draft' | 'revision';
  baselineHash: string;
  source: 'agent' | 'fallback' | 'web-import';
  createdAt: string;
  changeSummary: string;
  deltaCandidates: DraftCandidate['canon_delta_candidates'];
  /** 후보 카드 표시용 — 자체 점검에서 분리한 위험·미커버 장면 */
  risks?: string[];
  selfCheckScore?: number | null;
  charCount?: number;
  qualityStatus?: QualityStatus;
  qualityIssues?: string[];
};

function candidateQuality(text: string): Pick<CandidateFile, 'charCount' | 'qualityStatus' | 'qualityIssues'> {
  const report = scoreDraftQuality(text);
  return {
    charCount: report.chars,
    qualityStatus: report.status,
    qualityIssues: qualitySummary(report)
  };
}

export async function saveWebDraftCandidate(ctx: Ctx, episode: string, candidate: DraftCandidate): Promise<CandidateFile> {
  const paths = episodePaths(episode);
  const current = await readOptional(ctx, paths.manuscript);
  const id = stamp();
  const path = candidatePath(episode, `draft-web-${id}.md`);
  const meta: CandidateFile = {
    id,
    label: '웹 초안 후보',
    path,
    episode,
    kind: 'draft',
    baselineHash: contentHash(current),
    source: 'web-import',
    createdAt: nowIso(),
    changeSummary: candidate.change_summary,
    deltaCandidates: candidate.canon_delta_candidates,
    ...candidateQuality(candidate.manuscript_md)
  };
  await ctx.bridge.writeFile(ctx.root, path, embedJson(candidate.manuscript_md, { ...meta, source: 'web-import', canon_delta_candidates: candidate.canon_delta_candidates }));
  const existing = await loadCandidateIndex(ctx, episode);
  await saveCandidateIndex(ctx, episode, [meta, ...existing]);
  await writeArtifact(ctx, episode, 'draft-candidates', `웹 초안 후보 · ${path}`, `- 웹 교환 후보: ${path}`, 'web-import');
  return meta;
}

function localDraftFallback(episode: string, brief: EpisodeBrief | null): DraftCandidate {
  return {
    schema_version: 'bindery.draft_candidate.v1',
    episode,
    manuscript_md: [
      `# ${episode} (오프라인 뼈대)`,
      '',
      '> AI 실행기가 연결되지 않아 초안을 생성하지 못했습니다.',
      '> 아래 장면 뼈대를 따라 직접 쓰거나, 실행기 연결 후 다시 실행하세요.',
      '',
      ...(brief?.must_events ?? ['(필수 사건 없음)']).map((e, i) => `## 장면 ${i + 1}\n\n(${e})\n`)
    ].join('\n'),
    scene_coverage: [],
    canon_delta_candidates: [],
    style_self_check: { score: 0, notes: '오프라인 뼈대' },
    change_summary: '오프라인 뼈대 — 원고 아님',
    source: 'local'
  };
}

/** 라벨이 곧 접근 방향이다 — 단순 번호 후보 대신 의미 있는 변주를 만든다. */
export const CANDIDATE_APPROACHES: Record<string, string> = {
  정석안: '플롯과 장면 계획을 가장 안정적으로 수행한다. 설명량 중간, 마지막 훅을 선명하게.',
  추진안: '사건 전개 속도를 우선한다. 설명을 줄이고 장면 전환을 빠르게, 갈등을 앞당겨 배치한다.',
  감정안: '인물의 감정과 관계 변화를 강조한다. 내면 묘사와 대화의 밀도를 높이되 사건은 동일하게 유지한다.',
  압축안: '설명과 묘사를 줄이고 진행 중심으로 압축한다.',
  확장안: '묘사와 장면 밀도를 강화해 장면을 깊게 판다.',
  반전안: '기존 플롯 전개를 흔드는 대안적 전개를 시도한다. 확정 설정(canon)은 위반하지 않는다.'
};

export type DraftOptions = {
  /** 의미 라벨 목록. 지정하면 count 대신 이 목록 길이만큼 생성. */
  labels?: string[];
  /** true면 브리프·장면 계획 승인 게이트를 건너뛴다 (autopilot의 soft-output 정책). */
  skipApprovalGate?: boolean;
};

function candidateRisks(output: DraftCandidate): string[] {
  const risks: string[] = [];
  for (const cover of output.scene_coverage ?? []) {
    if (cover.covered === false) risks.push(`장면 ${cover.scene} 미커버${cover.note ? ` — ${cover.note}` : ''}`);
  }
  if (output.style_self_check?.notes && output.style_self_check.score > 0) {
    risks.push(output.style_self_check.notes);
  }
  return risks.slice(0, 4);
}

export async function generateDraftCandidates(
  ctx: Ctx,
  episode: string,
  count: number,
  notes: string,
  opts: DraftOptions = {}
): Promise<{ candidates: CandidateFile[]; error?: string }> {
  const brief = await loadBrief(ctx, episode);
  const scenePlan = await loadScenePlan(ctx, episode);
  if (!brief || !scenePlan) {
    return { candidates: [], error: '초안 전에 회차 브리프와 장면 계획이 있어야 합니다.' };
  }
  if (!opts.skipApprovalGate && (approvalStatus(brief) !== 'approved' || approvalStatus(scenePlan) !== 'approved')) {
    return { candidates: [], error: '초안 전에 회차 브리프와 장면 계획을 모두 승인해야 합니다.' };
  }
  const paths = episodePaths(episode);
  const base = await loadEpisodeContext(ctx, episode);
  const current = base.currentManuscript;
  const baseBody = parseFrontmatter(current).body ?? current;
  const baselineHash = contentHash(current);
  // 토큰 라우터: 로컬 관련도 선별 → (팩이 크면) 경량 모델 정제 캡슐.
  // 초안 후보는 2~3회 반복 실행되므로 여기서 줄인 사전 토큰이 그대로 배수로 절감된다.
  const packed = await prepareDraftContext(ctx, episode, {
    note: notes,
    extraQuery: `${brief.goal}\n${brief.must_events.join('\n')}\n${brief.characters.join(' ')}`
  });
  // 문체 라우팅: 활성 프리셋이 있으면 전역 분위기 + 이번 화 장면 유형에 맞는
  // 오버레이만 골라 캡슐로 주입한다. 없으면 기존 style-guide.md 그대로.
  const styleCapsule = await buildStyleCapsule(ctx, episode, scenePlan);
  const vars = {
    episode,
    brief: renderBriefMarkdown(brief),
    scenePlan: renderScenePlanMarkdown(scenePlan),
    resumeState: base.resumeState,
    previousSummary: base.previousSummary,
    previousTail: base.previousTail,
    bible: packed.capsule,
    openThreads: base.openThreads,
    styleGuide: styleCapsule?.text ?? base.styleGuide,
    currentManuscript: excerptWindow(baseBody, 8000) || '(빈 원고)',
    notes: notes || '(없음)',
    targetLength: String(brief.target_length),
    variation: ''
  };

  const labels = opts.labels?.length
    ? opts.labels.slice(0, 4)
    : ['후보 A', '후보 B', '후보 C', '후보 D'].slice(0, Math.max(1, Math.min(4, count)));
  const candidates: CandidateFile[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = labels[i];
    const approach = CANDIDATE_APPROACHES[label];
    const variation = approach
      ? `이번 후보의 접근은 「${label}」이다: ${approach}${i > 0 ? ' 이전 후보와 장면 진입점·리듬·묘사 초점을 다르게 하되 사건과 확정 설정은 동일하게 유지하라.' : ''}`
      : i === 0
        ? ''
        : `이번 후보는 ${i + 1}번째 변주다. 이전 후보와 다른 접근(장면 진입점, 리듬, 묘사 초점)을 시도하되 사건과 확정 설정은 동일하게 유지하라.`;
    const outcome = await runStage(ctx, {
      stage: i === 0 ? 'draft-candidate' : `draft-candidate-${i + 1}`,
      scope: episode,
      blueprint: BLUEPRINTS.draftCandidate,
      vars: { ...vars, variation },
      parse: (text) => parseDraftCandidate(text, episode, baseBody).candidate,
      fallback: () => localDraftFallback(episode, brief),
      repairHint: `{"schema_version":"bindery.draft_candidate.v1","episode":"${episode}","manuscript_md":"...","scene_coverage":[],"canon_delta_candidates":[],"style_self_check":{"score":0,"notes":""},"change_summary":"..."}`
    });
    const id = `${stamp()}-${i}`;
    const path = candidatePath(episode, `draft-${id}.md`);
    const meta: CandidateFile = {
      id,
      label,
      path,
      episode,
      kind: 'draft',
      baselineHash,
      source: outcome.source,
      createdAt: nowIso(),
      changeSummary: outcome.output.change_summary,
      deltaCandidates: outcome.output.canon_delta_candidates,
      risks: candidateRisks(outcome.output),
      selfCheckScore: outcome.output.style_self_check?.score ?? null,
      ...candidateQuality(outcome.output.manuscript_md)
    };
    await ctx.bridge.writeFile(ctx.root, path, embedJson(outcome.output.manuscript_md, { ...meta, canon_delta_candidates: outcome.output.canon_delta_candidates }));
    candidates.push(meta);
    // 폴백이면 후보를 더 만들어도 같은 뼈대만 나온다 — 정직하게 1개로 멈춘다.
    if (outcome.source === 'fallback') break;
  }
  await saveCandidateIndex(ctx, episode, candidates);
  await writeArtifact(ctx, episode, 'draft-candidates', `초안 후보 ${candidates.length}건`, candidates.map((c) => `- ${c.label}: ${c.path} (${c.source})`).join('\n'), candidates[0]?.source ?? 'fallback');
  return { candidates };
}

export async function generateRevisionCandidate(ctx: Ctx, episode: string, plan: RevisionPlan): Promise<{ candidate: CandidateFile | null; error?: string }> {
  const paths = episodePaths(episode);
  const current = await readOptional(ctx, paths.manuscript);
  if (!current.trim()) return { candidate: null, error: '수정할 원고가 없습니다.' };
  const accepted = plan.items.filter((i) => i.accepted);
  if (!accepted.length) return { candidate: null, error: '수용된 수정 항목이 없습니다.' };
  const baseBody = parseFrontmatter(current).body ?? current;
  // 수정 후보도 초안과 같은 문체 라우팅을 탄다 — 수정 과정에서 결이 흔들리지 않게.
  const styleCapsule = await buildStyleCapsule(ctx, episode, await loadScenePlan(ctx, episode));

  const outcome = await runStage(ctx, {
    stage: 'revision-candidate',
    scope: episode,
    blueprint: BLUEPRINTS.revisionCandidate,
    vars: {
      episode,
      revisionPlan: accepted.map((i) => `- [${i.id}][${i.severity}] ${i.instruction}${i.target ? ` (위치: ${i.target})` : ''}`).join('\n'),
      manuscript: baseBody,
      styleGuide: styleCapsule?.text ?? clip(await readOptional(ctx, LAYOUT.style.guide), 2000)
    },
    parse: (text) => parseDraftCandidate(text, episode, '').candidate,
    fallback: () => localDraftFallback(episode, null),
    repairHint: `{"schema_version":"bindery.draft_candidate.v1","episode":"${episode}","manuscript_md":"...","scene_coverage":[],"canon_delta_candidates":[],"style_self_check":{"score":0,"notes":""},"change_summary":"반영 항목: r1, r2"}`
  });
  if (outcome.source === 'fallback') {
    return { candidate: null, error: 'AI 실행기 없이는 수정 후보를 만들 수 없습니다 (원고 훼손 방지를 위해 뼈대 대체를 하지 않습니다).' };
  }
  const id = stamp();
  const path = candidatePath(episode, `revision-${id}.md`);
  const meta: CandidateFile = {
    id,
    label: '수정 후보',
    path,
    episode,
    kind: 'revision',
    baselineHash: contentHash(current),
    source: 'agent',
    createdAt: nowIso(),
    changeSummary: outcome.output.change_summary,
    deltaCandidates: outcome.output.canon_delta_candidates,
    ...candidateQuality(outcome.output.manuscript_md)
  };
  await ctx.bridge.writeFile(ctx.root, path, embedJson(outcome.output.manuscript_md, meta));
  const existing = await loadCandidateIndex(ctx, episode);
  await saveCandidateIndex(ctx, episode, [meta, ...existing]);
  return { candidate: meta };
}

const candidateIndexPath = (episode: string): string => candidatePath(episode, 'index.json');

export async function loadCandidateIndex(ctx: Ctx, episode: string): Promise<CandidateFile[]> {
  try {
    const path = candidateIndexPath(episode);
    if (!(await ctx.bridge.exists(ctx.root, path))) return [];
    return JSON.parse(await ctx.bridge.readFile(ctx.root, path)) as CandidateFile[];
  } catch {
    return [];
  }
}

async function saveCandidateIndex(ctx: Ctx, episode: string, list: CandidateFile[]): Promise<void> {
  await ctx.bridge.writeFile(ctx.root, candidateIndexPath(episode), JSON.stringify(list.slice(0, 30), null, 2));
}

export async function readCandidateBody(ctx: Ctx, candidate: CandidateFile): Promise<string> {
  const raw = await ctx.bridge.readFile(ctx.root, candidate.path);
  return raw.replace(JSON_BLOCK, '').trim();
}

/** 후보(또는 hunk 선택 결과) 텍스트를 원고에 적용한다. 스냅샷 선행. */
export async function applyToManuscript(ctx: Ctx, episode: string, nextBody: string, label: string): Promise<void> {
  const paths = episodePaths(episode);
  await snapshotFile(ctx, paths.manuscript, label, episode);
  const current = await readOptional(ctx, paths.manuscript);
  const fm = parseFrontmatter(current);
  const head = fm.present ? current.slice(0, current.length - fm.body.length) : `---\nepisode: ${episode}\nstatus: drafting\n---\n\n`;
  await ctx.bridge.writeFile(ctx.root, paths.manuscript, head + nextBody.trim() + '\n');
}

// ---------------------------------------------------------------------------
// QA (3관점) · 수정 계획
// ---------------------------------------------------------------------------

export async function runQA(ctx: Ctx, episode: string, aspect: QAAspect, target: { label: string; content: string }): Promise<StageOutcome<Omit<QAReport, 'targetLabel' | 'contentHash'>>> {
  const brief = await loadBrief(ctx, episode);
  const scenePlan = await loadScenePlan(ctx, episode);
  const manuscript = excerptWindow(parseFrontmatter(target.content).body || target.content, 13000);
  const common = { episode, targetLabel: target.label, manuscript };

  const spec = aspect === 'style'
    ? {
        blueprint: BLUEPRINTS.qaStyle,
        vars: {
          ...common,
          styleGuide: clip(await readOptional(ctx, LAYOUT.style.guide), 2500) || '(스타일 지침 없음)',
          exitHook: brief?.exit_hook ?? '(브리프 없음)'
        }
      }
    : aspect === 'continuity'
      ? {
          blueprint: BLUEPRINTS.qaContinuity,
          vars: {
            ...common,
            brief: brief ? renderBriefMarkdown(brief) : '(브리프 없음)',
            scenePlan: scenePlan ? renderScenePlanMarkdown(scenePlan) : '(장면 계획 없음)',
            resumeState: clip(await readOptional(ctx, LAYOUT.status.resume), 3500)
          }
        }
      : {
          blueprint: BLUEPRINTS.qaCanon,
          vars: {
            ...common,
            bible: clip(await readOptional(ctx, LAYOUT.canon.bible), 7000) || '(바이블 없음)',
            rules: clip(await readOptional(ctx, LAYOUT.world.rules), 2000) || '(규칙 문서 없음)'
          }
        };

  const outcome = await runStage(ctx, {
    stage: `qa-${aspect}`,
    scope: episode,
    blueprint: spec.blueprint,
    vars: spec.vars,
    parse: (text) => parseQAReport(text, aspect, episode),
    fallback: () => ({
      schema_version: 'bindery.qa_report.v1' as const,
      aspect,
      episode,
      gates: [{ id: 'offline', score: 0, verdict: 'warn' as const, issues: [{ severity: 'info' as const, summary: 'AI 실행기 미연결로 QA를 수행하지 못했습니다.', evidence: '', location: '', suggestion: '실행기 연결 후 다시 실행하세요.' }] }],
      overall: { score: 0, verdict: 'warn' as const, note: '오프라인 — 판정 아님' },
      source: 'agent' as const
    }),
    repairHint: `{"schema_version":"bindery.qa_report.v1","aspect":"${aspect}","episode":"${episode}","gates":[{"id":"...","score":0,"verdict":"pass","issues":[{"severity":"warn","summary":"...","evidence":"...","location":"...","suggestion":"..."}]}],"overall":{"score":0,"verdict":"pass","note":""}}`
  });

  const report: QAReport = {
    ...outcome.output,
    source: outcome.source === 'agent' ? 'agent' : 'local',
    targetLabel: target.label,
    contentHash: contentHash(target.content)
  } as QAReport;
  await writeArtifact(ctx, episode, `qa-${aspect}`, `QA(${aspect}) ${report.overall.verdict} ${report.overall.score} · ${target.label}`, renderQAMarkdown(report), outcome.source);
  return { ...outcome, output: report };
}

export function renderQAMarkdown(r: QAReport): string {
  const lines = [
    `# ${r.episode} QA — ${r.aspect}`,
    '',
    `- 대상: ${r.targetLabel} (hash ${r.contentHash})`,
    `- 종합: **${r.overall.verdict}** (${r.overall.score}) ${r.overall.note}`,
    ''
  ];
  for (const gate of r.gates) {
    lines.push(`## ${gate.id} — ${gate.verdict} (${gate.score})`);
    for (const issue of gate.issues) {
      lines.push(`- [${issue.severity}] ${issue.summary}`);
      if (issue.evidence) lines.push(`  - 근거: ${issue.evidence}`);
      if (issue.suggestion) lines.push(`  - 제안: ${issue.suggestion}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

export async function generateRevisionPlanStage(ctx: Ctx, episode: string, reports: QAReport[], rejectedSummaries: string[]): Promise<StageOutcome<RevisionPlan>> {
  const qaIssues = reports
    .flatMap((r) => r.gates.flatMap((g) => g.issues.map((i) => ({ aspect: r.aspect, gate: g.id, ...i }))))
    .filter((i) => i.severity !== 'info')
    .map((i) => `- [${i.severity}][${i.aspect}/${i.gate}] ${i.summary}${i.evidence ? ` — 근거: ${i.evidence}` : ''}`)
    .join('\n');
  const outcome = await runStage(ctx, {
    stage: 'revision-plan',
    scope: episode,
    blueprint: BLUEPRINTS.revisionPlan,
    vars: {
      episode,
      qaIssues: qaIssues || '(이슈 없음 — 리듬·반복 관점의 개선 항목을 스스로 제안하라)',
      humanDecisions: rejectedSummaries.length ? `기각된 이슈: ${rejectedSummaries.join('; ')}` : '(기각된 이슈 없음)'
    },
    parse: (text) => parseRevisionPlan(text, episode),
    fallback: () => ({
      schema_version: 'bindery.revision_plan.v1' as const,
      episode,
      items: reports
        .flatMap((r) => r.gates.flatMap((g) => g.issues))
        .filter((i) => i.severity === 'fail' || i.severity === 'warn')
        .slice(0, 10)
        .map((i, n) => ({ id: `r${n + 1}`, severity: i.severity as 'fail' | 'warn', instruction: i.suggestion || i.summary, target: i.location, source_gate: '', accepted: true })),
      note: '오프라인 — QA 이슈를 기계적으로 옮긴 계획입니다.',
      source: 'local' as const
    }),
    repairHint: `{"schema_version":"bindery.revision_plan.v1","episode":"${episode}","items":[{"id":"r1","severity":"fail","instruction":"...","target":"...","source_gate":"..."}],"note":""}`
  });
  await writeArtifact(ctx, episode, 'revision-plan', `수정 계획 ${outcome.output.items.length}건`, [
    `# ${episode} 수정 계획`,
    '',
    ...outcome.output.items.map((i) => `- [ ] [${i.severity}] ${i.instruction}${i.target ? ` (${i.target})` : ''}`),
    '',
    outcome.output.note
  ].join('\n'), outcome.source);
  return outcome;
}

// ---------------------------------------------------------------------------
// 헬퍼
// ---------------------------------------------------------------------------

export async function readSummary(ctx: Ctx, episode: string): Promise<string> {
  return readOptional(ctx, summaryPath(episode));
}
