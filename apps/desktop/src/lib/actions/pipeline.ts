// Action layer: single place that runs pipeline steps and writes results into
// stores. Both the pipeline bar and the editor's AI command menu call these,
// so behaviour stays consistent no matter how a step is triggered.
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
import { parseQAReport, parseRevisionPlan } from '$lib/domain/reports';
import type { QAIssue } from '$lib/domain/reports';
import { checkStyleCompliance } from '$lib/domain/style';
import { styleStore } from '$lib/stores/styleStore';
import { latestArtifact } from '$lib/stores/artifactStore';
import { analyzeManuscript } from '$lib/domain/analysis';
import type { AnalysisMode } from '$lib/domain/analysis';
import { projectStore } from '$lib/stores/projectStore';
import { editorStore } from '$lib/stores/editorStore';
import { qaStore } from '$lib/stores/qaStore';
import { revisionStore } from '$lib/stores/revisionStore';
import { candidateStore } from '$lib/stores/candidateStore';
import { analysisStore } from '$lib/stores/analysisStore';
import { codexStore } from '$lib/stores/codexStore';
import { plotStore } from '$lib/stores/plotStore';
import { uiStore } from '$lib/stores/uiStore';
import { gotoStage } from '$lib/stores/pipelineStore';
import { recordArtifact } from '$lib/stores/artifactStore';
import { buildGuidanceText } from '$lib/domain/guidance';
import { toasts } from '$lib/stores/toastStore';

const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;

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

/** 실제 QA 프롬프트 — 문체 지침·이전 회차 요약을 포함해 게이트 검사를 요청한다. */
function buildQAPrompt(ep: string, manuscript: string): string {
  const style = get(styleStore);
  const prev = prevEpisode(ep);
  const prevSummary = prev ? latestArtifact('summarize', prev) : null;
  const parts = [
    `너는 한국어 장편 연재소설의 QA 검수자다. 아래 원고를 게이트별로 0~100점 채점하고 이슈를 도출하라.`,
    `게이트: 플롯, 연속성, 문체, 목소리, 어휘, 장면 패턴${style.guideline ? ', 문체 준수' : ''}`,
    `보고서는 마크다운으로 쓰되, 마지막에 반드시 아래 형식의 JSON 블록을 포함하라:`,
    `<!-- bindery:qa-json`,
    `{ "episode": "${ep}", "score": <종합점수>, "verdict": "pass|warn|fail", "issues": [ { "severity": "fail|warn|info", "source": "<게이트>", "title": "<제목>", "message": "<설명>", "lineStart": <줄번호|생략> } ] }`,
    `-->`
  ];
  if (prevSummary) {
    parts.push('', `## 이전 회차(${prev}) 요약 — 연속성 게이트는 이 요약과의 모순을 검사하라`, prevSummary.content.slice(0, 1200));
  }
  if (style.guideline) {
    parts.push('', '## 문체 지침서 — 문체 준수 게이트의 기준', style.guideline.slice(0, 2000));
  }
  parts.push('', `## 원고 (${ep})`, manuscript.slice(0, 8000));
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

export async function runQAAction() {
  qaStore.update((s) => ({ ...s, running: true }));
  try {
    const ep = episode();
    const manuscript = get(editorStore).content;
    // 1순위: 에이전트 실검사. 실패 시 novelctl 보고서/기본 보고서로 폴백.
    let report = '';
    const agent = await runAgentText(projectRoot(), buildQAPrompt(ep, manuscript), `qa-${ep}`);
    if (agent.ok && agent.text.includes('bindery:qa-json')) {
      report = agent.text;
    } else {
      report = (await runQA(projectRoot(), ep)).report;
    }
    const parsed = parseQAReport(report);
    // 클라이언트 문체 준수 게이트 — 금지어 스캔 이슈를 항상 병합
    const compliance = styleComplianceIssues(manuscript);
    if (compliance.length) {
      parsed.issues = [...compliance, ...parsed.issues];
      if (parsed.verdict === 'pass') parsed.verdict = 'warn';
    }
    qaStore.update((s) => ({ ...s, report: parsed, raw: report, running: false }));
    recordArtifact('qa', ep, `QA 보고서 · ${verdictLabel[parsed.verdict]} ${parsed.score ?? ''}`.trim(), report);
    toasts.push(`QA 완료 ${verdictLabel[parsed.verdict]} (${parsed.score ?? '-'})${compliance.length ? ` · 금지 표현 ${compliance.length}건` : ''}`, parsed.verdict === 'fail' ? 'bad' : parsed.verdict === 'warn' ? 'warn' : 'ok');
  } catch (e) {
    qaStore.update((s) => ({ ...s, running: false }));
    toasts.push('QA 실행 실패', 'bad');
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
    `## QA 이슈 (${ep})`,
    issueLines || '(이슈 없음 — 리듬과 반복 관점의 개선 항목을 스스로 제안하라)',
    '',
    '## QA 보고서 원문',
    (qa.raw ?? '').slice(0, 3000)
  ].join('\n');
}

export async function runRevisionAction() {
  revisionStore.update((s) => ({ ...s, generating: true }));
  try {
    const ep = episode();
    // 1순위: QA 이슈 기반 에이전트 생성. 실패 시 기본 계획 폴백.
    let plan = '';
    const agent = await runAgentText(projectRoot(), buildRevisionPrompt(ep), `revise-${ep}`);
    if (agent.ok && agent.text.trim()) {
      plan = agent.text;
    } else {
      plan = (await generateRevisionPlan(projectRoot(), ep)).plan;
    }
    revisionStore.update((s) => ({ ...s, items: parseRevisionPlan(plan), raw: plan, generating: false }));
    recordArtifact('revise', ep, '수정 계획', plan);
    toasts.push('수정 계획 생성됨', 'ok');
  } catch {
    revisionStore.update((s) => ({ ...s, generating: false }));
    toasts.push('수정 계획 생성 실패', 'bad');
  }
}

/** 컨텍스트 팩 — 이전 회차 요약, 원고에 등장하는 설정 항목, 열린 떡밥을 모아
 *  집필 입력을 구성한다. 결과는 집필 프롬프트의 「컨텍스트 팩」 블록으로 자동 반영된다. */
export async function runContextAction() {
  const ep = episode();
  const prev = prevEpisode(ep);
  const prevSummary = prev ? latestArtifact('summarize', prev) : null;
  let openThreads = '';
  try {
    openThreads = await readFile(projectRoot(), 'plot/open-threads.md');
  } catch {
    /* 열린 떡밥 파일이 없을 수 있음 */
  }
  const manuscript = get(editorStore).content;
  const relevant = get(codexStore).items.filter((c) => manuscript.includes(c.name));
  const content = [
    `# 컨텍스트 팩 — ${ep}`,
    '',
    '## 이전 회차 요약',
    prevSummary ? prevSummary.content.slice(0, 1200) : prev ? `(${prev} 요약 없음 — 요약 단계를 먼저 실행하면 연속성이 강해집니다)` : '(첫 회차입니다)',
    '',
    '## 관련 설정 항목 (원고에 등장)',
    relevant.length ? relevant.map((c) => `- ${c.name} (${c.type}): ${c.summary ?? ''}`).join('\n') : '(원고에서 감지된 설정 항목이 없습니다)',
    '',
    '## 열린 떡밥',
    openThreads.trim() ? openThreads.trim().slice(0, 800) : '(plot/open-threads.md 없음)'
  ].join('\n');
  recordArtifact('context', ep, '컨텍스트 팩', content);
  toasts.push('컨텍스트 팩 구성됨 · 초안 프롬프트에 반영', 'ok');
}

/** 회차 요약 — 에이전트로 원고를 요약하고, 실패 시 로컬 요약으로 폴백한다.
 *  결과는 canon/summaries/{ep}.md로 환류돼 다음 회차 연속성 게이트가 참조한다. */
export async function runSummarizeAction() {
  const ep = episode();
  const manuscript = get(editorStore).content;
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
    manuscript.slice(0, 8000)
  ].join('\n');
  const agent = await runAgentText(projectRoot(), prompt, `summarize-${ep}`);
  const summary = agent.ok && agent.text.trim() ? agent.text.trim() : localSummary(manuscript);
  recordArtifact('summarize', ep, agent.ok && agent.text.trim() ? '회차 요약' : '회차 요약(오프라인)', summary);
  await writeFile(projectRoot(), `canon/summaries/${ep}.md`, `# ${ep} 요약\n\n${summary}\n`).catch(() => {});
  toasts.push(agent.ok && agent.text.trim() ? '회차 요약 생성됨 · canon/summaries 반영' : '오프라인 요약 생성됨 · canon/summaries 반영', agent.ok && agent.text.trim() ? 'ok' : 'warn');
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

/** 기록 — 현재 원고를 스냅샷하고 기록 저널 산출물을 남긴다. */
export async function runCommitAction() {
  const ep = episode();
  const ed = get(editorStore);
  const target = ed.path || 'manuscript.md';
  const snap = await createSnapshot(projectRoot(), target, `${ep} 파이프라인 기록`, ed.content);
  const journal = [
    `# 기록 — ${ep}`,
    '',
    `- 시각: ${new Date().toLocaleString()}`,
    `- 대상: ${target}`,
    `- 스냅샷: ${snap.id}`,
    `- sha256: ${snap.sha256}`,
    `- 분량: 공백 제외 ${ed.content.replace(/\s/g, '').length.toLocaleString()}자`
  ].join('\n');
  recordArtifact('commit', ep, '기록 저널', journal);
  toasts.push(`스냅샷 기록됨: ${snap.id}`, 'ok');
}

export async function runDraftAction(kind: 'draft' | 'revise' | 'continue' | 'rewrite' = 'draft') {
  candidateStore.update((s) => ({ ...s, generating: true }));
  try {
    const base = get(editorStore).content;
    const ep = episode();
    // 산출물(컨텍스트/요약/QA/수정계획/표현분석)과 문체 지침서를 참고 블록으로 전달
    const guidance = buildGuidanceText(ep);
    const candidates = await generateCandidate(projectRoot(), ep, kind, base, guidance);
    candidateStore.set({ candidates, activeId: candidates[0]?.id ?? null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null });
    for (const c of candidates) recordArtifact('draft', ep, `${c.label} (${kind})`, c.content);
    gotoStage('review');
    uiStore.update((s) => ({ ...s, centerView: 'ai' }));
    toasts.push(`후보 ${candidates.length}개 생성됨: 검토 단계에서 비교하세요`, 'ok');
  } catch {
    candidateStore.update((s) => ({ ...s, generating: false }));
    toasts.push('후보 생성 실패', 'bad');
  }
}

export async function runAnalyzeAction(mode?: AnalysisMode) {
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
    toasts.push(`반복 분석 완료: ${flagged.length}개 표현 플래그`, flagged.length ? 'warn' : 'ok');
  } catch {
    analysisStore.update((s) => ({ ...s, running: false }));
    toasts.push('반복 분석 실패', 'bad');
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
