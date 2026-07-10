// 비용 가시성 — 토큰 추정 · 단가 · 누적 원장. (제품화 점검 §1.2)
//
// 원칙: 러너는 provider 단가를 모른다. 실행 시엔 토큰 추정치만 원장에 남기고,
// 요금은 표시 시점에 현재 단가 테이블로 곱한다. 그래서 사용자가 단가를 바꾸면
// 과거 사용량의 요금도 소급 재계산된다.
//
// 토큰은 추정치다. CLI가 실제 usage를 stdout으로 주지 않으므로 글자 수 기반
// 근사(한중일 문자와 그 외를 다른 비율로)로 계산하고, 모든 표기에 "추정"을 붙인다.
import { LAYOUT } from '$lib/core/layout';
import type { Ctx } from './types';

/** 모델별 단가 (USD / 1M 토큰). 사용자가 설정에서 편집한다. */
export type ModelRate = {
  match: string; // 모델 id 부분 문자열 (소문자 비교). 빈 문자열이면 기본값.
  label: string;
  inputPerM: number;
  outputPerM: number;
};

/** 2026년 초 공개가 기준의 보수적 기본값. 사용자가 자기 요금제로 덮어쓴다. */
export function defaultModelRates(): ModelRate[] {
  return [
    { match: 'opus', label: 'Claude Opus 급', inputPerM: 15, outputPerM: 75 },
    { match: 'sonnet', label: 'Claude Sonnet 급', inputPerM: 3, outputPerM: 15 },
    { match: 'haiku', label: 'Claude Haiku 급', inputPerM: 0.8, outputPerM: 4 },
    { match: 'gpt-5', label: 'GPT-5 급', inputPerM: 5, outputPerM: 15 },
    { match: 'o4', label: 'o4 급 추론', inputPerM: 10, outputPerM: 40 },
    { match: 'flash', label: 'Gemini Flash 급', inputPerM: 0.3, outputPerM: 2.5 },
    { match: 'pro', label: 'Gemini Pro 급', inputPerM: 2.5, outputPerM: 10 },
    { match: '', label: '기본값 (미매칭 모델)', inputPerM: 3, outputPerM: 15 }
  ];
}

export type UsageBudget = {
  monthlyUsd: number; // 0이면 상한 없음
};

/** 원장 1건 — 실행 시점에 남는다. 요금은 저장하지 않는다(단가 소급 반영). */
export type UsageEntry = {
  at: string;
  stage: string;
  scope: string;
  model: string;
  source: string;
  promptTokens: number;
  outputTokens: number;
};

/**
 * 글자 수 → 토큰 추정. CJK(한중일)는 1자당 토큰이 많고, 라틴/공백은 적다.
 * BPE 계열 토크나이저의 한국어 비용을 보수적으로 잡는다. 정확치가 아니라 추정치다.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let cjk = 0;
  for (const ch of text) {
    const code = ch.codePointAt(0) ?? 0;
    if (
      (code >= 0xac00 && code <= 0xd7a3) || // 한글 음절
      (code >= 0x3040 && code <= 0x30ff) || // 가나
      (code >= 0x4e00 && code <= 0x9fff) // 한자
    ) {
      cjk++;
    }
  }
  const other = [...text].length - cjk;
  // CJK 1자 ≈ 1.35 토큰, 그 외 ≈ 0.28 토큰(≈3.6자/토큰).
  return Math.round(cjk * 1.35 + other * 0.28);
}

/** 추정 토큰으로 원장 엔트리를 만든다 (러너가 promptChars/outputChars로 호출). */
export function usageEntryFromChars(input: {
  at: string;
  stage: string;
  scope: string;
  model: string;
  source: string;
  promptChars: number;
  outputChars: number;
}): UsageEntry {
  // 글자 수만 있고 원문이 없으므로 평균 비율로 역산 — 한국어 프로젝트 기준 보수값.
  return {
    at: input.at,
    stage: input.stage,
    scope: input.scope,
    model: input.model,
    source: input.source,
    promptTokens: Math.round(input.promptChars * 1.1),
    outputTokens: Math.round(input.outputChars * 1.1)
  };
}

const USAGE_PATH = `${LAYOUT.bindery.root}/usage.json`;
const USAGE_MAX = 5000;

export async function loadUsageLedger(ctx: Ctx): Promise<UsageEntry[]> {
  try {
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, USAGE_PATH)) as UsageEntry[];
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

export async function appendUsage(ctx: Ctx, entry: UsageEntry): Promise<void> {
  try {
    const ledger = await loadUsageLedger(ctx);
    ledger.unshift(entry);
    await ctx.bridge.writeFile(ctx.root, USAGE_PATH, JSON.stringify(ledger.slice(0, USAGE_MAX), null, 2));
  } catch {
    /* 사용량 기록 실패는 흐름을 막지 않는다 */
  }
}

export function rateFor(model: string, rates: ModelRate[]): ModelRate {
  const m = (model || '').toLowerCase();
  const specific = rates.find((r) => r.match && m.includes(r.match.toLowerCase()));
  return specific ?? rates.find((r) => r.match === '') ?? { match: '', label: '기본', inputPerM: 3, outputPerM: 15 };
}

/** 엔트리 1건의 추정 요금 (USD). agent가 아닌 source(fallback 등)는 0원. */
export function costOf(entry: UsageEntry, rates: ModelRate[]): number {
  if (entry.source !== 'agent') return 0;
  const rate = rateFor(entry.model, rates);
  return (entry.promptTokens / 1_000_000) * rate.inputPerM + (entry.outputTokens / 1_000_000) * rate.outputPerM;
}

export type UsageTotals = {
  promptTokens: number;
  outputTokens: number;
  costUsd: number;
  runs: number;
};

function empty(): UsageTotals {
  return { promptTokens: 0, outputTokens: 0, costUsd: 0, runs: 0 };
}

function add(t: UsageTotals, entry: UsageEntry, rates: ModelRate[]): void {
  t.promptTokens += entry.promptTokens;
  t.outputTokens += entry.outputTokens;
  t.costUsd += costOf(entry, rates);
  t.runs += 1;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

export type UsageSummary = {
  all: UsageTotals;
  thisMonth: UsageTotals;
  thisMonthKey: string;
  byScope: Array<{ scope: string; totals: UsageTotals }>;
  byMonth: Array<{ month: string; totals: UsageTotals }>;
  budgetUsd: number;
  budgetRatio: number; // thisMonth.cost / budget (0이면 상한 없음)
};

export function summarizeUsage(
  entries: UsageEntry[],
  rates: ModelRate[],
  budget: UsageBudget,
  now = new Date()
): UsageSummary {
  const nowMonth = now.toISOString().slice(0, 7);
  const all = empty();
  const thisMonth = empty();
  const scopeMap = new Map<string, UsageTotals>();
  const monthMap = new Map<string, UsageTotals>();

  for (const e of entries) {
    add(all, e, rates);
    if (monthKey(e.at) === nowMonth) add(thisMonth, e, rates);
    const s = scopeMap.get(e.scope) ?? empty();
    add(s, e, rates);
    scopeMap.set(e.scope, s);
    const m = monthMap.get(monthKey(e.at)) ?? empty();
    add(m, e, rates);
    monthMap.set(monthKey(e.at), m);
  }

  const budgetUsd = budget.monthlyUsd || 0;
  return {
    all,
    thisMonth,
    thisMonthKey: nowMonth,
    byScope: [...scopeMap.entries()]
      .map(([scope, totals]) => ({ scope, totals }))
      .sort((a, b) => b.totals.costUsd - a.totals.costUsd || b.totals.runs - a.totals.runs),
    byMonth: [...monthMap.entries()]
      .map(([month, totals]) => ({ month, totals }))
      .sort((a, b) => (a.month < b.month ? 1 : -1)),
    budgetUsd,
    budgetRatio: budgetUsd > 0 ? thisMonth.costUsd / budgetUsd : 0
  };
}

export function formatUsd(n: number): string {
  if (n <= 0) return '$0';
  if (n < 0.01) return '<$0.01';
  if (n < 10) return `$${n.toFixed(2)}`;
  return `$${n.toFixed(1)}`;
}

export function formatTokens(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${(n / 1000).toFixed(1)}K`;
  return `${(n / 1_000_000).toFixed(2)}M`;
}

// ---------------------------------------------------------------------------
// 실제 사용량 — 실행기(agy 등)의 /usage 명령 결과. 추정치가 아니라 제공자 집계.
// ---------------------------------------------------------------------------

export type ProviderUsage = {
  fetchedAt: string;
  command: string;
  ok: boolean;
  raw: string;
};

const PROVIDER_USAGE_PATH = `${LAYOUT.bindery.root}/provider-usage.json`;

export async function loadProviderUsage(ctx: Ctx): Promise<ProviderUsage | null> {
  try {
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, PROVIDER_USAGE_PATH)) as ProviderUsage;
    return raw && typeof raw.raw === 'string' ? raw : null;
  } catch {
    return null;
  }
}

/**
 * 실행기의 `/usage` 명령을 돌려 실제 사용량을 가져온다.
 * agy는 연결 후 `/usage`로 사용량을 조회할 수 있다 — 그 원문을 그대로 저장·표시한다.
 * (형식이 실행기마다 다르므로 파싱하지 않고 raw로 보여준다.)
 */
export async function fetchProviderUsage(ctx: Ctx): Promise<ProviderUsage> {
  const result = await ctx.bridge.runAgent(ctx.root, '/usage', 'usage-check', ctx.agent);
  const usage: ProviderUsage = {
    fetchedAt: new Date().toISOString(),
    command: ctx.agent.command,
    ok: result.ok && result.text.trim().length > 0,
    raw: (result.ok ? result.text : `${result.stderr || result.mode}`).slice(0, 8000).trim()
  };
  try {
    await ctx.bridge.writeFile(ctx.root, PROVIDER_USAGE_PATH, JSON.stringify(usage, null, 2));
  } catch {
    /* 저장 실패는 무시 */
  }
  return usage;
}
