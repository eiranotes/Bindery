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
import { loadPlotPlan } from './plot';
import type { Ctx, StageOutcome } from './types';

const JSON_BLOCK = /<!--\s*bindery:json\s*([\s\S]*?)-->/;

function embedJson(markdown: string, payload: unknown): string {
  return `${markdown.trimEnd()}\n\n<!-- bindery:json\n${JSON.stringify(payload, null, 2)}\n-->\n`;
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

export async function generateBrief(ctx: Ctx, episode: string, notes: string, targetLength: number): Promise<StageOutcome<EpisodeBrief>> {
  const paths = episodePaths(episode);
  const plan = await loadPlotPlan(ctx);
  const row = plan?.episodes.find((e) => e.episode === episode) ?? null;
  const prevEp = previousEpisode(episode);
  const prevTail = prevEp ? tailOf(await readOptional(ctx, episodePaths(prevEp).manuscript), 2000) : '';

  const outcome = await runStage(ctx, {
    stage: 'episode-brief',
    scope: episode,
    blueprint: BLUEPRINTS.episodeBrief,
    vars: {
      episode,
      plotRow: row
        ? `- 제목: ${row.title}\n- 목적: ${row.goal}\n- beats: ${row.beats.join(' / ')}\n- 떡밥 심기: ${row.threads_open.join(', ')}\n- 떡밥 회수: ${row.threads_close.join(', ')}\n- hook: ${row.hook}\n- 승인: ${row.status}`
        : '(플롯 row 없음 — 플롯 설계를 먼저 승인하면 근거가 강해집니다)',
      resumeState: clip(await readOptional(ctx, LAYOUT.status.resume), 4000),
      bible: clip(await readOptional(ctx, LAYOUT.canon.bible), 6000),
      previousTail: prevTail || '(첫 회차)',
      notes: notes || '(없음)',
      targetLength: String(targetLength)
    },
    parse: (text) => parseEpisodeBrief(text, episode),
    fallback: () => localBrief({ episode, plotGoal: row?.goal ?? '', beats: row?.beats ?? [], threads: [...(row?.threads_open ?? []), ...(row?.threads_close ?? [])], hook: row?.hook ?? '' }),
    repairHint: `{"schema_version":"bindery.episode_brief.v1","episode":"${episode}","goal":"...","must_events":["..."],"characters":[],"locations":[],"pov":"...","knowledge_change":[],"emotion_change":[],"conflict_change":"...","threads_touch":[],"forbidden":[],"target_length":${targetLength},"exit_hook":"..."}`
  });

  const content = embedJson(renderBriefMarkdown(outcome.output), outcome.output);
  await ctx.bridge.writeFile(ctx.root, paths.brief, content);
  await writeArtifact(ctx, episode, 'episode-brief', `회차 브리프${outcome.source === 'fallback' ? ' (로컬)' : ''}`, content, outcome.source);
  return outcome;
}

export async function loadBrief(ctx: Ctx, episode: string): Promise<EpisodeBrief | null> {
  const content = await readOptional(ctx, episodePaths(episode).brief);
  if (!content) return null;
  return extractEmbeddedJson<EpisodeBrief>(content);
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

export async function generateScenePlan(ctx: Ctx, episode: string): Promise<StageOutcome<ScenePlan> | { error: string }> {
  const brief = await loadBrief(ctx, episode);
  if (!brief) return { error: '회차 브리프가 없습니다. 브리프를 먼저 생성/작성하세요.' };
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
  const content = embedJson(renderScenePlanMarkdown(outcome.output), outcome.output);
  await ctx.bridge.writeFile(ctx.root, paths.scenePlan, content);
  await writeArtifact(ctx, episode, 'scene-plan', `장면 계획 ${outcome.output.scenes.length}장면${outcome.source === 'fallback' ? ' (로컬)' : ''}`, content, outcome.source);
  return outcome;
}

export async function loadScenePlan(ctx: Ctx, episode: string): Promise<ScenePlan | null> {
  const content = await readOptional(ctx, episodePaths(episode).scenePlan);
  if (!content) return null;
  return extractEmbeddedJson<ScenePlan>(content);
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
  source: 'agent' | 'fallback';
  createdAt: string;
  changeSummary: string;
  deltaCandidates: DraftCandidate['canon_delta_candidates'];
};

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

export async function generateDraftCandidates(
  ctx: Ctx,
  episode: string,
  count: number,
  notes: string
): Promise<{ candidates: CandidateFile[]; error?: string }> {
  const brief = await loadBrief(ctx, episode);
  const scenePlan = await loadScenePlan(ctx, episode);
  if (!brief || !scenePlan) {
    return { candidates: [], error: '초안 전에 회차 브리프와 장면 계획이 있어야 합니다.' };
  }
  const paths = episodePaths(episode);
  const current = await readOptional(ctx, paths.manuscript);
  const baseBody = parseFrontmatter(current).body ?? current;
  const baselineHash = contentHash(current);
  const vars = {
    episode,
    brief: renderBriefMarkdown(brief),
    scenePlan: renderScenePlanMarkdown(scenePlan),
    resumeState: clip(await readOptional(ctx, LAYOUT.status.resume), 3500),
    bible: clip(await readOptional(ctx, LAYOUT.canon.bible), 6000),
    styleGuide: clip(await readOptional(ctx, LAYOUT.style.guide), 2500),
    currentManuscript: excerptWindow(baseBody, 8000) || '(빈 원고)',
    notes: notes || '(없음)',
    targetLength: String(brief.target_length),
    variation: ''
  };

  const labels = ['후보 A', '후보 B', '후보 C', '후보 D'];
  const candidates: CandidateFile[] = [];
  const target = Math.max(1, Math.min(4, count));
  for (let i = 0; i < target; i++) {
    const outcome = await runStage(ctx, {
      stage: i === 0 ? 'draft-candidate' : `draft-candidate-${i + 1}`,
      scope: episode,
      blueprint: BLUEPRINTS.draftCandidate,
      vars: i === 0 ? vars : {
        ...vars,
        variation: `이번 후보는 ${i + 1}번째 변주다. 이전 후보와 다른 접근(장면 진입점, 리듬, 묘사 초점)을 시도하되 사건과 확정 설정은 동일하게 유지하라.`
      },
      parse: (text) => parseDraftCandidate(text, episode, baseBody).candidate,
      fallback: () => localDraftFallback(episode, brief),
      repairHint: `{"schema_version":"bindery.draft_candidate.v1","episode":"${episode}","manuscript_md":"...","scene_coverage":[],"canon_delta_candidates":[],"style_self_check":{"score":0,"notes":""},"change_summary":"..."}`
    });
    const id = `${stamp()}-${i}`;
    const path = candidatePath(episode, `draft-${id}.md`);
    const meta: CandidateFile = {
      id,
      label: labels[i],
      path,
      episode,
      kind: 'draft',
      baselineHash,
      source: outcome.source,
      createdAt: nowIso(),
      changeSummary: outcome.output.change_summary,
      deltaCandidates: outcome.output.canon_delta_candidates
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

  const outcome = await runStage(ctx, {
    stage: 'revision-candidate',
    scope: episode,
    blueprint: BLUEPRINTS.revisionCandidate,
    vars: {
      episode,
      revisionPlan: accepted.map((i) => `- [${i.id}][${i.severity}] ${i.instruction}${i.target ? ` (위치: ${i.target})` : ''}`).join('\n'),
      manuscript: baseBody,
      styleGuide: clip(await readOptional(ctx, LAYOUT.style.guide), 2000)
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
    deltaCandidates: outcome.output.canon_delta_candidates
  };
  await ctx.bridge.writeFile(ctx.root, path, embedJson(outcome.output.manuscript_md, meta));
  const existing = await loadCandidateIndex(ctx, episode);
  await saveCandidateIndex(ctx, episode, [meta, ...existing]);
  return { candidate: meta };
}

const candidateIndexPath = (episode: string): string => candidatePath(episode, 'index.json');

export async function loadCandidateIndex(ctx: Ctx, episode: string): Promise<CandidateFile[]> {
  try {
    return JSON.parse(await ctx.bridge.readFile(ctx.root, candidateIndexPath(episode))) as CandidateFile[];
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

export function previousEpisode(episode: string): string | null {
  const n = parseInt(episode.replace(/\D/g, ''), 10);
  return Number.isFinite(n) && n > 1 ? `ep${String(n - 1).padStart(3, '0')}` : null;
}

export function nextEpisode(episode: string): string {
  const n = parseInt(episode.replace(/\D/g, ''), 10);
  return `ep${String((Number.isFinite(n) ? n : 0) + 1).padStart(3, '0')}`;
}

function tailOf(content: string, chars: number): string {
  const body = parseFrontmatter(content).body.trim();
  if (!body) return '';
  return body.length > chars ? `...(앞부분 생략)\n${body.slice(-chars)}` : body;
}

export async function readSummary(ctx: Ctx, episode: string): Promise<string> {
  return readOptional(ctx, summaryPath(episode));
}
