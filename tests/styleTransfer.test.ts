// 문체 재현 테스트 — 로컬 분해/분류, 프리셋 저장·적용·이력, 집필 캡슐 라우팅.
import { describe, it, expect, beforeEach } from 'vitest';
import { memoryBridge, resetMemoryBridge, setAgentScript } from '../src/lib/bridge/memoryBridge';
import {
  analyzeStyleSource, applyStylePreset, buildStyleCapsule, classifyStyleScene,
  deactivateStylePreset, deleteStylePreset, detectLang, extractContentTerms,
  loadPresetIndex, loadStyleHistory, matchSceneOverlay, saveStylePreset, splitStyleScenes
} from '../src/lib/harness/styleTransfer';
import { LAYOUT } from '../src/lib/core/layout';
import type { Ctx } from '../src/lib/harness/types';
import type { ScenePlan } from '../src/lib/schemas/contracts';

const ROOT = '/vault/문체작품';
const AGENT = { command: '', argsTemplate: ['{prompt}'], outputMode: 'stdout' as const };

function baseCtx(overrides: Partial<Ctx> = {}): Ctx {
  return { root: ROOT, bridge: memoryBridge, agent: AGENT, ...overrides };
}

const KO_SOURCE = [
  '# 1장',
  '',
  '비가 내렸다. 미도리는 우산도 없이 골목 끝의 낡은 서점을 바라보았다.',
  '유리문 너머의 불빛이 젖은 돌바닥에 길게 번졌다. 미도리는 숨을 골랐다.',
  '',
  '"들어와도 돼."',
  '',
  '"…들켰네."',
  '',
  '"우산 없이 십 분을 서 있으면 누구라도 알아."',
  '',
  '***',
  '',
  '다음 날, 미도리는 서점의 낡은 사다리를 밀며 책장을 정리했다. 손끝에 먼지가 묻었다.',
  '미도리는 사다리에서 뛰어내려 상자를 밀었다. 상자가 쓰러지며 오래된 종이 냄새가 터졌다.'
].join('\n');

const AI_PROFILE = {
  schema_version: 'bindery.style_profile.v1',
  source_lang: 'ko',
  summary: '비 내리는 골목처럼 축축하고 조용한 결. 짧은 단문과 침묵으로 감정을 미룬다.',
  global_rules: ['단문을 기본으로 하고 세 문장에 한 번 호흡을 끊는다.', '감정을 명명하지 않고 사물에 얹는다.', '장면 전환은 날씨나 빛으로 연다.'],
  scene_overlays: [
    { scene_type: 'dialogue', traits: ['대사는 한 줄, 응수는 반 박자 늦게.'], quote: '들어와도 돼.' },
    { scene_type: 'description', traits: ['젖은 질감의 시각 묘사를 우선한다.'], quote: '불빛이 젖은 돌바닥에 길게 번졌다.' },
    { scene_type: 'action', traits: ['동작은 목적어 먼저, 짧게 끊는다.'], quote: '' }
  ],
  dialogue_voice: ['호칭 생략, 반말 위주.'],
  forbidden: ['만연체 설명', '감탄사 남발'],
  content_terms: ['미도리']
};

beforeEach(() => {
  resetMemoryBridge();
});

describe('로컬 정적: 언어·장면·용어', () => {
  it('언어 감지 — 한국어/일본어', () => {
    expect(detectLang('그녀는 조용히 골목을 바라보았다. '.repeat(10))).toBe('ko');
    expect(detectLang('彼女は静かに路地を見つめていた。'.repeat(10))).toBe('ja');
  });

  it('구분선/헤딩 기준 장면 분해와 유형 분류', () => {
    const scenes = splitStyleScenes(KO_SOURCE);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
    // 대화 위주 블록은 dialogue로 분류된다.
    const dialogueScene = scenes.find((s) => s.excerpt.includes('들어와도'));
    expect(dialogueScene?.type).toBe('dialogue');
    expect(classifyStyleScene('"안녕." \n"오랜만이야." \n"잘 지냈어?"')).toBe('dialogue');
  });

  it('반복 고유명사를 복제 금지 후보로 추출한다', () => {
    const terms = extractContentTerms(KO_SOURCE);
    expect(terms).toContain('미도리');
  });
});

describe('분석 → 프리셋 → 적용 → 이력', () => {
  it('오프라인 분석은 로컬 뼈대 프로필을 만들고 이력을 남긴다', async () => {
    const r = await analyzeStyleSource(baseCtx({ offline: true }), KO_SOURCE);
    expect(r.source).toBe('fallback');
    expect(r.profile.global_rules.length).toBeGreaterThanOrEqual(2);
    const history = await loadStyleHistory(baseCtx());
    expect(history[0]?.action).toBe('analyzed');
  });

  it('AI 분석 프로필을 프리셋으로 저장하고 적용하면 style-guide.md가 갱신된다', async () => {
    setAgentScript((prompt) =>
      prompt.includes('문체 분석가')
        ? { ok: true, text: JSON.stringify(AI_PROFILE), stderr: '', exitCode: 0, durationMs: 5, mode: 'cli' }
        : null
    );
    const c = baseCtx({ agent: { ...AGENT, command: 'fake-cli' } });
    const analysis = await analyzeStyleSource(c, KO_SOURCE);
    expect(analysis.source).toBe('agent');
    // 로컬 추출 고유명사가 복제 금지 목록에 합쳐진다.
    expect(analysis.profile.content_terms).toContain('미도리');

    const preset = await saveStylePreset(c, '축축한 골목풍', analysis);
    const index = await loadPresetIndex(c);
    expect(index.presets[0].name).toBe('축축한 골목풍');
    expect(index.activePresetId).toBeNull();

    await applyStylePreset(c, preset.id);
    const guide = await memoryBridge.readFile(ROOT, LAYOUT.style.guide);
    expect(guide).toContain('축축한 골목풍');
    expect(guide).toContain('복제 금지');
    expect(guide).toContain('미도리');
    expect((await loadPresetIndex(c)).activePresetId).toBe(preset.id);

    const history = await loadStyleHistory(c);
    expect(history.map((h) => h.action).slice(0, 3)).toEqual(['applied', 'saved', 'analyzed']);
  });

  it('적용 해제와 삭제가 인덱스/이력에 반영된다', async () => {
    setAgentScript(() => null);
    const c = baseCtx({ offline: true });
    const analysis = await analyzeStyleSource(c, KO_SOURCE);
    const preset = await saveStylePreset(c, '테스트풍', analysis);
    await applyStylePreset(c, preset.id);
    await deactivateStylePreset(c);
    expect((await loadPresetIndex(c)).activePresetId).toBeNull();
    await deleteStylePreset(c, preset.id);
    expect((await loadPresetIndex(c)).presets.length).toBe(0);
    const history = await loadStyleHistory(c);
    expect(history[0].action).toBe('deleted');
  });
});

describe('집필 주입 라우팅', () => {
  const scenePlan: ScenePlan = {
    schema_version: 'bindery.scene_plan.v1',
    episode: 'ep003',
    scenes: [
      { id: 's1', purpose: '두 사람의 담판 대화', setting: '서점', characters: ['미도리', '점장'], conflict: '임금 협상 설득', turn: '합의', carries: [], target_length: 1500, exit: '' },
      { id: 's2', purpose: '골목 추격과 탈출', setting: '골목', characters: ['미도리'], conflict: '추격전', turn: '탈출', carries: [], target_length: 1500, exit: '' }
    ],
    risks: [],
    source: 'local'
  };

  it('장면 계획을 유형으로 매칭한다', () => {
    expect(matchSceneOverlay(scenePlan.scenes[0])).toBe('dialogue');
    expect(matchSceneOverlay(scenePlan.scenes[1])).toBe('action');
  });

  it('활성 프리셋이 없으면 null — 기존 style-guide.md 폴백', async () => {
    expect(await buildStyleCapsule(baseCtx(), 'ep003', scenePlan)).toBeNull();
  });

  it('활성 프리셋이 있으면 이번 화 장면 유형의 오버레이만 골라 캡슐을 만든다', async () => {
    setAgentScript((prompt) =>
      prompt.includes('문체 분석가')
        ? { ok: true, text: JSON.stringify(AI_PROFILE), stderr: '', exitCode: 0, durationMs: 5, mode: 'cli' }
        : null
    );
    const c = baseCtx({ agent: { ...AGENT, command: 'fake-cli' } });
    const analysis = await analyzeStyleSource(c, KO_SOURCE);
    const preset = await saveStylePreset(c, '축축한 골목풍', analysis);
    await applyStylePreset(c, preset.id);

    const capsule = await buildStyleCapsule(c, 'ep003', scenePlan);
    expect(capsule?.presetName).toBe('축축한 골목풍');
    // 이번 화에 있는 유형(dialogue/action)은 포함, 없는 유형(description)은 제외.
    expect(capsule?.text).toContain('대사는 한 줄');
    expect(capsule?.text).toContain('동작은 목적어 먼저');
    expect(capsule?.text).not.toContain('젖은 질감의 시각 묘사');
    // 복제 금지와 장면별 배정이 들어간다.
    expect(capsule?.text).toContain('복제 금지');
    expect(capsule?.text).toContain('s1');
    // 근거 기록이 남는다.
    expect(await memoryBridge.exists(ROOT, '.bindery/artifacts/ep003/style-capsule.md')).toBe(true);
  });
});
