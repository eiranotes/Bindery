// 파이프라인 러너 — 모든 AI 단계 실행의 단일 경로.
// 프롬프트 조립(blueprint) → 에이전트 실행 → 스키마 파싱 → (실패 시 repair 1회)
// → (그래도 실패면 로컬 폴백) → run 기록 저장.
// UI를 모르고, 어떤 단계인지도 모른다. StageRunSpec이 전부다.
import { renderBlueprint } from '$lib/core/blueprint';
import { nowIso, stamp } from '$lib/core/text';
import { runPath, LAYOUT } from '$lib/core/layout';
import type { Ctx, RunListener, RunRecord, StageOutcome, StageRunSpec } from './types';
import type { AgentResult } from '$lib/bridge';

const listeners = new Set<RunListener>();

export function onRun(listener: RunListener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(record: RunRecord): void {
  for (const l of listeners) l(record);
}

function repairPrompt(hint: string, invalidOutput: string, reason: string): string {
  return [
    '직전 출력이 스키마 검증에 실패했다.',
    `실패 이유: ${reason}`,
    '새 내용을 창작하지 말고, 직전 출력에서 복구 가능한 정보만 사용해 요구 형식의 JSON object 하나만 다시 출력하라.',
    '설명·사과·코드펜스 밖 텍스트를 붙이지 않는다.',
    '',
    '## 요구 형식',
    hint,
    '',
    '## 직전 출력',
    invalidOutput.slice(0, 12000)
  ].join('\n');
}

async function persistRun(ctx: Ctx, record: RunRecord): Promise<void> {
  try {
    await ctx.bridge.writeFile(ctx.root, runPath(record.runId), JSON.stringify(record, null, 2));
    // 인덱스는 최근 200개만 유지
    let index: RunRecord[] = [];
    try {
      index = JSON.parse(await ctx.bridge.readFile(ctx.root, `${LAYOUT.bindery.runs}/index.json`)) as RunRecord[];
    } catch {
      /* 첫 run */
    }
    index.unshift(record);
    await ctx.bridge.writeFile(ctx.root, `${LAYOUT.bindery.runs}/index.json`, JSON.stringify(index.slice(0, 200), null, 2));
  } catch {
    /* run 기록 실패는 흐름을 막지 않는다 */
  }
}

export async function loadRunIndex(ctx: Ctx): Promise<RunRecord[]> {
  try {
    return JSON.parse(await ctx.bridge.readFile(ctx.root, `${LAYOUT.bindery.runs}/index.json`)) as RunRecord[];
  } catch {
    return [];
  }
}

/** 단계 실행. agent-first, 실패는 정직하게 fallback으로 기록된다. */
export async function runStage<T>(ctx: Ctx, spec: StageRunSpec<T>): Promise<StageOutcome<T>> {
  const startedAt = nowIso();
  const t0 = Date.now();
  const prompt = renderBlueprint(spec.blueprint, spec.vars);
  const runId = `${stamp()}-${spec.stage}-${spec.scope}`;

  let agentResult: AgentResult | undefined;
  let output: T | null = null;
  let source: 'agent' | 'fallback' = 'fallback';
  let repairUsed = false;
  let parseFailReason: string | undefined;

  if (!ctx.offline && ctx.agent.command.trim()) {
    agentResult = await ctx.bridge.runAgent(ctx.root, prompt, runId, ctx.agent);
    if (agentResult.ok) {
      output = spec.parse(agentResult.text);
      if (output == null && spec.repairHint) {
        parseFailReason = '1차 출력 스키마 검증 실패';
        repairUsed = true;
        const repair = await ctx.bridge.runAgent(
          ctx.root,
          repairPrompt(spec.repairHint, agentResult.text, parseFailReason),
          `${runId}-repair`,
          ctx.agent
        );
        if (repair.ok) output = spec.parse(repair.text);
        if (output == null) parseFailReason = 'repair 후에도 검증 실패';
      } else if (output == null) {
        parseFailReason = '출력 스키마 검증 실패';
      }
    } else {
      parseFailReason = `agent 실행 실패 (${agentResult.mode})`;
    }
    if (output != null) source = 'agent';
  } else if (ctx.offline) {
    parseFailReason = '오프라인 모드';
  } else {
    parseFailReason = 'agent 미설정';
  }

  if (output == null) output = await spec.fallback();

  const record: RunRecord = {
    runId,
    stage: spec.stage,
    scope: spec.scope,
    startedAt,
    finishedAt: nowIso(),
    durationMs: Date.now() - t0,
    source,
    promptChars: prompt.length,
    outputChars: agentResult?.text.length ?? 0,
    exitCode: agentResult?.exitCode ?? null,
    agentMode: agentResult?.mode ?? null,
    stderrTail: (agentResult?.stderr ?? '').slice(-1200),
    promptFile: agentResult?.promptFile,
    repairUsed,
    parseFailReason: source === 'agent' ? undefined : parseFailReason,
    command: ctx.agent.command,
    model: ctx.agent.model ?? ''
  };
  await persistRun(ctx, record);
  emit(record);
  return { output, source, prompt, run: record, agentResult };
}

/** 프롬프트만 조립해서 보여줄 때 (미리보기·웹 교환 packet). 실행하지 않는다. */
export function previewPrompt<T>(spec: Pick<StageRunSpec<T>, 'blueprint' | 'vars'>): string {
  return renderBlueprint(spec.blueprint, spec.vars);
}
