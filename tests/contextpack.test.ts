// 토큰 라우터 테스트 — 로컬 정적 선별(Context Pack), AI 정제 폴백, 스테이지별 티어 라우팅.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge, setAgentScript } from '../src/lib/bridge/memoryBridge';
import {
  buildEpisodeContextPack, contextPackPath, extractQueryTerms, prepareDraftContext, splitSections
} from '../src/lib/harness/contextPack';
import {
  defaultSettings, stageGroupOf, toAgentSettingsForStage, toAgentSettingsForTier
} from '../src/lib/harness/agentSettings';
import { LAYOUT } from '../src/lib/core/layout';
import type { Ctx } from '../src/lib/harness/types';
import type { PlotPlan } from '../src/lib/schemas/contracts';

const ROOT = '/vault/토큰라우터';
const AGENT = { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };

function baseCtx(overrides: Partial<Ctx> = {}): Ctx {
  return { root: ROOT, bridge: memoryBridge, agent: AGENT, ...overrides };
}

const PLAN: PlotPlan = {
  schema_version: 'bindery.plot_plan.v1',
  arcs: [{ id: 'arc_01', label: '1부', episodes: 'ep001~ep010', goal: '' }],
  episodes: [
    {
      episode: 'ep002', arc: 'arc_01', title: '수익 배분 대립',
      goal: '에이라와 길드 회계관이 던전 수익 배분 문제로 대립한다',
      beats: ['회계 장부 공개 요구', '각주 공백 지적'],
      threads_open: ['수익 감사'], threads_close: [], hook: '감사 요청서가 접수된다', risk: '', status: 'approved'
    }
  ],
  source: 'local',
  updatedAt: '2026-07-06'
};

async function seedProject(): Promise<void> {
  const w = (path: string, content: string) => memoryBridge.writeFile(ROOT, path, content);
  await w(LAYOUT.plot.board, JSON.stringify(PLAN));
  await w(
    LAYOUT.canon.bible,
    [
      '# 설정 바이블', '## 작품 개요', '던전 경제물. 저평가 자원을 숫자로 역전하는 이야기.',
      '## 길드 수익 배분', '길드는 던전 수익을 위험 비용 산정 후 배분한다. 에이라는 회계 감사를 요구했다.',
      '## 왕도 정치', '왕도의 귀족 파벌은 3개로 나뉜다. 이번 화와 무관한 대규모 설정.',
      '## 용격 던전', '최상위 던전. 2부 배경.'
    ].join('\n')
  );
  await w('characters/에이라.md', '# 에이라\n길드 소속 감정사. 수익 배분의 각주 공백을 지적했다.');
  await w('characters/길드회계관.md', '# 길드 회계관\n위험 비용 산정을 담당한다. 에이라와 대립한다.');
  await w(
    'characters/무관한인물.md',
    '# 하벤\n왕도 기사단장. 아직 본편에 등장하지 않은 예비 인물로, 왕도 방위와 기사 서임 제도를 관장한다. 2부 왕도 편에서 처음 등장할 예정이다.'
  );
  await w(LAYOUT.plot.openThreads, '# 열린 떡밥\n## 수익 감사\nep001에서 열림. 회계관의 산정 허점.');
}

beforeEach(() => {
  resetMemoryBridge();
});

describe('로컬 정적 선별', () => {
  it('섹션 분리와 질의어 추출', () => {
    const sections = splitSections('canon/setting-bible.md', '설정 바이블', '# 제목\n서문\n## A\n내용A\n## B\n내용B');
    expect(sections.map((s) => s.heading)).toEqual(['제목', 'A', 'B']);
    const terms = extractQueryTerms('에이라와 길드 회계관이 수익 배분으로 대립');
    expect(terms).toContain('에이라와');
    expect(terms.length).toBeGreaterThan(2);
  });

  it('관련 섹션은 포함, 무관한 설정은 제외되고 사유가 남는다', async () => {
    await seedProject();
    const pack = await buildEpisodeContextPack(baseCtx(), 'ep002');

    const includedIds = pack.manifest.included.map((i) => i.id).join('|');
    expect(includedIds).toContain('에이라');
    expect(includedIds).toContain('길드회계관');
    expect(includedIds).toContain('수익 배분');
    // 무관 자료는 텍스트에 실리지 않는다 (관련도 0 → 제외 목록으로).
    expect(pack.text).not.toContain('기사단장');
    const excludedIds = pack.manifest.excluded.map((i) => i.id).join('|');
    expect(excludedIds).toContain('무관한인물');
    expect(pack.manifest.excluded.every((i) => i.reasons.length > 0)).toBe(true);
    // 바이블 앵커(첫 섹션)는 기본 포함.
    expect(pack.manifest.included.some((i) => i.reasons.includes('바이블 기본 포함'))).toBe(true);
  });

  it('문자 예산을 넘는 자료는 제외되고 예산 사유가 남는다', async () => {
    await seedProject();
    const pack = await buildEpisodeContextPack(baseCtx({ contextBudgetChars: 80 }), 'ep002');
    expect(pack.manifest.usedChars).toBeLessThanOrEqual(80);
    expect(pack.manifest.excluded.some((i) => i.reasons.some((r) => r.includes('예산 초과')))).toBe(true);
  });
});

describe('AI 정제 (distill)', () => {
  it('오프라인이면 정제를 건너뛰고 로컬 팩을 그대로 쓴다', async () => {
    await seedProject();
    const r = await prepareDraftContext(baseCtx({ offline: true, distillThresholdChars: 10 }), 'ep002');
    expect(r.distillSource).toBe('skipped');
    expect(r.capsule).toBe(r.pack.text);
    // Prompt Audit 기록이 남는다.
    expect(await memoryBridge.exists(ROOT, contextPackPath('ep002'))).toBe(true);
  });

  it('경량 티어 실행기가 있으면 캡슐로 압축되고 manifest에 기록된다', async () => {
    await seedProject();
    const stages: string[] = [];
    setAgentScript((prompt) => {
      if (!prompt.includes('컨텍스트 정제기')) return null;
      return {
        ok: true,
        text: JSON.stringify({
          schema_version: 'bindery.context_capsule.v1',
          episode: 'ep002',
          capsule_md: `## 핵심 설정\n- 길드는 위험 비용 산정 후 수익을 배분한다.\n## 인물 상태\n- 에이라: 감사 요구.\n- 회계관: 산정 담당, 대립.\n${'- 패딩 줄\n'.repeat(20)}`,
          dropped_notes: []
        }),
        stderr: '', exitCode: 0, durationMs: 5, mode: 'cli'
      };
    });
    const ctx = baseCtx({
      agent: { ...AGENT, command: 'fake-cli' },
      distillThresholdChars: 100,
      agentFor: (stage) => {
        stages.push(stage);
        return { ...AGENT, command: 'fake-cli', model: 'light-model' };
      }
    });
    const r = await prepareDraftContext(ctx, 'ep002');
    expect(r.distillSource).toBe('agent');
    expect(r.capsule).toContain('핵심 설정');
    expect(r.capsule.length).toBeLessThan(r.pack.text.length + 200);
    expect(stages).toContain('context-distill');
    expect(r.pack.manifest.distill?.source).toBe('agent');
  });
});

describe('스테이지별 티어 라우팅', () => {
  it('스테이지 → 파이프라인 그룹 매핑', () => {
    expect(stageGroupOf('draft-candidate')).toBe('draft');
    expect(stageGroupOf('draft-candidate-2')).toBe('draft');
    expect(stageGroupOf('revision-candidate')).toBe('draft');
    expect(stageGroupOf('context-distill')).toBe('distill');
    expect(stageGroupOf('qa-style')).toBe('qa');
    expect(stageGroupOf('revision-plan')).toBe('qa');
    expect(stageGroupOf('summary')).toBe('memory');
    expect(stageGroupOf('canon-delta')).toBe('memory');
    expect(stageGroupOf('episode-brief')).toBe('planning');
    expect(stageGroupOf('알수없는-스테이지')).toBe('planning');
  });

  it('활성 티어 프로필은 별도 CLI/모델로, 비활성은 기본 실행기로 폴백', () => {
    const s = defaultSettings();
    s.command = 'codex';
    s.model = 'base-model';
    s.profiles.heavy = { ...s.profiles.heavy, enabled: true, command: 'claude', model: 'opus' };
    s.profiles.light = { ...s.profiles.light, enabled: false, command: 'gemini', model: 'flash' };

    // draft(기본 heavy) → claude/opus, distill(기본 light, 비활성) → 기본 실행기 폴백.
    expect(toAgentSettingsForStage(s, 'draft-candidate').command).toBe('claude');
    expect(toAgentSettingsForStage(s, 'draft-candidate').model).toBe('opus');
    expect(toAgentSettingsForStage(s, 'context-distill').command).toBe('codex');
    expect(toAgentSettingsForTier(s, 'standard').model).toBe('base-model');

    // 사용자가 배정을 바꾸면 그대로 따른다.
    s.stageTiers.qa = 'heavy';
    expect(toAgentSettingsForStage(s, 'qa-continuity').command).toBe('claude');
  });
});
