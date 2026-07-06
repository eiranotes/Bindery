// 플롯 설계 — 회별 계획(PlotPlan)을 제안하고, 승인된 회차만 확정 상태가 된다.
// 저장: plot/plot-board.json (구조 진실) + plot/series-outline.md (사람이 읽는 문서).
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional } from './project';
import { LAYOUT, episodeId } from '$lib/core/layout';
import { clip, nowIso } from '$lib/core/text';
import { parsePlotPlan, type PlotPlan, type PlotEpisodeRow } from '$lib/schemas/contracts';
import type { Ctx, StageOutcome } from './types';

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
export async function proposePlot(ctx: Ctx, episodeCount: number, notes: string): Promise<StageOutcome<PlotPlan>> {
  const previous = await loadPlotPlan(ctx);
  const outcome = await runStage(ctx, {
    stage: 'plot-plan',
    scope: 'work',
    blueprint: BLUEPRINTS.plotPlan,
    vars: {
      episodeCount: String(episodeCount),
      bible: clip(await readOptional(ctx, LAYOUT.canon.bible), 8000) || '(바이블 없음 — 보수적으로 제안하고 risk에 명시)',
      openThreads: clip(await readOptional(ctx, LAYOUT.plot.openThreads), 2000) || '(없음)',
      existingPlot: previous ? clip(JSON.stringify(previous.episodes.filter((e) => e.status === 'approved'), null, 1), 6000) : '(없음)',
      notes: notes || '(없음)'
    },
    parse: (text) => parsePlotPlan(text, nowIso()),
    fallback: () => localPlotFallback(episodeCount, previous),
    repairHint: '{"schema_version":"bindery.plot_plan.v1","arcs":[{"id":"arc1","label":"1부","goal":"...","episodes":"ep001-ep008"}],"episodes":[{"episode":"ep001","arc":"arc1","title":"...","goal":"...","beats":["..."],"threads_open":[],"threads_close":[],"hook":"...","risk":""}]}'
  });

  // 사람이 승인한 회차는 재제안이 덮지 못한다.
  const plan = outcome.output;
  if (previous) {
    for (let i = 0; i < plan.episodes.length; i++) {
      const before = previous.episodes.find((e) => e.episode === plan.episodes[i].episode);
      if (before?.status === 'approved') plan.episodes[i] = before;
    }
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
