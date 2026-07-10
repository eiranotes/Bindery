// autopilot — 기존 stage들을 상황에 맞게 묶어 실행하는 UX-first 실행 레이어.
//
// 원칙 (docs/ux/autopilot_pipeline_redesign.md):
// - Soft output(브리프·장면 계획·QA·수정 계획·요약)은 자동 생성·자동 승인해도 된다.
// - Hard commit(원고 반영·canon 변경·픽스)은 절대 여기서 자동 확정하지 않는다.
//   후보/제안/체크리스트를 만들어 돌려주고, 확정은 UI의 명시적 버튼이 한다.
// - 모든 중간 산출물은 기존 stage가 만드는 파일로 그대로 남는다 (근거 보기에서 열람).
import { LAYOUT, episodePaths } from '$lib/core/layout';
import { parseFrontmatter } from '$lib/core/text';
import {
  generateBrief, generateScenePlan, generateDraftCandidates, generateRevisionCandidate,
  loadBrief, loadScenePlan, setPlanningApproval, approvalStatus, runQA,
  generateRevisionPlanStage, applyToManuscript, readCandidateBody, loadCandidateIndex,
  type CandidateFile
} from './episode';
import { summarizeEpisode, proposeCanonDelta, fixEpisode, loadProgress, setProgress } from './closeout';
import { discoverIdeas, listIdeas, moveIdea, type IdeaFile } from './ideas';
import { expandWorld } from './world';
import { assembleBible, applyBibleCandidate, collectAssetFiles } from './bible';
import { loadPlotPlan, proposePlot } from './plot';
import { applyProposal, decideItem, type CanonDeltaRecord, type ItemDecision } from './proposals';
import { hasSubstance, loadEpisodeContext, nextEpisode } from './context';
import { readOptional } from './project';
import type { QAAspect, QAReport, RevisionPlan } from '$lib/schemas/contracts';
import type { Ctx } from './types';

export const DEFAULT_CANDIDATE_LABELS = ['집필안'] as const;

// ---------------------------------------------------------------------------
// 회차 autopilot — 설계(브리프·장면 계획) 자동 + 초안 후보 1개
// ---------------------------------------------------------------------------

export type EpisodeAutopilotResult = {
  episode: string;
  candidates: CandidateFile[];
  recommendedId: string | null;
  /** 접힌 "생성 근거 보기"가 여는 파일들 */
  evidence: { briefPath: string; scenePlanPath: string };
  /** 비어 있는 기초자료 이름 — 실행은 막지 않지만 사용자에게 알린다 */
  contextMissing: string[];
  error?: string;
};

export type FoundationResult = {
  assets: number;
  selectedIdeas: number;
  bibleCreated: boolean;
  bibleSource: 'existing' | 'agent' | 'fallback' | 'none';
  plotCreated: boolean;
  plotSource: 'existing' | 'agent' | 'fallback' | 'none';
  plotEpisodes: number;
};

function episodeNumber(episode: string | undefined): number {
  const n = parseInt((episode ?? '').replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

/** 회차 폴더가 없으면 만든다 (원고 템플릿 + 작업 노트). */
export async function ensureEpisodeScaffold(ctx: Ctx, episode: string): Promise<void> {
  const paths = episodePaths(episode);
  if (!(await ctx.bridge.exists(ctx.root, paths.manuscript))) {
    await ctx.bridge.writeFile(ctx.root, paths.manuscript, `---\nepisode: ${episode}\nstatus: planned\n---\n\n# ${episode}\n\n`);
  }
  if (!(await ctx.bridge.exists(ctx.root, paths.index))) {
    await ctx.bridge.writeFile(ctx.root, paths.index, `# ${episode} 작업 노트\n\n- 상태: 기획\n`);
  }
}

/**
 * 버튼 하나로 다음 회차 후보를 만든다.
 * 브리프/장면 계획이 없으면 생성하고 soft-output 정책에 따라 autopilot이 승인 표시를 남긴다.
 * 원고에는 절대 손대지 않는다 — 후보 파일만 만든다.
 */
export async function runEpisodeAutopilot(
  ctx: Ctx,
  opts: { episode: string; userNote?: string; candidateCount?: 1; targetLength?: number; regeneratePlan?: boolean }
): Promise<EpisodeAutopilotResult> {
  const { episode } = opts;
  const note = opts.userNote?.trim() ?? '';
  const paths = episodePaths(episode);
  await ensureEpisodeScaffold(ctx, episode);
  const base = await loadEpisodeContext(ctx, episode);
  const missingFoundation = base.missing.filter((m) => m === '설정 바이블' || m === `플롯 계획(${episode})`);
  if (missingFoundation.length) {
    return {
      episode,
      candidates: [],
      recommendedId: null,
      evidence: { briefPath: paths.brief, scenePlanPath: paths.scenePlan },
      contextMissing: base.missing,
      error: `집필 전에 ${missingFoundation.join(', ')} 준비가 필요합니다.`
    };
  }

  // 1) 설계 — 있으면 재사용, 없거나 재생성 요청이면 생성 후 autopilot 승인(soft output)
  let brief = opts.regeneratePlan ? null : await loadBrief(ctx, episode);
  if (!brief) {
    const r = await generateBrief(ctx, episode, note, opts.targetLength ?? 5000);
    brief = r.output;
  }
  if (approvalStatus(brief) !== 'approved') {
    await setPlanningApproval(ctx, episode, 'brief', 'approved', 'autopilot');
  }

  let scenePlan = opts.regeneratePlan ? null : await loadScenePlan(ctx, episode);
  if (!scenePlan) {
    const r = await generateScenePlan(ctx, episode);
    if ('error' in r) {
      return { episode, candidates: [], recommendedId: null, evidence: { briefPath: paths.brief, scenePlanPath: paths.scenePlan }, contextMissing: base.missing, error: r.error };
    }
    scenePlan = r.output;
  }
  if (approvalStatus(scenePlan) !== 'approved') {
    await setPlanningApproval(ctx, episode, 'scene-plan', 'approved', 'autopilot');
  }

  // 2) 간단 모드는 초안 후보 1개가 기본이다. 필요하면 설계자 모드에서 추가 후보를 만든다.
  const labels = [...DEFAULT_CANDIDATE_LABELS].slice(0, opts.candidateCount ?? 1);
  const { candidates, error } = await generateDraftCandidates(ctx, episode, labels.length, note, {
    labels,
    skipApprovalGate: true
  });

  // 3) 추천 — 자체 점검 점수가 가장 높은 후보 (동률이면 정석안 우선)
  const agentCandidates = candidates.filter((c) => c.source === 'agent');
  const recommended = agentCandidates.length
    ? [...agentCandidates].sort((a, b) => (b.selfCheckScore ?? 0) - (a.selfCheckScore ?? 0))[0]
    : null;

  const progress = await loadProgress(ctx);
  if (progress[episode]?.status !== 'fixed') {
    await setProgress(ctx, episode, { status: 'drafting' });
  }

  return {
    episode,
    candidates,
    recommendedId: recommended?.id ?? null,
    evidence: { briefPath: paths.brief, scenePlanPath: paths.scenePlan },
    contextMissing: base.missing,
    error
  };
}

/** 후보 적용 — 유일하게 원고를 건드리는 경로. 스냅샷 선행. 사람이 버튼으로만 호출한다. */
export async function applyCandidateToManuscript(ctx: Ctx, candidate: CandidateFile): Promise<void> {
  const body = await readCandidateBody(ctx, candidate);
  await applyToManuscript(ctx, candidate.episode, body, `${candidate.label} 적용`);
}

// ---------------------------------------------------------------------------
// 검토·수정 autopilot — QA 3종 병렬 실행 + 체크리스트
// ---------------------------------------------------------------------------

export type RevisionAutopilotResult = {
  episode: string;
  reports: QAReport[];
  plan: RevisionPlan | null;
  error?: string;
};

/** QA 3종(문체·연속성·정사)을 병렬 실행하고 체크박스형 수정 계획을 돌려준다.
 *  AI 추천 항목은 기본 체크(accepted: true) 상태다. 원고는 건드리지 않는다. */
export async function runRevisionAutopilot(
  ctx: Ctx,
  opts: { episode: string; userNote?: string }
): Promise<RevisionAutopilotResult> {
  const { episode } = opts;
  const content = await readOptional(ctx, episodePaths(episode).manuscript);
  if (!parseFrontmatter(content).body.trim()) {
    return { episode, reports: [], plan: null, error: '검토할 원고가 없습니다.' };
  }
  // 세 관점은 같은 원고를 읽고 서로의 출력을 소비하지 않으므로 병렬 실행한다.
  // run/usage 영속화는 runner의 큐가 직렬화해 index read-modify-write 경합을 막는다.
  const aspects = ['style', 'continuity', 'canon'] as QAAspect[];
  const reports = await Promise.all(aspects.map(async (aspect) => {
    const r = await runQA(ctx, episode, aspect, { label: '현재 원고', content });
    return r.output as QAReport;
  }));
  const planOutcome = await generateRevisionPlanStage(
    ctx, episode, reports,
    opts.userNote?.trim() ? [`작가 지시: ${opts.userNote.trim()}`] : []
  );
  const plan: RevisionPlan = {
    ...planOutcome.output,
    items: planOutcome.output.items.map((i) => ({ ...i, accepted: i.accepted ?? true }))
  };
  return { episode, reports, plan };
}

/** 체크된 항목만으로 수정 후보를 만든다. 원고 반영은 UI의 diff/적용 버튼이 별도로 한다. */
export async function buildRevisionCandidate(
  ctx: Ctx,
  episode: string,
  plan: RevisionPlan
): Promise<{ candidate: CandidateFile | null; error?: string }> {
  return generateRevisionCandidate(ctx, episode, plan);
}

// ---------------------------------------------------------------------------
// 마감 autopilot — 요약 + 설정 변경 후보 + 추천 체크. 픽스는 사람 확정.
// ---------------------------------------------------------------------------

export type CloseoutCard = {
  episode: string;
  summaryText: string;
  summarySource: 'agent' | 'fallback';
  /** 정사 변경 proposal (승인 대기) — 없으면 이 회차의 설정 변경 후보 없음 */
  proposal: CanonDeltaRecord | null;
  /** proposal.payload.changes와 1:1 — AI 추천 체크 상태 (risk high만 기본 해제) */
  recommendedChecks: boolean[];
  nextEpisode: string;
};

export async function runCloseEpisodeAutopilot(ctx: Ctx, episode: string): Promise<CloseoutCard> {
  const summaryOutcome = await summarizeEpisode(ctx, episode);
  const candidates = await loadCandidateIndex(ctx, episode);
  const deltas = candidates.flatMap((c) => c.deltaCandidates ?? []);
  const { proposal } = await proposeCanonDelta(ctx, episode, deltas);
  return {
    episode,
    summaryText: summaryOutcome.output,
    summarySource: summaryOutcome.source,
    proposal,
    recommendedChecks: proposal ? proposal.payload.changes.map((c) => c.risk !== 'high') : [],
    nextEpisode: nextEpisode(episode)
  };
}

/**
 * 마감 확정 — 사람이 버튼으로 호출하는 hard commit.
 * 체크된 정사 변경만 승인·반영(스냅샷 선행)하고, 나머지는 보류함(pending)에 남긴다.
 * 이후 회차를 픽스하고 재개 상태를 갱신한다.
 */
export async function finalizeCloseEpisode(
  ctx: Ctx,
  card: CloseoutCard,
  checks: boolean[]
): Promise<{ appliedChanges: number; heldChanges: number }> {
  let applied = 0;
  let held = 0;
  if (card.proposal) {
    let proposal = card.proposal;
    for (let i = 0; i < proposal.payload.changes.length; i++) {
      const decision: ItemDecision = checks[i] ? 'approved' : 'pending';
      proposal = decideItem(proposal, i, decision);
      if (checks[i]) applied++;
      else held++;
    }
    if (applied > 0) {
      await applyProposal(ctx, proposal);
    }
  }
  await fixEpisode(ctx, card.episode);
  return { appliedChanges: applied, heldChanges: held };
}

// ---------------------------------------------------------------------------
// 작품 시작 autopilot — 기획 후보 1개 → 채택 시 세계관·바이블·플롯 자동 구성
// ---------------------------------------------------------------------------

export type StarterResult = {
  ideas: IdeaFile[];
  error?: string;
};

/** 한 줄 메모(비워도 됨)로 기획 후보를 만든다. 파일은 ideas/inbox에 남는다. */
export async function runProjectStarterAutopilot(ctx: Ctx, userNote: string): Promise<StarterResult> {
  const { files } = await discoverIdeas(ctx, {
    genres: '', mood: '', cliches: '', readerExperience: '', avoid: '',
    notes: userNote.trim() || '(자유 기획 — 장기 연재에 강한 소재를 제안하라)',
    count: 1
  }, []);
  if (!files.length) return { ideas: [], error: '기획 후보를 만들지 못했습니다.' };
  return { ideas: files };
}

/** 라이트모드의 "바이블과 플롯 준비" 버튼이 호출하는 단일 준비 경로.
 *  실질 바이블이 없으면 후보를 만들고 명시 액션의 결과로 적용한다. 플롯이 없거나
 *  바이블을 새로 만들었거나 현재 회차 row가 없으면 그 바이블을 입력으로 플롯을 다시 제안한다. */
export async function ensureStoryFoundation(
  ctx: Ctx,
  opts: { title: string; notes?: string; episode?: string; episodeCount?: number; forcePlot?: boolean }
): Promise<FoundationResult> {
  const [assets, ideas, bibleRaw, existingPlot] = await Promise.all([
    collectAssetFiles(ctx),
    listIdeas(ctx),
    readOptional(ctx, LAYOUT.canon.bible),
    loadPlotPlan(ctx)
  ]);
  const selectedIdeas = ideas.filter((i) => i.status === 'selected');
  let bibleSource: FoundationResult['bibleSource'] = hasSubstance(bibleRaw) ? 'existing' : 'none';
  let bibleCreated = false;

  if (!hasSubstance(bibleRaw)) {
    const { candidatePath: biblePath, outcome } = await assembleBible(ctx, opts.title, selectedIdeas);
    await applyBibleCandidate(ctx, biblePath);
    bibleSource = outcome.source;
    bibleCreated = true;
  }

  const targetEpisode = opts.episode;
  const targetHasPlotRow = targetEpisode
    ? Boolean(existingPlot?.episodes.some((row) => row.episode === targetEpisode))
    : true;
  const shouldPlan =
    opts.forcePlot ||
    bibleCreated ||
    !existingPlot?.episodes.length ||
    !targetHasPlotRow;

  let plotSource: FoundationResult['plotSource'] = existingPlot?.episodes.length ? 'existing' : 'none';
  let plotEpisodes = existingPlot?.episodes.length ?? 0;
  if (shouldPlan) {
    const count = Math.max(opts.episodeCount ?? 8, episodeNumber(targetEpisode), plotEpisodes || 0);
    const notes = [
      opts.notes?.trim(),
      selectedIdeas.length ? `채택 기획: ${selectedIdeas.map((i) => `${i.seed.title} - ${i.seed.hook}`).join(' / ')}` : '',
      bibleCreated ? '바이블을 방금 조립했으므로 이 바이블을 기준으로 플롯을 정렬한다.' : ''
    ].filter(Boolean).join('\n');
    const plot = await proposePlot(ctx, count || 8, notes || '라이트모드 준비: 현재 바이블을 기준으로 플롯을 구성한다.');
    plotSource = plot.source;
    plotEpisodes = plot.output.episodes.length;
  }

  return {
    assets: assets.length,
    selectedIdeas: selectedIdeas.length,
    bibleCreated,
    bibleSource,
    plotCreated: shouldPlan,
    plotSource,
    plotEpisodes
  };
}

/**
 * 기획 채택 — 사용자가 후보 카드를 고르는 것이 "작품 방향 확정"이라는 단일 승인 지점이다.
 * 채택 소재를 근거로 세계관 자산·바이블·플롯 초안을 자동 구성한다.
 * (자산 반영·바이블 교체는 스냅샷/proposal 경로를 그대로 통과한다.)
 */
export async function adoptStarterIdea(
  ctx: Ctx,
  idea: IdeaFile,
  title: string
): Promise<{ assets: number; plotEpisodes: number; bibleSource: 'agent' | 'fallback' | 'none' }> {
  const selected = idea.status === 'selected' ? idea : await moveIdea(ctx, idea, 'selected');

  // 세계관 확장 proposal — 채택이 곧 방향 확정이므로 전 항목 승인 후 반영(파일별 스냅샷 선행)
  const { proposal } = await expandWorld(ctx, [selected], '');
  let approvedAssets = 0;
  let bibleSource: 'agent' | 'fallback' | 'none' = 'none';
  if (proposal.source !== 'fallback') {
    let decided = proposal;
    for (let i = 0; i < proposal.payload.assets.length; i++) {
      decided = decideItem(decided, i, 'approved');
      approvedAssets++;
    }
    await applyProposal(ctx, decided);
  }

  // 세계관 확장이 실패해도 채택 기획 자체로 로컬 바이블을 조립한다.
  // 빈 템플릿을 근거로 플롯을 생성하는 경로를 허용하지 않는다.
  const { candidatePath: biblePath, outcome } = await assembleBible(ctx, title, [selected]);
  await applyBibleCandidate(ctx, biblePath);
  bibleSource = outcome.source;

  // 플롯 초안 — row는 draft 상태로 남는다 (진행 확정은 hard commit이므로 자동 승인하지 않음)
  const plot = await proposePlot(ctx, 8, `채택 기획: ${selected.seed.title} — ${selected.seed.hook}`);
  return { assets: approvedAssets, plotEpisodes: plot.output.episodes.length, bibleSource };
}
