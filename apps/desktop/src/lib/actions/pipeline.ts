// Action layer: single place that runs pipeline steps and writes results into
// stores. Both the pipeline bar and the editor's AI command menu call these,
// so behaviour stays consistent no matter how a step is triggered.
import { get } from 'svelte/store';
import {
  runQA,
  generateRevisionPlan,
  generateCandidate,
  listCodex,
  scanCodexLinks,
  getPlotGrid
} from '$lib/api/commands';
import { parseQAReport, parseRevisionPlan } from '$lib/domain/reports';
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

export async function runQAAction() {
  qaStore.update((s) => ({ ...s, running: true }));
  try {
    const { report } = await runQA(projectRoot(), episode());
    const parsed = parseQAReport(report);
    qaStore.update((s) => ({ ...s, report: parsed, raw: report, running: false }));
    toasts.push(`QA 완료 ${verdictLabel[parsed.verdict]} (${parsed.score ?? '-'})`, parsed.verdict === 'fail' ? 'bad' : parsed.verdict === 'warn' ? 'warn' : 'ok');
  } catch (e) {
    qaStore.update((s) => ({ ...s, running: false }));
    toasts.push('QA 실행 실패', 'bad');
  }
}

export async function runRevisionAction() {
  revisionStore.update((s) => ({ ...s, generating: true }));
  try {
    const { plan } = await generateRevisionPlan(projectRoot(), episode());
    revisionStore.update((s) => ({ ...s, items: parseRevisionPlan(plan), raw: plan, generating: false }));
    toasts.push('수정 계획 생성됨', 'ok');
  } catch {
    revisionStore.update((s) => ({ ...s, generating: false }));
    toasts.push('수정 계획 생성 실패', 'bad');
  }
}

export async function runDraftAction(kind: 'draft' | 'revise' | 'continue' | 'rewrite' = 'draft') {
  candidateStore.update((s) => ({ ...s, generating: true }));
  try {
    const base = get(editorStore).content;
    const candidates = await generateCandidate(projectRoot(), episode(), kind, base);
    candidateStore.set({ candidates, activeId: candidates[0]?.id ?? null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null });
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
    const flagged = report.terms.filter((t) => t.judgment !== 'ok').length;
    toasts.push(`반복 분석 완료: ${flagged}개 표현 플래그`, flagged ? 'warn' : 'ok');
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

export async function loadPlotAction() {
  plotStore.update((s) => ({ ...s, loading: true }));
  const grid = await getPlotGrid(projectRoot());
  plotStore.update((s) => ({ ...s, grid, loading: false }));
}
