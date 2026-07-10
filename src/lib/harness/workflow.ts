// workflow — 프로젝트 상태를 읽고 "사용자가 지금 해야 할 다음 행동 하나"를 계산한다.
// UI는 이 계산 결과만 보여준다. 파이프라인 단계를 사용자에게 조작시키지 않는 것이 원칙.
import { LAYOUT, episodePaths, summaryPath } from '$lib/core/layout';
import { parseFrontmatter } from '$lib/core/text';
import { readOptional, listEpisodes } from './project';
import { loadPlotPlan } from './plot';
import { loadProgress, type EpisodeProgress } from './closeout';
import { loadCandidateIndex, type CandidateFile } from './episode';
import { loadProposals, pendingCount } from './proposals';
import { hasSubstance, nextEpisode } from './context';
import { collectAssetFiles } from './bible';
import { listIdeas } from './ideas';
import { inferResumeNextEpisode } from './sourcePackage';
import type { Ctx } from './types';

/** 간단 모드가 노출하는 사용자 액션의 전부. 세부 stage는 여기 없다. */
export type UserAction =
  | 'startProject'
  | 'prepareStoryFoundation'
  | 'writeNextEpisode'
  | 'regenerateCandidates'
  | 'applyCandidate'
  | 'reviseCurrentDraft'
  | 'applyRevision'
  | 'closeEpisode'
  | 'reviewPendingChanges'
  | 'directEdit'
  | 'openAdvancedDetails';

export type WorkflowSnapshot = {
  hasBible: boolean;
  hasPlot: boolean;
  targetHasPlotRow: boolean;
  assetCount: number;
  selectedIdeaCount: number;
  episodes: string[];
  progress: EpisodeProgress;
  /** 작업 대상 회차 (첫 미픽스 회차) */
  targetEpisode: string;
  targetHasManuscript: boolean;
  targetHasSummary: boolean;
  targetCandidates: CandidateFile[];
  pendingProposals: number;
};

export type NextStep = {
  action: UserAction;
  episode: string | null;
  /** 홈 CTA 제목 — "ep012를 이어 쓸 차례입니다." */
  title: string;
  detail: string;
  /** 버튼 문구 — "이번 화 쓰기" */
  cta: string;
};

export async function loadWorkflowSnapshot(ctx: Ctx): Promise<WorkflowSnapshot> {
  const [bible, plot, episodes, progress, proposals, assets, ideas, resumeState] = await Promise.all([
    readOptional(ctx, LAYOUT.canon.bible),
    loadPlotPlan(ctx),
    listEpisodes(ctx),
    loadProgress(ctx),
    loadProposals(ctx),
    collectAssetFiles(ctx),
    listIdeas(ctx),
    readOptional(ctx, LAYOUT.status.resume)
  ]);
  const eps = episodes.length ? episodes : ['ep001'];
  const lastFixed = [...eps].reverse().find((e) => progress[e]?.status === 'fixed') ?? null;
  const resumeTarget = inferResumeNextEpisode(resumeState);
  const target =
    (resumeTarget && progress[resumeTarget]?.status !== 'fixed' ? resumeTarget : null) ??
    eps.find((e) => progress[e]?.status !== 'fixed') ??
    (lastFixed ? nextEpisode(lastFixed) : eps[eps.length - 1]);
  const manuscript = await readOptional(ctx, episodePaths(target).manuscript);
  const body = parseFrontmatter(manuscript).body?.trim() ?? '';
  const hasManuscript = body.replace(/^#.*$/gm, '').replace(/\(원고가 아직 없습니다.*?\)/s, '').trim().length > 0;
  return {
    hasBible: hasSubstance(bible),
    hasPlot: (plot?.episodes.length ?? 0) > 0,
    targetHasPlotRow: Boolean(plot?.episodes.some((e) => e.episode === target)),
    assetCount: assets.length,
    selectedIdeaCount: ideas.filter((i) => i.status === 'selected').length,
    episodes: eps,
    progress,
    targetEpisode: target,
    targetHasManuscript: hasManuscript,
    targetHasSummary: (await readOptional(ctx, summaryPath(target))).trim().length > 0,
    targetCandidates: await loadCandidateIndex(ctx, target),
    pendingProposals: pendingCount(proposals)
  };
}

/** 순수 함수 — 상태에서 메인 CTA 하나를 결정한다. 보류함은 보조 카드로 항상 병기된다. */
export function computeNextStep(s: WorkflowSnapshot): NextStep {
  const anyProgress = Object.values(s.progress).some((p) => p.status === 'fixed' || p.status === 'drafting');
  if (
    !s.hasBible &&
    !s.hasPlot &&
    !anyProgress &&
    !s.targetHasManuscript &&
    s.targetCandidates.length === 0 &&
    s.assetCount === 0 &&
    s.selectedIdeaCount === 0
  ) {
    return {
      action: 'startProject',
      episode: null,
      title: '새 작품을 시작할 차례입니다.',
      detail: '한 줄 방향만 적으면 AI가 기획 후보를 만듭니다. 비워두면 자유 기획으로 진행합니다.',
      cta: 'AI에게 기획 맡기기'
    };
  }
  const ep = s.targetEpisode;
  if (!s.hasBible || !s.targetHasPlotRow) {
    const missing = [
      !s.hasBible ? '바이블' : '',
      !s.targetHasPlotRow ? `${ep} 플롯` : ''
    ].filter(Boolean).join(', ');
    return {
      action: 'prepareStoryFoundation',
      episode: ep,
      title: '작품 기준을 먼저 세울 차례입니다.',
      detail: `${missing}이 비어 있습니다. 작품노트와 채택 자산을 바이블로 조립하고, 그 바이블로 플롯을 정리한 뒤 이번 화를 씁니다.`,
      cta: '바이블과 플롯 준비하고 쓰기'
    };
  }
  const freshDraftCandidates = s.targetCandidates.filter((c) => c.kind === 'draft');
  if (!s.targetHasManuscript && freshDraftCandidates.length > 0) {
    return {
      action: 'applyCandidate',
      episode: ep,
      title: `${ep} 원고 후보가 준비됐습니다.`,
      detail: `후보 ${freshDraftCandidates.length}개 중 하나를 골라 원고로 반영하세요. 반영 전 원고는 스냅샷으로 보존됩니다.`,
      cta: '후보 보기'
    };
  }
  if (!s.targetHasManuscript) {
    return {
      action: 'writeNextEpisode',
      episode: ep,
      title: `${ep}${ep === 'ep001' ? '을 시작할' : '를 이어 쓸'} 차례입니다.`,
      detail: '비워두면 플롯·이전 회차 요약·다음 화 메모를 기준으로 AI가 설계와 초안 후보까지 진행합니다.',
      cta: '이번 화 쓰기'
    };
  }
  if (!s.targetHasSummary) {
    return {
      action: 'reviseCurrentDraft',
      episode: ep,
      title: `${ep} 원고가 있습니다.`,
      detail: '검토하고 수정안을 만들거나, 바로 회차를 마감할 수 있습니다.',
      cta: '원고 검토하고 수정안 만들기'
    };
  }
  return {
    action: 'closeEpisode',
    episode: ep,
    title: `${ep} 마감을 확정할 차례입니다.`,
    detail: '요약이 준비되어 있습니다. 설정 변경 후보를 확인하고 마감하세요.',
    cta: '회차 마감'
  };
}
