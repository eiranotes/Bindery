// 회차 마감 — 요약 → 정사 변경 proposal → 기록·픽스 → 재개 상태(resume state) 갱신.
// 요약은 canon/summaries/에 쓰이지만, canon 파일 변경은 proposal로만 만들어진다.
import { BLUEPRINTS } from '$lib/prompts';
import { runStage } from './runner';
import { writeArtifact } from './artifacts';
import { readOptional, listEpisodes } from './project';
import { snapshotFile } from './snapshots';
import { LAYOUT, episodePaths, summaryPath } from '$lib/core/layout';
import { clip, excerptWindow, nowIso, parseFrontmatter } from '$lib/core/text';
import { parseCanonDeltaProposal, type CanonDeltaProposal } from '$lib/schemas/contracts';
import { registerCanonDelta, saveProposal, loadProposals, type CanonDeltaRecord } from './proposals';
import { nextEpisode, type CandidateFile } from './episode';
import type { Ctx, StageOutcome } from './types';

// ---------------------------------------------------------------------------
// 요약
// ---------------------------------------------------------------------------

function localSummaryFallback(episode: string, manuscript: string): string {
  const body = parseFrontmatter(manuscript).body.replace(/^#.*$/gm, '').trim();
  const chars = body.replace(/\s/g, '').length;
  const lead = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean).slice(0, 2).join(' ').slice(0, 160);
  return [
    `# ${episode} 요약`,
    '',
    '## 한 줄 요약',
    `- ${lead ? `${lead}…` : '(원고 없음)'}`,
    '',
    '## 통계',
    `- 공백 제외 ${chars.toLocaleString()}자`,
    '',
    '> 오프라인 요약입니다. AI 연결 후 다시 실행하면 장면 흐름·인물 상태·떡밥이 채워집니다.'
  ].join('\n');
}

export async function summarizeEpisode(ctx: Ctx, episode: string): Promise<StageOutcome<string>> {
  const manuscript = await readOptional(ctx, episodePaths(episode).manuscript);
  const outcome = await runStage<string>(ctx, {
    stage: 'summary',
    scope: episode,
    blueprint: BLUEPRINTS.summary,
    vars: {
      episode,
      manuscript: excerptWindow(parseFrontmatter(manuscript).body, 14000) || '(빈 원고)',
      resumeState: clip(await readOptional(ctx, LAYOUT.status.resume), 3000)
    },
    parse: (text) => {
      const t = text.trim();
      return t.includes('## 한 줄 요약') || t.includes('## 장면 흐름') ? t : null;
    },
    fallback: () => localSummaryFallback(episode, manuscript)
  });
  await ctx.bridge.writeFile(ctx.root, summaryPath(episode), outcome.output.trim() + '\n');
  await writeArtifact(ctx, episode, 'summary', `회차 요약${outcome.source === 'fallback' ? ' (오프라인)' : ''}`, outcome.output, outcome.source);
  return outcome;
}

// ---------------------------------------------------------------------------
// 정사 변경 proposal
// ---------------------------------------------------------------------------

export async function proposeCanonDelta(
  ctx: Ctx,
  episode: string,
  deltaCandidates: CandidateFile['deltaCandidates']
): Promise<{ proposal: CanonDeltaRecord | null; outcome: StageOutcome<CanonDeltaProposal | null> }> {
  const summary = await readOptional(ctx, summaryPath(episode));
  const canonFiles = [
    `### ${LAYOUT.canon.bible}\n${clip(await readOptional(ctx, LAYOUT.canon.bible), 3500)}`,
    `### ${LAYOUT.plot.openThreads}\n${clip(await readOptional(ctx, LAYOUT.plot.openThreads), 1500)}`
  ].join('\n\n');

  const outcome = await runStage<CanonDeltaProposal | null>(ctx, {
    stage: 'canon-delta',
    scope: episode,
    blueprint: BLUEPRINTS.canonDelta,
    vars: {
      episode,
      summary: clip(summary, 5000) || '(요약 없음 — 요약 단계를 먼저 실행하세요)',
      deltaCandidates: deltaCandidates.length
        ? deltaCandidates.map((d) => `- ${d.summary} (대상 힌트: ${d.target_hint || '없음'}, risk: ${d.risk})`).join('\n')
        : '(초안 단계에서 분리된 후보 없음)',
      canonFiles
    },
    parse: (text) => parseCanonDeltaProposal(text, episode),
    // 정직한 폴백: AI 없이 정사 변경을 지어내지 않는다. null이면 proposal 없음.
    fallback: () => null,
    repairHint: `{"schema_version":"bindery.canon_delta_proposal.v1","episode":"${episode}","requires_human_approval":true,"changes":[{"target_path":"characters/xxx.md","change_type":"update","summary":"...","patch":"...","risk":"low"}]}`
  });

  if (!outcome.output || outcome.source === 'fallback') {
    return { proposal: null, outcome };
  }
  const proposal = registerCanonDelta(outcome.output, outcome.source);
  await saveProposal(ctx, proposal);
  await writeArtifact(
    ctx, episode, 'canon-delta',
    `정사 변경 proposal · ${outcome.output.changes.length}건 (승인 대기)`,
    outcome.output.changes.map((c) => `- [${c.risk}] ${c.change_type} ${c.target_path}: ${c.summary}`).join('\n'),
    outcome.source
  );
  return { proposal, outcome };
}

// ---------------------------------------------------------------------------
// 기록·픽스 + 재개 상태
// ---------------------------------------------------------------------------

export type EpisodeProgress = Record<string, { status: 'planned' | 'drafting' | 'fixed'; fixedAt?: string; contentHash?: string }>;

const PROGRESS_PATH = `${LAYOUT.bindery.root}/episodes.json`;

export async function loadProgress(ctx: Ctx): Promise<EpisodeProgress> {
  try {
    return JSON.parse(await ctx.bridge.readFile(ctx.root, PROGRESS_PATH)) as EpisodeProgress;
  } catch {
    return {};
  }
}

export async function setProgress(ctx: Ctx, episode: string, entry: EpisodeProgress[string]): Promise<void> {
  const progress = await loadProgress(ctx);
  progress[episode] = { ...progress[episode], ...entry };
  await ctx.bridge.writeFile(ctx.root, PROGRESS_PATH, JSON.stringify(progress, null, 2));
}

/** 기록·픽스 — 원고 스냅샷, 상태 갱신, 재개 상태 재생성. */
export async function fixEpisode(ctx: Ctx, episode: string): Promise<{ resumePath: string }> {
  const paths = episodePaths(episode);
  const manuscript = await readOptional(ctx, paths.manuscript);
  await snapshotFile(ctx, paths.manuscript, `${episode} 픽스`, episode);
  await setProgress(ctx, episode, { status: 'fixed', fixedAt: nowIso() });
  await buildResumeState(ctx, episode);
  await writeArtifact(ctx, episode, 'fix', `기록·픽스 (공백 제외 ${manuscript.replace(/\s/g, '').length.toLocaleString()}자)`, `- 픽스 시각: ${nowIso()}\n- 대상: ${paths.manuscript}`, 'human');
  return { resumePath: LAYOUT.status.resume };
}

/** 재개 상태 — 다음 회차 시작에 필요한 모든 것을 한 문서로 조립한다 (정적 단계). */
export async function buildResumeState(ctx: Ctx, lastFixed: string | null): Promise<string> {
  const progress = await loadProgress(ctx);
  const episodes = await listEpisodes(ctx);
  const fixed = episodes.filter((e) => progress[e]?.status === 'fixed');
  const latest = lastFixed ?? fixed[fixed.length - 1] ?? null;
  const next = latest ? nextEpisode(latest) : (episodes[0] ?? 'ep001');
  const summary = latest ? await readOptional(ctx, summaryPath(latest)) : '';
  const openThreads = await readOptional(ctx, LAYOUT.plot.openThreads);
  const proposals = await loadProposals(ctx);
  const pending = proposals.filter((p) => p.status === 'pending' || p.status === 'partial');

  // 인물 상태: 요약의 "인물 상태 변화" 섹션 + characters/ 파일 목록
  const charSection = /##\s*인물 상태 변화\s*\n([\s\S]*?)(?=\n## |$)/.exec(summary)?.[1]?.trim() ?? '';

  const content = [
    '# 재개 상태 (resume state)',
    '',
    `> 이 문서는 기록·픽스 단계가 자동 생성합니다. 직접 수정해도 되지만 다음 픽스 때 다시 만들어집니다.`,
    `> 갱신: ${nowIso()}`,
    '',
    `## 위치`,
    `- 마지막 픽스: ${latest ?? '없음'}`,
    `- 다음 회차: ${next}`,
    `- 픽스된 회차: ${fixed.length ? fixed.join(', ') : '없음'}`,
    '',
    '## 최근 요약',
    summary ? clip(summary.replace(/^# .*$/m, '').trim(), 2500) : '(없음)',
    '',
    '## 인물 상태 (최근 회차 기준)',
    charSection || '(요약에 인물 상태 변화 기록 없음)',
    '',
    '## 열린 떡밥',
    clip(openThreads.replace(/^# .*$/m, '').trim(), 1500) || '(plot/open-threads.md 없음)',
    '',
    '## 보류 중 결정 (사람이 처리해야 함)',
    pending.length
      ? pending.map((p) => `- [${p.type === 'world-expansion' ? '세계관' : '정사'}] ${p.id} · ${p.status === 'partial' ? '일부 결정됨' : '대기'} — 제안 검토 화면에서 승인/거부하세요`).join('\n')
      : '- 없음',
    ''
  ].join('\n');
  await ctx.bridge.writeFile(ctx.root, LAYOUT.status.resume, content);
  return content;
}
