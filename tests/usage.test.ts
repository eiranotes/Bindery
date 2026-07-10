// 비용 가시성 테스트 — 토큰 추정, 단가 매칭, 원장 누적/집계, 예산 비율.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge } from '../src/lib/bridge/memoryBridge';
import {
  appendUsage, costOf, defaultModelRates, estimateTokens, loadUsageLedger,
  parseAgyUsage, rateFor, summarizeProviderQuota, summarizeUsage, usageEntryFromChars, type UsageEntry
} from '../src/lib/harness/usage';
import type { Ctx } from '../src/lib/harness/types';

const ROOT = '/vault/비용';
const AGENT = { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };
const ctx: Ctx = { root: ROOT, bridge: memoryBridge, agent: AGENT };

beforeEach(() => resetMemoryBridge());

describe('토큰 추정', () => {
  it('한국어는 라틴보다 자당 토큰이 많다', () => {
    const ko = estimateTokens('가나다라마바사아자차'); // 10 CJK
    const en = estimateTokens('abcdefghij'); // 10 latin
    expect(ko).toBeGreaterThan(en);
    expect(ko).toBeGreaterThan(10); // CJK > 1 token/char
  });
  it('빈 문자열은 0', () => {
    expect(estimateTokens('')).toBe(0);
  });
});

describe('단가 매칭·요금', () => {
  const rates = defaultModelRates();
  it('모델 id 부분 문자열로 단가를 고른다', () => {
    expect(rateFor('claude-opus-4', rates).match).toBe('opus');
    expect(rateFor('gemini-3.5-flash', rates).match).toBe('flash');
    expect(rateFor('알수없는모델', rates).match).toBe(''); // 기본값
  });
  it('agent가 아닌 실행은 0원', () => {
    const base = { at: '2026-07-07T00:00:00Z', stage: 's', scope: 'ep001', model: 'claude-opus-4', promptTokens: 1_000_000, outputTokens: 1_000_000 };
    expect(costOf({ ...base, source: 'agent' }, rates)).toBeCloseTo(90, 5); // 15 + 75
    expect(costOf({ ...base, source: 'fallback' }, rates)).toBe(0);
  });
});

describe('원장 누적·집계', () => {
  it('원장에 append하고 다시 읽는다', async () => {
    await appendUsage(ctx, usageEntryFromChars({
      at: '2026-07-07T10:00:00Z', stage: 'draft-candidate', scope: 'ep001',
      model: 'claude-opus-4', source: 'agent', promptChars: 5000, outputChars: 5000
    }));
    const ledger = await loadUsageLedger(ctx);
    expect(ledger.length).toBe(1);
    expect(ledger[0].promptTokens).toBeGreaterThan(0);
  });

  it('월/회차 집계와 예산 비율', () => {
    const rates = defaultModelRates();
    const entries: UsageEntry[] = [
      { at: '2026-07-01T00:00:00Z', stage: 'draft-candidate', scope: 'ep001', model: 'claude-opus-4', source: 'agent', promptTokens: 500_000, outputTokens: 500_000 },
      { at: '2026-07-15T00:00:00Z', stage: 'summary', scope: 'ep002', model: 'gemini-flash', source: 'agent', promptTokens: 100_000, outputTokens: 100_000 },
      { at: '2026-06-20T00:00:00Z', stage: 'draft-candidate', scope: 'ep001', model: 'claude-opus-4', source: 'agent', promptTokens: 200_000, outputTokens: 200_000 },
      { at: '2026-07-15T00:00:00Z', stage: 'draft-candidate', scope: 'ep003', model: 'claude-opus-4', source: 'fallback', promptTokens: 999_999, outputTokens: 999_999 }
    ];
    const s = summarizeUsage(entries, rates, { monthlyUsd: 100 }, new Date('2026-07-20T00:00:00Z'));
    // 이번 달(7월)의 agent 실행만 요금에 반영, fallback 제외.
    // ep001 opus: 0.5M*15 + 0.5M*75 = 45. ep002 flash: 0.1M*0.3 + 0.1M*2.5 = 0.28.
    expect(s.thisMonth.costUsd).toBeCloseTo(45.28, 2);
    expect(s.all.costUsd).toBeCloseTo(45.28 + (0.2 * 15 + 0.2 * 75), 2); // + 6월 18
    expect(s.thisMonthKey).toBe('2026-07');
    expect(s.budgetRatio).toBeCloseTo(0.4528, 3);
    // 회차별 정렬: 요금 높은 ep001이 먼저.
    expect(s.byScope[0].scope).toBe('ep001');
    // fallback 실행도 run 수엔 잡히지만 요금은 0.
    expect(s.byScope.find((x) => x.scope === 'ep003')?.totals.costUsd).toBe(0);
  });
});

describe('agy 실제 /usage 파싱', () => {
  it('Gemini와 Claude/GPT 그룹의 5시간·주간 잔여량을 읽는다', () => {
    const parsed = parseAgyUsage(`
└ Models & Quota
  Account: writer@example.com
GEMINI MODELS
  Models within this group: Gemini Flash, Gemini Pro
  Weekly Limit
    [█████████░] 90.27%
    90% remaining · Refreshes in 18h 59m
  Five Hour Limit
    [██████████] 96.80%
    97% remaining · Refreshes in 4h 1m
CLAUDE AND GPT MODELS
  Models within this group: Claude Opus, Claude Sonnet, GPT-OSS
  Weekly Limit
    [██████████] 100.00%
    Quota available
  Five Hour Limit
    [██████████] 100.00%
    Quota available
`);
    expect(parsed.account).toBe('writer@example.com');
    expect(parsed.groups).toHaveLength(2);
    expect(parsed.groups[0].weekly).toEqual({ remainingPercent: 90.27, refreshesIn: '18h 59m' });
    expect(parsed.groups[0].fiveHour).toEqual({ remainingPercent: 96.8, refreshesIn: '4h 1m' });
    expect(parsed.groups[1].weekly?.remainingPercent).toBe(100);
    expect(parsed.groups[1].fiveHour?.remainingPercent).toBe(100);
    expect(summarizeProviderQuota(parsed.groups)).toEqual({ fiveHour: 96.8, weekly: 90.27 });
  });
});
