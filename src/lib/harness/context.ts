// 기초자료 로더 — 집필 파이프라인의 모든 단계가 같은 근거 자료를 읽도록 보장하는 단일 조립 지점.
// "기초자료를 읽지 않고 쓰는 일"을 구조적으로 막는다: 브리프·초안·QA·요약 스테이지는
// 각자 파일을 흩어 읽지 않고 이 로더의 결과를 프롬프트 변수로 옮긴다.
import { LAYOUT, episodePaths, summaryPath } from '$lib/core/layout';
import { clip, parseFrontmatter } from '$lib/core/text';
import { readOptional } from './project';
import { loadPlotPlan } from './plot';
import type { PlotEpisodeRow } from '$lib/schemas/contracts';
import type { Ctx } from './types';

export function previousEpisode(episode: string): string | null {
  const n = parseInt(episode.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 1 ? `ep${String(n - 1).padStart(3, '0')}` : null;
}

export function nextEpisode(episode: string): string {
  const n = parseInt(episode.replace(/\D/g, ''), 10);
  return `ep${String((Number.isFinite(n) ? n : 0) + 1).padStart(3, '0')}`;
}

/** 템플릿 뼈대/빈 문서 판정 — 헤딩·인용·리스트 기호를 걷어낸 실질 내용이 있는가. */
export function hasSubstance(md: string, minChars = 40): boolean {
  const body = parseFrontmatter(md).body ?? md;
  const stripped = body
    .replace(/^#.*$/gm, '')
    .replace(/^>.*$/gm, '')
    .replace(/^[-*]\s*(\S*:)?\s*$/gm, '')
    .replace(/\(.*?없습니다.*?\)|\(미정\)|\(없음\)/g, '')
    .replace(/\s+/g, '');
  return stripped.length >= minChars;
}

export type EpisodeContext = {
  episode: string;
  previous: string | null;
  /** 프롬프트 주입용으로 이미 clip된 값들 */
  bible: string;
  styleGuide: string;
  resumeState: string;
  openThreads: string;
  plotRow: PlotEpisodeRow | null;
  plotRowText: string;
  previousSummary: string;
  previousTail: string;
  currentManuscript: string;
  /** 비어 있는 기초자료 이름 — UI가 사용자에게 알린다 (실행은 막지 않는다) */
  missing: string[];
  /** Context Pack 투명성 — 이번 생성이 무엇을 어떤 방식으로 참고하는지 사용자 표시용 */
  sources: ContextSource[];
};

/** 사용자에게 보여주는 근거 자료 한 줄 — "무엇을, 어디서, 어떻게 투입/대체하는가". */
export type ContextSource = {
  label: string;
  path: string;
  /** 실질 내용이 프롬프트에 투입되는가 (false = 비어 있어 대체 원칙으로 진행) */
  used: boolean;
  /** 투입 방식(요약만/끝부분만/핵심만) 또는 비어 있을 때의 대체 원칙 */
  note: string;
};

function tailOf(content: string, chars: number): string {
  const body = parseFrontmatter(content).body.trim();
  if (!body) return '';
  return body.length > chars ? `...(앞부분 생략)\n${body.slice(-chars)}` : body;
}

export function renderPlotRowText(row: PlotEpisodeRow | null): string {
  return row
    ? `- 제목: ${row.title}\n- 목적: ${row.goal}\n- beats: ${row.beats.join(' / ')}\n- 떡밥 심기: ${row.threads_open.join(', ')}\n- 떡밥 회수: ${row.threads_close.join(', ')}\n- hook: ${row.hook}\n- 승인: ${row.status}`
    : '(플롯 row 없음 — 플롯 설계가 있으면 근거가 강해집니다)';
}

/** 회차 집필에 필요한 기초자료 전체를 한 번에 읽는다. */
export async function loadEpisodeContext(ctx: Ctx, episode: string): Promise<EpisodeContext> {
  const prev = previousEpisode(episode);
  const [bibleRaw, styleRaw, resumeRaw, threadsRaw, plan, prevSummaryRaw, prevManuscript, current] = await Promise.all([
    readOptional(ctx, LAYOUT.canon.bible),
    readOptional(ctx, LAYOUT.style.guide),
    readOptional(ctx, LAYOUT.status.resume),
    readOptional(ctx, LAYOUT.plot.openThreads),
    loadPlotPlan(ctx),
    prev ? readOptional(ctx, summaryPath(prev)) : Promise.resolve(''),
    prev ? readOptional(ctx, episodePaths(prev).manuscript) : Promise.resolve(''),
    readOptional(ctx, episodePaths(episode).manuscript)
  ]);
  const plotRow = plan?.episodes.find((e) => e.episode === episode) ?? null;

  const missing: string[] = [];
  if (!hasSubstance(bibleRaw)) missing.push('설정 바이블');
  if (!hasSubstance(styleRaw, 20)) missing.push('스타일 지침');
  if (!plotRow) missing.push(`플롯 계획(${episode})`);
  if (prev && !prevSummaryRaw.trim()) missing.push(`이전 회차 요약(${prev})`);

  // 전체 자료를 넣지 않는다 — 무엇을 어떤 방식으로 투입/대체하는지 그대로 기록해
  // UI("생성 근거 보기")가 사용자에게 요약으로 보여준다.
  const sources: ContextSource[] = [
    {
      label: '설정 바이블',
      path: LAYOUT.canon.bible,
      used: hasSubstance(bibleRaw),
      note: hasSubstance(bibleRaw) ? '핵심 6,000자까지 투입' : '비어 있음 — 보수적으로 쓰고 새 설정은 후보로 분리'
    },
    {
      label: `플롯 계획 (${episode})`,
      path: LAYOUT.plot.board,
      used: Boolean(plotRow),
      note: plotRow ? '이번 화 row만 투입 (다른 회차 계획 제외)' : '비어 있음 — 브리프가 방향을 대신 정의'
    },
    {
      label: prev ? `이전 회차 요약 (${prev})` : '이전 회차 요약',
      path: prev ? summaryPath(prev) : LAYOUT.canon.summaries,
      used: Boolean(prev && prevSummaryRaw.trim()),
      note: !prev ? '첫 회차 — 해당 없음' : prevSummaryRaw.trim() ? '원문 대신 승인된 요약을 우선 투입' : '요약 없음 — 마감 시 생성됩니다'
    },
    {
      label: prev ? `이전 회차 원고 끝부분 (${prev})` : '이전 회차 원고',
      path: prev ? episodePaths(prev).manuscript : LAYOUT.story.chapters,
      used: Boolean(prev && prevManuscript.trim()),
      note: !prev ? '첫 회차 — 해당 없음' : '문체 연결용 끝부분 2,000자만 투입 (전문 제외)'
    },
    {
      label: '재개 상태',
      path: LAYOUT.status.resume,
      used: hasSubstance(resumeRaw, 20),
      note: hasSubstance(resumeRaw, 20) ? '직전 픽스 기준 인물·플롯 상태' : '없음 — 첫 회차이거나 픽스 전'
    },
    {
      label: '열린 떡밥',
      path: LAYOUT.plot.openThreads,
      used: hasSubstance(threadsRaw, 20),
      note: hasSubstance(threadsRaw, 20) ? '유지/회수 대상 구분에 사용' : '기록 없음'
    },
    {
      label: '스타일 지침',
      path: LAYOUT.style.guide,
      used: hasSubstance(styleRaw, 20),
      note: hasSubstance(styleRaw, 20) ? '문체·대화 규칙 캡슐로 투입' : '비어 있음 — 기존 원고 문체에서 추정'
    }
  ];

  return {
    episode,
    previous: prev,
    bible: clip(bibleRaw, 6000) || '(바이블 없음 — 보수적으로 쓰고 새 설정은 canon_delta_candidates로 분리)',
    styleGuide: clip(styleRaw, 2500) || '(스타일 지침 없음)',
    resumeState: clip(resumeRaw, 3500) || '(재개 상태 없음 — 첫 회차이거나 아직 픽스 전)',
    openThreads: clip(threadsRaw, 1500) || '(열린 떡밥 기록 없음)',
    plotRow,
    plotRowText: renderPlotRowText(plotRow),
    previousSummary: clip(prevSummaryRaw, 2500) || (prev ? `(요약 없음 — ${prev} 마감 시 생성됩니다)` : '(첫 회차)'),
    previousTail: prev ? tailOf(prevManuscript, 2000) || '(이전 회차 원고 없음)' : '(첫 회차)',
    currentManuscript: current,
    missing,
    sources
  };
}
