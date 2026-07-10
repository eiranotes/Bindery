// 플롯 설계 — 회별 계획(PlotPlan)을 제안하고, 승인된 회차만 확정 상태가 된다.
// 저장: plot/plot-board.json (구조 진실) + plot/series-outline.md (사람이 읽는 문서).
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { LAYOUT, episodeId } from '$lib/core/layout';
import { clip, nowIso } from '$lib/core/text';
import { parsePlotPlan, type PlotPlan, type PlotEpisodeRow } from '$lib/schemas/contracts';
import { snapshotFile } from './snapshots';
import type { Ctx, StageOutcome } from './types';

export type PlotProposalOptions = {
  /** 기존 활성 플롯을 연장하지 않고 새 연재선으로 교체한다. */
  reset?: boolean;
  /** 결과에 반드시 포함되어야 하는 회차. 재작성 플롯의 범위 누락을 막는다. */
  requiredEpisodes?: string[];
};

export async function loadPlotPlan(ctx: Ctx): Promise<PlotPlan | null> {
  try {
    if (!(await ctx.bridge.exists(ctx.root, LAYOUT.plot.board))) return null;
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, LAYOUT.plot.board)) as PlotPlan;
    return raw.schema_version === 'bindery.plot_plan.v1' ? raw : null;
  } catch {
    return null;
  }
}

export async function savePlotPlan(ctx: Ctx, plan: PlotPlan): Promise<void> {
  await ctx.bridge.writeFile(ctx.root, LAYOUT.plot.board, JSON.stringify(plan, null, 2));
  await ctx.bridge.writeFile(ctx.root, LAYOUT.plot.seriesOutline, renderPlotOutline(plan));
}

export function renderPlotOutline(plan: PlotPlan): string {
  const lines = [
    `# 시리즈 아웃라인`,
    '',
    `- 갱신: ${plan.updatedAt} · source: ${plan.source}`,
    ''
  ];
  for (const arc of plan.arcs) {
    lines.push(`## ${arc.label} (${arc.episodes || '범위 미정'})`, arc.goal ? `> ${arc.goal}` : '', '');
    for (const row of plan.episodes.filter((e) => e.arc === arc.id)) {
      lines.push(...renderRow(row));
    }
  }
  const orphans = plan.episodes.filter((e) => !plan.arcs.some((a) => a.id === e.arc));
  if (orphans.length) {
    lines.push('## (아크 미지정)', '');
    for (const row of orphans) lines.push(...renderRow(row));
  }
  return lines.join('\n');
}

function renderRow(row: PlotEpisodeRow): string[] {
  return [
    `### ${row.episode} — ${row.title} ${row.status === 'approved' ? '✔승인' : '(검토 필요)'}`,
    `- 목적: ${row.goal}`,
    `- beats: ${row.beats.join(' → ') || '(없음)'}`,
    `- 떡밥: 심기 ${row.threads_open.join(', ') || '-'} / 회수 ${row.threads_close.join(', ') || '-'}`,
    `- hook: ${row.hook || '-'}`,
    ...(row.risk ? [`- ⚠ ${row.risk}`] : []),
    ''
  ];
}

function localPlotFallback(count: number, previous: PlotPlan | null): PlotPlan {
  const episodes: PlotEpisodeRow[] = [];
  for (let i = 1; i <= count; i++) {
    const ep = episodeId(i);
    const prev = previous?.episodes.find((e) => e.episode === ep);
    episodes.push(
      prev ?? {
        episode: ep,
        arc: 'arc1',
        title: `${ep} (제목 미정)`,
        goal: '(이 회차의 목적을 직접 정하거나 AI 연결 후 재실행하세요)',
        beats: [],
        threads_open: [],
        threads_close: [],
        hook: '',
        risk: '오프라인 뼈대 row입니다.',
        status: 'draft'
      }
    );
  }
  return {
    schema_version: 'bindery.plot_plan.v1',
    arcs: previous?.arcs.length ? previous.arcs : [{ id: 'arc1', label: '1부', goal: '', episodes: `ep001-${episodeId(count)}` }],
    episodes,
    source: 'local',
    updatedAt: nowIso()
  };
}

/** 플롯 계획 제안 — 기존 승인 회차는 보존한다. */
export async function proposePlot(
  ctx: Ctx,
  episodeCount: number,
  notes: string,
  options: PlotProposalOptions = {}
): Promise<StageOutcome<PlotPlan>> {
  const previous = await loadPlotPlan(ctx);
  const requiredEpisodes = options.requiredEpisodes ?? [];
  const outcome = await runStage(ctx, {
    stage: 'plot-plan',
    scope: 'work',
    blueprint: BLUEPRINTS.plotPlan,
    vars: {
      episodeCount: String(episodeCount),
      planningMode: options.reset
        ? `ep001 재작성. 이전 활성 플롯을 이어 쓰지 않는다. ep001부터 ep${String(episodeCount).padStart(3, '0')}까지 정확히 다시 설계한다.`
        : '기존 승인 회차가 있으면 보존하고 현재 연재선을 이어서 보강한다.',
      bible: clip(await readOptional(ctx, LAYOUT.canon.bible), 8000) || '(바이블 없음 — 보수적으로 제안하고 risk에 명시)',
      openThreads: clip(await readOptional(ctx, LAYOUT.plot.openThreads), 2000) || '(없음)',
      existingPlot: options.reset
        ? '(재작성 모드: 기존 활성 플롯은 이어쓰기 입력에서 제외됨)'
        : previous ? clip(JSON.stringify(previous.episodes.filter((e) => e.status === 'approved'), null, 1), 6000) : '(없음)',
      notes: notes || '(없음)'
    },
    parse: (text) => {
      const parsed = parsePlotPlan(text, nowIso());
      if (!parsed) return null;
      const received = new Set(parsed.episodes.map((row) => row.episode));
      if (requiredEpisodes.some((episode) => !received.has(episode))) return null;
      if (options.reset) parsed.episodes = requiredEpisodes.map((episode) => parsed.episodes.find((row) => row.episode === episode)!);
      return parsed;
    },
    fallback: () => localPlotFallback(episodeCount, options.reset ? null : previous),
    repairHint: [
      '{"schema_version":"bindery.plot_plan.v1","arcs":[{"id":"arc1","label":"1부","goal":"...","episodes":"ep001-ep008"}],"episodes":[{"episode":"ep001","arc":"arc1","title":"...","goal":"...","beats":["..."],"threads_open":[],"threads_close":[],"hook":"...","risk":""}]}',
      requiredEpisodes.length ? `필수 회차 범위: ${requiredEpisodes.join(', ')}. 하나도 빠뜨리지 않는다.` : ''
    ].filter(Boolean).join('\n')
  });

  // 사람이 승인한 회차는 재제안이 덮지 못한다.
  const plan = outcome.output;
  if (previous && !options.reset) {
    for (let i = 0; i < plan.episodes.length; i++) {
      const before = previous.episodes.find((e) => e.episode === plan.episodes[i].episode);
      if (before?.status === 'approved') plan.episodes[i] = before;
    }
  }
  if (options.reset && previous) {
    await snapshotFile(ctx, LAYOUT.plot.board, 'ep001 재시작 전: 활성 플롯');
    await snapshotFile(ctx, LAYOUT.plot.seriesOutline, 'ep001 재시작 전: 시리즈 아웃라인');
  }
  await savePlotPlan(ctx, plan);
  await writeArtifact(ctx, 'work', 'plot-plan', `플롯 계획 ${plan.episodes.length}화`, renderPlotOutline(plan), outcome.source);
  return outcome;
}

export async function approvePlotEpisodes(ctx: Ctx, episodes: string[]): Promise<PlotPlan | null> {
  const plan = await loadPlotPlan(ctx);
  if (!plan) return null;
  const targets = new Set(episodes);
  const next: PlotPlan = {
    ...plan,
    episodes: plan.episodes.map((e) => (targets.has(e.episode) ? { ...e, status: 'approved' as const } : e)),
    updatedAt: nowIso()
  };
  await savePlotPlan(ctx, next);
  return next;
}

export async function updatePlotRow(ctx: Ctx, episode: string, patch: Partial<PlotEpisodeRow>): Promise<PlotPlan | null> {
  const plan = await loadPlotPlan(ctx);
  if (!plan) return null;
  const next: PlotPlan = {
    ...plan,
    episodes: plan.episodes.map((e) => (e.episode === episode ? { ...e, ...patch, episode: e.episode } : e)),
    updatedAt: nowIso()
  };
  await savePlotPlan(ctx, next);
  return next;
}
