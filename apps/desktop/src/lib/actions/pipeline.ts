// Action layer: single place that runs pipeline steps and writes results into
// stores. Both the pipeline workbench and the editor's AI command menu call
// these, so behaviour stays consistent no matter how a step is triggered.
import { get } from 'svelte/store';
import {
  runQA,
  generateRevisionPlan,
  generateCandidate,
  runAgentText,
  listCodex,
  scanCodexLinks,
  getPlotGrid,
  readFile,
  writeFile,
  createSnapshot
} from '$lib/api/commands';
import type { Candidate } from '$lib/api/commands';
import { parseQAReport, parseRevisionPlan } from '$lib/domain/reports';
import type { QAIssue } from '$lib/domain/reports';
import { settingsStore } from '$lib/stores/settingsStore';
import { validateCandidateMarkdown, validateQAContract } from '$lib/domain/agentContracts';
import { manuscriptContextWindow } from '$lib/domain/prompt';
import type { PipelineStep } from '$lib/domain/prompt';
import type { PlotGrid } from '$lib/domain/plot';
import {
  draftCandidateEnvelopeSchemaText,
  qaReportEnvelopeSchemaText,
  renderQAReportEnvelopeMarkdown,
  validateDraftCandidateEnvelope,
  validateQAReportEnvelope
} from '$lib/domain/agentEnvelopes';
import {
  buildLocalEpisodeBrief,
  buildLocalScenePlan,
  episodeBriefPrompt,
  parseEpisodeBrief,
  renderEpisodeBriefArtifact,
  renderScenePlanArtifact,
  scenePlanPrompt,
  parseScenePlan
} from '$lib/domain/planning';
import {
  buildLocalOutline,
  outlinePrompt,
  parseEpisodeOutline,
  renderOutlineArtifact,
  applyOutlineToPlotGrid,
  outlineRowFor
} from '$lib/domain/outline';
import type { EpisodeOutline, EpisodeOutlineRow } from '$lib/domain/outline';
import { outlineStore, persistOutline } from '$lib/stores/outlineStore';
import { setEpisodeProgress } from '$lib/stores/episodeProgressStore';
import { contentHash, shortHash } from '$lib/domain/hash';
import { checkStyleCompliance } from '$lib/domain/style';
import { styleStore } from '$lib/stores/styleStore';
import { latestArtifact } from '$lib/stores/artifactStore';
import { analyzeManuscript } from '$lib/domain/analysis';
import type { AnalysisMode } from '$lib/domain/analysis';
import { projectStore } from '$lib/stores/projectStore';
import { editorStore } from '$lib/stores/editorStore';
import { qaStore } from '$lib/stores/qaStore';
import type { QATarget } from '$lib/stores/qaStore';
import { revisionStore } from '$lib/stores/revisionStore';
import { candidateStore } from '$lib/stores/candidateStore';
import { analysisStore } from '$lib/stores/analysisStore';
import { codexStore } from '$lib/stores/codexStore';
import { plotStore } from '$lib/stores/plotStore';
import { gotoPipeline } from '$lib/stores/uiStore';
import { uiStore } from '$lib/stores/uiStore';
import { setStepMode } from '$lib/stores/pipelineStore';
import type { StepExecMode } from '$lib/stores/pipelineStore';
import { recordArtifact } from '$lib/stores/artifactStore';
import { recordRunStep, recordHumanDecision, runStore } from '$lib/stores/runStore';
import { buildGuidanceText } from '$lib/domain/guidance';
import { draftParamsStore } from '$lib/stores/draftParamsStore';
import { toasts } from '$lib/stores/toastStore';

const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;

export type DraftSourceContext = {
  command?: string;
  selectedText?: string;
  cursorContext?: string;
  cursorOffset?: number;
};

function projectRoot(): string {
  return get(projectStore).current?.rootPath || 'sample-project';
}
function episode(): string {
  const path = get(editorStore).path || '';
  const m = /ep(\d+)/.exec(path);
  return m ? `ep${m[1]}` : 'ep001';
}

function prevEpisode(ep: string): string | null {
  const n = parseInt(ep.replace(/\D/g, ''), 10);
  return n > 1 ? `ep${String(n - 1).padStart(3, '0')}` : null;
}

// ---------------------------------------------------------------------------
// 실행 관측 — 단계별 실제 사용 모드(agent/fallback/static)와 입출력 문자수를
// run 기록에 남긴다. 토큰은 CLI가 보고하지 않으므로 추정치로만 기록한다.
// ---------------------------------------------------------------------------

type StepUsageAcc = { promptChars: number; outputChars: number; calls: number };
const stepUsage = new Map<PipelineStep, StepUsageAcc>();

function beginStepUsage(step: PipelineStep) {
  stepUsage.set(step, { promptChars: 0, outputChars: 0, calls: 0 });
}

/** runAgentText 래퍼 — 입출력 크기를 단계별로 누적한다. */
async function agentCall(step: PipelineStep, prompt: string, label: string) {
  const acc = stepUsage.get(step) ?? { promptChars: 0, outputChars: 0, calls: 0 };
  acc.promptChars += prompt.length;
  acc.calls += 1;
  stepUsage.set(step, acc);
  const result = await runAgentText(projectRoot(), prompt, label);
  if (result.ok) acc.outputChars += result.text.length;
  return result;
}

/** 한국어+마크다운 대략 2자/token — 표시용 추정치 (과금 계산 아님). */
function estimateTokens(chars: number): number {
  return Math.ceil(chars / 2);
}

function reportStepExec(step: PipelineStep, mode: StepExecMode) {
  setStepMode(step, mode);
  const acc = stepUsage.get(step);
  recordRunStep(step, {
    mode,
    promptChars: acc?.promptChars ?? 0,
    outputChars: acc?.outputChars ?? 0,
    tokenEstimate: acc && acc.promptChars + acc.outputChars > 0 ? estimateTokens(acc.promptChars + acc.outputChars) : undefined,
    tokenSource: acc && acc.calls > 0 ? 'estimated' : 'unavailable'
  });
}

async function readOpenThreads(): Promise<string> {
  try {
    return await readFile(projectRoot(), 'plot/open-threads.md');
  } catch {
    return '';
  }
}

async function loadPlotGridSnapshot(): Promise<PlotGrid | null> {
  const loaded = get(plotStore).grid;
  if (loaded) return loaded;
  try {
    const raw = await readFile(projectRoot(), PLOT_BOARD_PATH);
    const parsed = JSON.parse(raw) as PlotGrid;
    if (parsed?.plotlines && parsed?.rows) return parsed;
  } catch {
    /* fall through to native/mock plot grid */
  }
  try {
    return await getPlotGrid(projectRoot());
  } catch {
    return null;
  }
}

const PLANNING_SOURCE_PATHS = [
  'notes/source-intake.md',
  'canon/setting-bible.md',
  'characters/cast-inbox.md',
  'world/organizations.md',
  'plot/open-threads.md'
];

function clipPlanningSource(text: string, max: number): string {
  const trimmed = text.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max)}\n...(truncated)` : trimmed;
}

async function readPlanningSourceContext(): Promise<string> {
  const chunks: string[] = [];
  for (const path of PLANNING_SOURCE_PATHS) {
    try {
      const text = await readFile(projectRoot(), path);
      if (text.trim()) chunks.push(`### ${path}\n${clipPlanningSource(text, 3200)}`);
    } catch {
      /* source file is optional */
    }
  }
  return clipPlanningSource(chunks.join('\n\n'), 14000);
}

function codexPlanningContext(): string {
  return get(codexStore).items
    .slice(0, 40)
    .map((item) => `- ${item.name} (${item.type}): ${item.summary ?? '(요약 없음)'}`)
    .join('\n');
}

/** 이전 회차 요약 — 메모리 산출물이 없으면 디스크(canon/summaries)에서 읽는다. */
async function previousSummaryFor(ep: string): Promise<string> {
  const prev = prevEpisode(ep);
  if (!prev) return '';
  const prevSummary = latestArtifact('summarize', prev);
  if (prevSummary?.content) return prevSummary.content;
  try {
    return await readFile(projectRoot(), `canon/summaries/${prev}.md`);
  } catch {
    return '';
  }
}

/** 이전 회차의 최종 원고 끝부분 — 사람이 수작업으로 수정한 파일이 진실이다.
 *  다음 회차 계획이 "수정 전 AI 요약"이 아니라 실제 확정 원고를 잇게 한다. */
async function previousManuscriptTail(ep: string): Promise<string> {
  const prev = prevEpisode(ep);
  if (!prev) return '';
  const currentPath = get(editorStore).path || '';
  const candidates = [
    currentPath.includes(ep) ? currentPath.replace(ep, prev) : '',
    `story/chapters/${prev}/manuscript.md`
  ].filter(Boolean);
  for (const path of candidates) {
    try {
      const raw = await readFile(projectRoot(), path);
      const body = raw.replace(/^---[\s\S]*?\n---\n?/, '').trim();
      if (!body) continue;
      return body.length > 2400 ? `...(앞부분 생략)\n${body.slice(-2400)}` : body;
    } catch {
      /* try next candidate */
    }
  }
  return '';
}

async function planningInputFor(ep: string) {
  return {
    episode: ep,
    manuscript: get(editorStore).content,
    plotGrid: await loadPlotGridSnapshot(),
    openThreads: await readOpenThreads(),
    previousSummary: await previousSummaryFor(ep),
    previousManuscriptTail: await previousManuscriptTail(ep),
    outlineRow: outlineRowFor(get(outlineStore).outline, ep),
    lengthTarget: get(draftParamsStore).lengthTarget,
    sourceContext: await readPlanningSourceContext(),
    codexContext: codexPlanningContext()
  };
}

// ---------------------------------------------------------------------------
// 작품 아웃라인 — 바이블/원천에서 N화 회별 아웃라인을 제안하고 승인만 반영한다.
// ---------------------------------------------------------------------------

export async function runOutlineAction(episodeCount: number): Promise<boolean> {
  outlineStore.update((s) => ({ ...s, generating: true }));
  try {
    const input = {
      episodeCount,
      sourceContext: await readPlanningSourceContext(),
      codexContext: codexPlanningContext(),
      openThreads: await readOpenThreads(),
      plotGrid: await loadPlotGridSnapshot(),
      previousOutline: get(outlineStore).outline
    };
    const agent = await runAgentText(projectRoot(), outlinePrompt(input), 'episode-outline');
    const parsed = agent.ok && agent.text.trim() ? parseEpisodeOutline(agent.text, episodeCount) : null;
    const outline = parsed ?? buildLocalOutline(input);
    // 기존 승인 상태는 회차 기준으로 보존한다 — 재제안이 사람의 승인을 지우면 안 된다.
    const previous = get(outlineStore).outline;
    if (previous) {
      for (const row of outline.rows) {
        const before = previous.rows.find((r) => r.episode === row.episode);
        if (before?.status === 'approved' && outline.source === 'local') row.status = 'approved';
      }
    }
    await persistOutline(outline);
    recordArtifact('outline', 'work', outline.source === 'agent' ? `작품 아웃라인 · ${outline.rows.length}화` : `작품 아웃라인(로컬) · ${outline.rows.length}화`, renderOutlineArtifact(outline));
    outlineStore.update((s) => ({ ...s, generating: false }));
    toasts.push(
      outline.source === 'agent'
        ? `아웃라인 ${outline.rows.length}화 제안됨 · 검토 후 회차별로 승인하세요`
        : `로컬 뼈대 아웃라인 ${outline.rows.length}화 생성됨 · AI 연결 후 다시 실행하면 정밀해집니다`,
      outline.source === 'agent' ? 'ok' : 'warn'
    );
    return true;
  } catch {
    outlineStore.update((s) => ({ ...s, generating: false }));
    toasts.push('아웃라인 생성 실패', 'bad');
    return false;
  }
}

export async function updateOutlineRowAction(episodeId: string, patch: Partial<EpisodeOutlineRow>): Promise<void> {
  const current = get(outlineStore).outline;
  if (!current) return;
  const next: EpisodeOutline = {
    ...current,
    rows: current.rows.map((row) => (row.episode === episodeId ? { ...row, ...patch, episode: row.episode } : row)),
    updatedAt: new Date().toISOString()
  };
  await persistOutline(next);
}

/** 승인 — 지정 회차(생략 시 전체 draft)를 approved로 바꾸고 플롯 보드에 반영한다. */
export async function approveOutlineAction(episodeIds?: string[]): Promise<void> {
  const current = get(outlineStore).outline;
  if (!current) {
    toasts.push('승인할 아웃라인이 없습니다. 먼저 아웃라인을 생성하세요', 'warn');
    return;
  }
  const targets = new Set(episodeIds ?? current.rows.map((row) => row.episode));
  const next: EpisodeOutline = {
    ...current,
    rows: current.rows.map((row) => (targets.has(row.episode) ? { ...row, status: 'approved' as const } : row)),
    updatedAt: new Date().toISOString()
  };
  await persistOutline(next);
  const grid = await loadPlotGridSnapshot();
  const { grid: merged, added } = applyOutlineToPlotGrid(next, grid);
  plotStore.update((s) => ({ ...s, grid: merged }));
  await savePlotAction();
  recordHumanDecision('approve-outline', `${targets.size}개 회차${added ? ` · 플롯 row ${added}개 추가` : ''}`);
  recordArtifact('outline', 'work', `작품 아웃라인 승인 · ${next.rows.filter((r) => r.status === 'approved').length}/${next.rows.length}화`, renderOutlineArtifact(next));
  toasts.push(added ? `아웃라인 승인 · 플롯 보드에 ${added}개 회차 row 추가됨` : '아웃라인 승인 · 플롯 보드는 기존 row 유지', 'ok');
}

// ---------------------------------------------------------------------------
// 회차 계획 단계
// ---------------------------------------------------------------------------

export async function runEpisodeBriefAction(): Promise<boolean> {
  const ep = episode();
  beginStepUsage('episode-brief');
  try {
    const input = await planningInputFor(ep);
    const fallback = buildLocalEpisodeBrief(input);
    const agent = await agentCall('episode-brief', episodeBriefPrompt(input), `episode-brief-${ep}`);
    const brief = agent.ok && agent.text.trim() ? parseEpisodeBrief(agent.text, fallback) : null;
    const finalBrief = brief ?? fallback;
    const content = renderEpisodeBriefArtifact(finalBrief);
    recordArtifact('episode-brief', ep, finalBrief.source === 'agent' ? '회차 브리프' : '회차 브리프(로컬)', content);
    reportStepExec('episode-brief', finalBrief.source === 'agent' ? 'agent' : 'fallback');
    toasts.push(
      finalBrief.source === 'agent' ? '회차 브리프 생성됨 · 장면 계획의 기준으로 사용' : '로컬 회차 브리프 생성됨 · AI 연결 후 다시 실행하면 더 정밀해집니다',
      finalBrief.source === 'agent' ? 'ok' : 'warn'
    );
    return true;
  } catch {
    toasts.push('회차 브리프 생성 실패', 'bad');
    return false;
  }
}

export async function runScenePlanAction(): Promise<boolean> {
  const ep = episode();
  beginStepUsage('scene-plan');
  try {
    const briefArtifact = latestArtifact('episode-brief', ep);
    if (!briefArtifact) {
      toasts.push('장면 계획 전에 회차 브리프를 먼저 실행하세요', 'warn');
      return false;
    }
    const input = await planningInputFor(ep);
    const briefFallback = buildLocalEpisodeBrief(input);
    const brief = parseEpisodeBrief(briefArtifact.content, briefFallback) ?? briefFallback;
    const fallback = buildLocalScenePlan(input, brief);
    const agent = await agentCall('scene-plan', scenePlanPrompt(input, brief), `scene-plan-${ep}`);
    const plan = agent.ok && agent.text.trim() ? parseScenePlan(agent.text, fallback) : null;
    const finalPlan = plan ?? fallback;
    const content = renderScenePlanArtifact(finalPlan);
    recordArtifact('scene-plan', ep, finalPlan.source === 'agent' ? '장면 계획' : '장면 계획(로컬)', content);
    reportStepExec('scene-plan', finalPlan.source === 'agent' ? 'agent' : 'fallback');
    toasts.push(
      finalPlan.source === 'agent' ? `장면 계획 생성됨 · ${finalPlan.scenes.length}개 카드` : `로컬 장면 계획 생성됨 · ${finalPlan.scenes.length}개 카드`,
      finalPlan.source === 'agent' ? 'ok' : 'warn'
    );
    return true;
  } catch {
    toasts.push('장면 계획 생성 실패', 'bad');
    return false;
  }
}

function repairJsonPrompt(kind: string, schema: string, invalidOutput: string, reason: string): string {
  return [
    `아래 ${kind} 출력이 Bindery 스키마 검증에 실패했다.`,
    `실패 이유: ${reason}`,
    '새 내용을 창작하지 말고, 원래 출력에서 복구 가능한 정보만 사용해 JSON object 하나만 다시 출력하라.',
    '설명, 마크다운 fence, 사과 문구를 붙이지 않는다.',
    '',
    '## Required schema example',
    schema,
    '',
    '## Invalid output',
    invalidOutput.slice(0, 12000)
  ].join('\n');
}

function normalizeQAAgentOutput(text: string, episodeId: string): { ok: boolean; markdown?: string; reason?: string } {
  const check = validateQAReportEnvelope(text);
  if (!check.ok || !check.envelope) return { ok: false, reason: check.reason ?? 'invalid QA envelope' };
  const prose = text.replace(/<!--\s*bindery:qa-json\s*[\s\S]*?-->/i, '').trim();
  return { ok: true, markdown: renderQAReportEnvelopeMarkdown({ ...check.envelope, episode: check.envelope.episode || episodeId }, prose) };
}

async function runQATextWithRepair(ep: string, prompt: string): Promise<string | null> {
  const agent = await agentCall('qa', prompt, `qa-${ep}`);
  if (!agent.ok) return null;
  const normalized = normalizeQAAgentOutput(agent.text, ep);
  if (normalized.ok && normalized.markdown) return normalized.markdown;

  const repair = await agentCall(
    'qa',
    repairJsonPrompt('QAReportEnvelope', qaReportEnvelopeSchemaText(ep), agent.text, normalized.reason ?? 'invalid QA output'),
    `qa-repair-${ep}`
  );
  if (repair.ok) {
    const repaired = normalizeQAAgentOutput(repair.text, ep);
    if (repaired.ok && repaired.markdown) return repaired.markdown;
  }
  toasts.push(`QA 산출물 스키마 복구 실패: ${normalized.reason ?? 'invalid output'} · novelctl 보고서로 대체`, 'warn');
  return null;
}

function buildDraftEnvelopePrompt(ep: string, kind: string, base: string, guidance: string): string {
  return [
    '너는 한국어 장기 연재소설 집필 에이전트다.',
    '초안 후보를 freeform markdown으로 출력하지 말고 DraftCandidateEnvelope JSON object 하나만 출력하라.',
    'manuscript_md에는 사용자가 검토할 완성 후보 원고 markdown만 넣는다.',
    '회차 브리프와 장면 계획을 hard constraint로 따른다. 계획에 없는 설정 변경은 canon_delta_candidates에 제안으로만 분리한다.',
    '',
    '## Required schema example',
    draftCandidateEnvelopeSchemaText(),
    '',
    `## Episode`,
    ep,
    '',
    `## Task`,
    kind,
    '',
    '## Guidance',
    guidance.trim() || '(없음)',
    '',
    '## Current manuscript',
    base || '(빈 원고)'
  ].join('\n');
}

function candidateFromEnvelope(envelope: NonNullable<ReturnType<typeof validateDraftCandidateEnvelope>['envelope']>, kind: string): Candidate {
  return {
    id: `env-${envelope.candidate_id}-${Date.now()}`,
    label: '후보',
    content: envelope.manuscript_md,
    source: `${kind} · DraftCandidateEnvelope · score ${envelope.style_self_check.score}`,
    createdAt: new Date().toISOString()
  };
}

async function runDraftEnvelopeCandidate(ep: string, kind: string, base: string, guidance: string): Promise<Candidate[] | null> {
  const prompt = buildDraftEnvelopePrompt(ep, kind, base, guidance);
  const agent = await agentCall('draft', prompt, `draft-envelope-${ep}`);
  if (!agent.ok) return null;
  let check = validateDraftCandidateEnvelope(agent.text, base);
  if (!check.ok) {
    const repair = await agentCall(
      'draft',
      repairJsonPrompt('DraftCandidateEnvelope', draftCandidateEnvelopeSchemaText(), agent.text, check.reason ?? 'invalid draft candidate output'),
      `draft-envelope-repair-${ep}`
    );
    if (repair.ok) check = validateDraftCandidateEnvelope(repair.text, base);
  }
  if (check.ok && check.envelope) return [candidateFromEnvelope(check.envelope, kind)];
  toasts.push(`초안 후보 스키마 복구 실패: ${check.reason ?? 'invalid output'} · 기존 후보 생성기로 대체`, 'warn');
  return null;
}

/** 실제 QA 프롬프트 — 문체 지침·이전 회차 요약을 포함해 게이트 검사를 요청한다. */
function buildQAPrompt(ep: string, manuscript: string, targetLabel: string): string {
  const style = get(styleStore);
  const prev = prevEpisode(ep);
  const prevSummary = prev ? latestArtifact('summarize', prev) : null;
  const episodeBrief = latestArtifact('episode-brief', ep);
  const scenePlan = latestArtifact('scene-plan', ep);
  const parts = [
    `너는 한국어 장편 연재소설의 QA 검수자다. 아래 원고를 게이트별로 0~100점 채점하고 이슈를 도출하라.`,
    `검사 대상: ${targetLabel}`,
    `게이트: 플롯, 회차 브리프 준수, 장면 계획 준수, 연속성, 문체, 목소리, 어휘, 장면 패턴${style.guideline ? ', 문체 준수' : ''}`,
    `시점(POV) 위반은 본문에서 직접 인용 가능한 줄 근거가 있을 때만 fail로 판정하고, 근거가 추정이면 info로 낮춰라.`,
    `보고서는 마크다운으로 쓰되, 마지막에 반드시 아래 형식의 JSON 블록을 포함하라:`,
    `<!-- bindery:qa-json`,
    `발췌 입력인 경우 앞/중간/끝을 모두 근거로 보되, 발췌 밖 사건은 추정이라고 표시하라.`,
    qaReportEnvelopeSchemaText(ep),
    `-->`
  ];
  if (prevSummary) {
    parts.push('', `## 이전 회차(${prev}) 요약: 연속성 게이트는 이 요약과의 모순을 검사하라`, prevSummary.content.slice(0, 1200));
  }
  if (style.guideline) {
    parts.push('', '## 문체 지침서: 문체 준수 게이트의 기준', style.guideline.slice(0, 2000));
  }
  if (episodeBrief) {
    parts.push('', '## 회차 브리프: 플롯/지식/금지사항 게이트 기준', episodeBrief.content.slice(0, 1800));
  }
  if (scenePlan) {
    parts.push('', '## 장면 계획: 장면 기능/turn/exit hook 게이트 기준', scenePlan.content.slice(0, 2200));
  }
  parts.push('', `## 원고 (${ep} · ${targetLabel})`, manuscriptContextWindow(manuscript, {
    maxChars: 14000,
    frontChars: 5200,
    middleChars: 3000,
    tailChars: 5600,
    label: `${ep} QA`
  }));
  return parts.join('\n');
}

/** 지침서 금지어 스캔 결과를 QA 이슈로 변환해 붙인다. */
function styleComplianceIssues(content: string): QAIssue[] {
  const guideline = get(styleStore).guideline;
  if (!guideline) return [];
  return checkStyleCompliance(content, guideline).map((h) => ({
    severity: 'warn' as const,
    source: 'style-compliance',
    title: `금지 표현 사용: ${h.term}`,
    message: `문체 지침서의 금지 목록에 있는 '${h.term}'이(가) ${h.count}회 사용되었습니다.`,
    lineStart: h.line,
    suggestedAction: '지침서의 대체 원칙(감정을 사물·행동에 얹기)에 따라 바꿔 쓰세요.'
  }));
}

export type QATargetKind = 'current-editor' | 'candidate';

/** QA — 기본은 현재 에디터 원고, 'candidate'면 선택된 후보 본문을 검사한다.
 *  결과에는 검사 대상과 content hash가 함께 남는다. */
export async function runQAAction(targetKind: QATargetKind = 'current-editor'): Promise<boolean> {
  const ep = episode();
  const cand = get(candidateStore);
  const active = cand.candidates.find((c) => c.id === cand.activeId) ?? null;
  if (targetKind === 'candidate' && !active) {
    toasts.push('선택된 후보가 없습니다. 후보를 먼저 선택하세요', 'warn');
    return false;
  }
  const manuscript = targetKind === 'candidate' && active ? active.content : get(editorStore).content;
  const target: QATarget = targetKind === 'candidate' && active
    ? { kind: 'candidate', label: `${active.label} (후보)`, episode: ep, contentHash: contentHash(manuscript), candidateId: active.id, candidateLabel: active.label }
    : { kind: 'current-editor', label: '현재 원고', episode: ep, contentHash: contentHash(manuscript) };

  qaStore.update((s) => ({ ...s, running: true, target }));
  beginStepUsage('qa');
  try {
    // 1순위: 에이전트 실검사. 실패 시 novelctl 보고서/기본 보고서로 폴백.
    let report = '';
    let usedAgent = false;
    const agentReport = await runQATextWithRepair(ep, buildQAPrompt(ep, manuscript, target.label));
    const qaContract = agentReport ? validateQAContract(agentReport) : { ok: false, reason: 'agent unavailable' };
    if (agentReport && qaContract.ok) {
      report = agentReport;
      usedAgent = true;
    } else {
      report = (await runQA(projectRoot(), ep)).report;
    }
    const parsed = parseQAReport(report);
    // 클라이언트 문체 준수 게이트 — 금지어 스캔 이슈를 항상 병합 (검사 대상 본문 기준)
    const compliance = styleComplianceIssues(manuscript);
    if (compliance.length) {
      parsed.issues = [...compliance, ...parsed.issues];
      if (parsed.verdict === 'pass') parsed.verdict = 'warn';
    }
    qaStore.update((s) => ({ ...s, report: parsed, raw: report, running: false, target }));
    recordArtifact('qa', ep, `QA ${verdictLabel[parsed.verdict]} ${parsed.score ?? ''} · 대상 ${target.label} · ${shortHash(manuscript)}`.trim(), report);
    reportStepExec('qa', usedAgent ? 'agent' : 'fallback');
    toasts.push(
      `QA 완료(${target.label}) ${verdictLabel[parsed.verdict]} (${parsed.score ?? '-'})${compliance.length ? ` · 금지 표현 ${compliance.length}건` : ''}`,
      parsed.verdict === 'fail' ? 'bad' : parsed.verdict === 'warn' ? 'warn' : 'ok'
    );
    return parsed.verdict !== 'fail';
  } catch (e) {
    qaStore.update((s) => ({ ...s, running: false }));
    toasts.push('QA 실행 실패', 'bad');
    return false;
  }
}

function buildRevisionPrompt(ep: string): string {
  const qa = get(qaStore);
  const issueLines = (qa.report?.issues ?? [])
    .map((i) => `- [${i.severity}] ${i.title ?? ''} ${i.message}${i.lineStart ? ` (L${i.lineStart})` : ''}`)
    .join('\n');
  return [
    `너는 한국어 연재소설의 퇴고 편집자다. 아래 QA 이슈를 바탕으로 우선순위가 매겨진 수정 계획 체크리스트를 작성하라.`,
    `형식: 각 항목을 "- [ ] [fail|warn|info] <구체적 수정 지시>" 한 줄로. 심각도 높은 것부터. 항목은 10개 이하.`,
    `수정 지시는 실행 가능한 동사형으로 쓰고, 원문 위치(L줄번호)가 있으면 유지하라.`,
    '',
    `## QA 이슈 (${ep}${qa.target ? ` · 대상 ${qa.target.label}` : ''})`,
    issueLines || '(이슈 없음: 리듬과 반복 관점의 개선 항목을 스스로 제안하라)',
    '',
    '## QA 보고서 원문',
    (qa.raw ?? '').slice(0, 3000)
  ].join('\n');
}

export async function runRevisionAction(): Promise<boolean> {
  const ep = episode();
  revisionStore.update((s) => ({ ...s, generating: true }));
  beginStepUsage('revise');
  try {
    // 1순위: QA 이슈 기반 에이전트 생성. 실패 시 기본 계획 폴백.
    let plan = '';
    let usedAgent = false;
    const agent = await agentCall('revise', buildRevisionPrompt(ep), `revise-${ep}`);
    if (agent.ok && agent.text.trim()) {
      plan = agent.text;
      usedAgent = true;
    } else {
      plan = (await generateRevisionPlan(projectRoot(), ep)).plan;
    }
    revisionStore.update((s) => ({ ...s, items: parseRevisionPlan(plan), raw: plan, generating: false }));
    recordArtifact('revise', ep, '수정 계획', plan);
    reportStepExec('revise', usedAgent ? 'agent' : 'fallback');
    toasts.push('수정 계획 생성됨', 'ok');
    return true;
  } catch {
    revisionStore.update((s) => ({ ...s, generating: false }));
    toasts.push('수정 계획 생성 실패', 'bad');
    return false;
  }
}

/** 컨텍스트 팩 — 이전 회차 요약, 원고에 등장하는 설정 항목, 열린 떡밥을 모아
 *  집필 입력을 구성한다. 결과는 집필 프롬프트의 「컨텍스트 팩」 블록으로 자동 반영된다. */
export async function runContextAction() {
  const ep = episode();
  const prev = prevEpisode(ep);
  const prevSummary = await previousSummaryFor(ep);
  const prevTail = await previousManuscriptTail(ep);
  const outlineRow = outlineRowFor(get(outlineStore).outline, ep);
  const episodeBrief = latestArtifact('episode-brief', ep);
  const scenePlan = latestArtifact('scene-plan', ep);
  const openThreads = await readOpenThreads();
  const manuscript = get(editorStore).content;
  const relevant = get(codexStore).items.filter((c) => manuscript.includes(c.name));
  const content = [
    `# 컨텍스트 팩: ${ep}`,
    '',
    '## 승인 아웃라인 (이 회차)',
    outlineRow ? `- [${outlineRow.status === 'approved' ? '승인' : '미승인'}] ${outlineRow.title}: ${outlineRow.logline}` : '(작품 아웃라인 없음: 파이프라인의 작품 플롯 탭에서 생성/승인하세요)',
    '',
    '## 회차 브리프',
    episodeBrief ? episodeBrief.content.slice(0, 1400) : '(회차 브리프 없음: 초안 전에 회차 브리프 단계를 실행하세요)',
    '',
    '## 장면 계획',
    scenePlan ? scenePlan.content.slice(0, 1800) : '(장면 계획 없음: 초안 전에 장면 계획 단계를 실행하세요)',
    '',
    '## 이전 회차 요약',
    prevSummary ? prevSummary.slice(0, 1200) : prev ? `(${prev} 요약 없음, 요약 단계를 먼저 실행하면 연속성이 강해집니다)` : '(첫 회차입니다)',
    '',
    '## 이전 회차 최종 원고 끝부분 (사람 확정본)',
    prevTail ? prevTail.slice(-1400) : prev ? `(${prev} 원고 파일을 찾지 못했습니다)` : '(첫 회차입니다)',
    '',
    '## 관련 설정 항목 (원고에 등장)',
    relevant.length ? relevant.map((c) => `- ${c.name} (${c.type}): ${c.summary ?? ''}`).join('\n') : '(원고에서 감지된 설정 항목이 없습니다)',
    '',
    '## 열린 떡밥',
    openThreads.trim() ? openThreads.trim().slice(0, 800) : '(plot/open-threads.md 없음)'
  ].join('\n');
  recordArtifact('context', ep, '컨텍스트 팩', content);
  reportStepExec('context', 'static');
  toasts.push('컨텍스트 팩 구성됨 · 초안 프롬프트에 반영', 'ok');
}

/** 회차 요약 — 에이전트로 원고를 요약하고, 실패 시 로컬 요약으로 폴백한다.
 *  결과는 canon/summaries/{ep}.md로 환류돼 다음 회차 연속성 게이트가 참조한다. */
export async function runSummarizeAction() {
  const ep = episode();
  const manuscript = get(editorStore).content;
  beginStepUsage('summarize');
  const prompt = [
    '너는 한국어 연재소설 편집자다. 아래 원고를 다음 회차 집필과 연속성 검사에 쓸 요약으로 정리하라.',
    '아래 마크다운 형식을 그대로 채워라. 설명 문장은 넣지 말고 요약만 쓴다.',
    '## 한 줄 요약',
    '- (한 문장)',
    '## 장면 흐름',
    '- (사건 순서대로 3~5개)',
    '## 인물 상태 변화',
    '- 인물: 무엇이 바뀌었는지',
    '## 열린 떡밥',
    '- (다음 회차로 넘어가는 미해결 요소)',
    '',
    `## 원고 (${ep})`,
    manuscriptContextWindow(manuscript, {
      maxChars: 15000,
      frontChars: 5200,
      middleChars: 3200,
      tailChars: 6200,
      label: `${ep} summary`
    })
  ].join('\n');
  const agent = await agentCall('summarize', prompt, `summarize-${ep}`);
  const usedAgent = agent.ok && Boolean(agent.text.trim());
  const summary = usedAgent ? agent.text.trim() : localSummary(manuscript);
  recordArtifact('summarize', ep, usedAgent ? '회차 요약' : '회차 요약(오프라인)', summary);
  await writeFile(projectRoot(), `canon/summaries/${ep}.md`, `# ${ep} 요약\n\n${summary}\n`).catch(() => {});
  reportStepExec('summarize', usedAgent ? 'agent' : 'fallback');
  toasts.push(usedAgent ? '회차 요약 생성됨 · canon/summaries 반영' : '오프라인 요약 생성됨 · canon/summaries 반영', usedAgent ? 'ok' : 'warn');
}

/** AI 미연결 시 폴백 — 원고 앞부분과 기본 통계로 최소 요약을 만든다(정직하게 오프라인임을 표시). */
function localSummary(manuscript: string): string {
  const body = manuscript
    .replace(/^---[\s\S]*?\n---\n?/, '')
    .replace(/^#.*$/gm, '')
    .trim();
  const chars = body.replace(/\s/g, '').length;
  const paras = body.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const lead = paras.slice(0, 2).join(' ').slice(0, 180);
  return [
    '## 한 줄 요약',
    `- ${lead ? `${lead}…` : '(원고 내용 없음)'}`,
    '## 통계',
    `- 공백 제외 ${chars.toLocaleString()}자 · 문단 ${paras.length}개`,
    '',
    '> AI 실행기 미연결 상태의 오프라인 요약입니다. 연결 후 다시 실행하면 장면 흐름·인물 상태·떡밥이 채워집니다.'
  ].join('\n');
}

/** 기록·픽스 — 현재 원고를 스냅샷하고 회차를 픽스 상태로 남긴다.
 *  픽스된 원고 파일이 다음 회차 계획의 연속성 입력이 된다. */
export async function runCommitAction() {
  const ep = episode();
  const ed = get(editorStore);
  const target = ed.path || 'manuscript.md';
  const qa = get(qaStore);
  const run = get(runStore).active;
  const snap = await createSnapshot(projectRoot(), target, `${ep} 파이프라인 기록`, ed.content);
  const hash = contentHash(ed.content);
  const journal = [
    `# 기록·픽스: ${ep}`,
    '',
    `- 시각: ${new Date().toLocaleString()}`,
    `- 대상: ${target}`,
    `- 스냅샷: ${snap.id}`,
    `- sha256: ${snap.sha256}`,
    `- content hash: ${hash}`,
    `- 분량: 공백 제외 ${ed.content.replace(/\s/g, '').length.toLocaleString()}자`,
    `- QA: ${qa.report ? `${qa.report.verdict} (${qa.report.score ?? '-'})${qa.target ? ` · 대상 ${qa.target.label}` : ''}` : '미실행'}`,
    run ? `- run: ${run.runId}` : ''
  ].filter(Boolean).join('\n');
  recordArtifact('commit', ep, '기록·픽스 저널', journal);
  setEpisodeProgress(ep, { status: 'fixed', fixedAt: new Date().toISOString(), runId: run?.runId, manuscriptPath: target, contentHash: hash });
  reportStepExec('commit', 'static');
  toasts.push(`스냅샷 기록됨: ${snap.id} · ${ep} 픽스`, 'ok');
}

function draftSourceGuidance(ctx?: DraftSourceContext): string {
  if (!ctx) return '';
  const parts: string[] = [];
  if (ctx.command) parts.push(`- 슬래시 명령: /${ctx.command}`);
  if (typeof ctx.cursorOffset === 'number') parts.push(`- 커서 위치: ${ctx.cursorOffset.toLocaleString()}번째 문자 근처`);
  if (ctx.selectedText?.trim()) {
    parts.push('', '### 선택 영역', ctx.selectedText.trim().slice(0, 4000));
  } else if (ctx.cursorContext?.trim()) {
    parts.push('', '### 커서 주변 문맥', ctx.cursorContext.trim().slice(0, 3000));
  }
  return parts.length ? `### 에디터 실행 단위\n${parts.join('\n')}` : '';
}

export async function runDraftAction(kind: 'draft' | 'revise' | 'continue' | 'rewrite' = 'draft', ctx?: DraftSourceContext): Promise<boolean> {
  candidateStore.update((s) => ({ ...s, generating: true }));
  beginStepUsage('draft');
  try {
    const base = get(editorStore).content;
    const ep = episode();
    const hasBrief = Boolean(latestArtifact('episode-brief', ep));
    const hasScenePlan = Boolean(latestArtifact('scene-plan', ep));
    if (!hasBrief || !hasScenePlan) {
      candidateStore.update((s) => ({ ...s, generating: false }));
      toasts.push('초안 후보 전에 회차 브리프와 장면 계획을 먼저 실행하세요', 'warn');
      return false;
    }
    // 산출물(컨텍스트/요약/QA/수정계획/표현분석)과 문체 지침서를 참고 블록으로 전달
    const sourceGuidance = draftSourceGuidance(ctx);
    const guidance = [buildGuidanceText(ep), sourceGuidance].filter((s) => s.trim()).join('\n\n');
    // 환경설정의 후보 수만큼 확보한다. 에이전트 경로는 호출당 1개가 일반적이라
    // 부족하면 추가 호출하되, 빈 결과가 나오면 무한 반복하지 않는다.
    const targetCount = Math.max(1, Math.min(4, get(settingsStore).aiDefaultCandidateCount || 1));
    const collected: Candidate[] = [];
    let usedEnvelope = false;
    for (let attempt = 0; collected.length < targetCount && attempt <= targetCount; attempt++) {
      const variation = attempt > 0 ? `\n\n### 후보 변주 지시\n이전 후보와 다른 접근(장면 진입, 리듬, 묘사 초점)을 시도하라. 사건과 확정 설정은 동일하게 유지한다.` : '';
      const envelopeBatch = await runDraftEnvelopeCandidate(ep, kind, base, guidance + variation);
      if (envelopeBatch) usedEnvelope = true;
      const batch = (envelopeBatch ?? (await generateCandidate(projectRoot(), ep, kind, base, guidance + variation)))
        .filter((c) => validateCandidateMarkdown(c.content, base).ok);
      if (!batch.length) break;
      collected.push(...batch);
    }
    if (!collected.length) throw new Error('agent returned no usable candidate markdown');
    const labels = ['후보 A', '후보 B', '후보 C', '후보 D'];
    const candidates = collected.slice(0, targetCount).map((c, i) => ({ ...c, id: `${c.id}-${i}`, label: labels[i] ?? c.label }));
    // 생성 시점 baseline 세션 — 이후 diff/QA가 "무엇을 기준으로 만들어졌는지" 고정
    const basisArtifactIds = (['episode-brief', 'scene-plan', 'context', 'qa', 'revise', 'analyze', 'summarize'] as PipelineStep[])
      .map((step) => latestArtifact(step, ep)?.id)
      .filter((id): id is string => Boolean(id));
    candidateStore.set({
      candidates,
      activeId: candidates[0]?.id ?? null,
      generating: false,
      appliedHunks: new Set(),
      sessionSnapshotId: null,
      session: {
        episode: ep,
        manuscriptPath: get(editorStore).path || 'manuscript.md',
        baselineContent: base,
        baselineHash: contentHash(base),
        candidateCountRequested: targetCount,
        basisArtifactIds,
        createdAt: new Date().toISOString()
      }
    });
    for (const c of candidates) recordArtifact('draft', ep, `${c.label} (${kind}) · baseline ${shortHash(base)}`, c.content);
    setEpisodeProgress(ep, { status: 'drafting' });
    reportStepExec('draft', usedEnvelope ? 'agent' : 'fallback');
    gotoPipeline('review');
    toasts.push(`후보 ${candidates.length}개 생성됨: 검토 단계에서 비교하세요`, 'ok');
    return true;
  } catch {
    candidateStore.update((s) => ({ ...s, generating: false }));
    toasts.push('후보 생성 실패', 'bad');
    return false;
  }
}

export async function runAnalyzeAction(mode?: AnalysisMode): Promise<boolean> {
  const ed = get(editorStore);
  const useMode = mode ?? get(analysisStore).mode;
  analysisStore.update((s) => ({ ...s, running: true, mode: useMode }));
  try {
    // Analyze the real open document client-side so decorations and the panel
    // always reflect actual text. A native analyzer can be swapped in later.
    const report = analyzeManuscript(ed.content, useMode);
    analysisStore.update((s) => ({ ...s, running: false, repetition: report }));
    const flagged = report.terms.filter((t) => t.judgment !== 'ok');
    const md = [
      '# 표현 분석 보고',
      '',
      ...(flagged.length
        ? flagged.map((t) => `- **${t.term}** ×${t.count} (${t.judgment === 'overused' ? '과다' : '주의'})${t.kind && t.kind !== 'word' ? ` · ${t.kind}` : ''}`)
        : ['- 임계치를 넘는 반복 없음'])
    ].join('\n');
    recordArtifact('analyze', episode(), `표현 분석 · 플래그 ${flagged.length}`, md);
    reportStepExec('analyze', 'static');
    toasts.push(`반복 분석 완료: ${flagged.length}개 표현 플래그`, flagged.length ? 'warn' : 'ok');
    return true;
  } catch {
    analysisStore.update((s) => ({ ...s, running: false }));
    toasts.push('반복 분석 실패', 'bad');
    return false;
  }
}

export async function loadCodexAction() {
  codexStore.update((s) => ({ ...s, loading: true }));
  const items = await listCodex(projectRoot());
  codexStore.update((s) => ({ ...s, items, loading: false }));
}

export async function scanCodexAction() {
  const ed = get(editorStore);
  codexStore.update((s) => ({ ...s, loading: true }));
  const report = await scanCodexLinks(projectRoot(), ed.path || 'manuscript.md', ed.content);
  codexStore.update((s) => ({ ...s, mentionReport: report, loading: false }));
  uiStore.update((s) => ({ ...s, binderTab: 'bible' }));
  toasts.push(`본문 링크 ${report.mentions.length}개 감지`, 'info');
}

const PLOT_BOARD_PATH = 'plot/plot-board.json';

export async function loadPlotAction() {
  plotStore.update((s) => ({ ...s, loading: true }));
  // 프로젝트에 저장된 보드가 있으면 그것이 진실이다. 없을 때만 기본 그리드.
  try {
    const raw = await readFile(projectRoot(), PLOT_BOARD_PATH);
    const grid = JSON.parse(raw);
    if (grid?.plotlines && grid?.rows) {
      plotStore.update((s) => ({ ...s, grid, loading: false }));
      return;
    }
  } catch {
    /* 저장된 보드 없음 — 기본 그리드로 폴백 */
  }
  const grid = await getPlotGrid(projectRoot());
  plotStore.update((s) => ({ ...s, grid, loading: false }));
}

export async function savePlotAction() {
  const grid = get(plotStore).grid;
  if (!grid) return;
  try {
    await writeFile(projectRoot(), PLOT_BOARD_PATH, JSON.stringify(grid, null, 2));
    toasts.push(`플롯 보드 저장됨: ${PLOT_BOARD_PATH}`, 'ok');
  } catch (e) {
    toasts.push(`플롯 보드 저장 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
  }
}
