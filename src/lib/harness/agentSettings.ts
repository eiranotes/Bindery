// 에이전트 실행기 설정 — provider에 고정되지 않는 CLI 프로필.
// 프로젝트 파일(.bindery/settings.json)이 진실이고, 앱은 그것을 편집하는 UI다.
import { LAYOUT } from '$lib/core/layout';
import { defaultModelRates, type ModelRate } from './usage';
import type { AgentSettings, Bridge } from '$lib/bridge';

export type ProviderPreset = {
  id: string;
  label: string;
  command: string;
  /** model 미지정 시 인자. {prompt} 치환. */
  argsTemplate: string[];
  /** model 지정 시 인자. {prompt} {model} 치환. 플래그 순서 문제를 피하려고 별도 템플릿을 쓴다. */
  argsWithModel: string[];
  outputMode: 'stdout' | 'file';
};

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'codex', label: 'Codex CLI', command: 'codex',
    // Bindery 작품 폴더는 Git 저장소가 아닌 것이 정상이다.
    argsTemplate: ['exec', '--skip-git-repo-check', '{prompt}'],
    argsWithModel: ['exec', '--skip-git-repo-check', '-m', '{model}', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    id: 'claude', label: 'Claude Code CLI', command: 'claude',
    argsTemplate: ['-p', '{prompt}'],
    argsWithModel: ['--model', '{model}', '-p', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    // agy: 이 머신의 Gemini 실행 래퍼. 모델 플래그는 -m이 아니라 -model이 기본이다.
    id: 'gemini', label: 'Gemini CLI (agy)', command: 'agy',
    argsTemplate: ['-p', '{prompt}'],
    argsWithModel: ['-model', '{model}', '-p', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    id: 'custom', label: '직접 설정', command: '',
    argsTemplate: ['{prompt}'],
    argsWithModel: ['{prompt}'],
    outputMode: 'stdout'
  }
];

export type UiMode = 'simple' | 'advanced';

/** 모델 티어 — standard는 아래 top-level 기본 실행기를 그대로 쓴다. */
export type AgentTier = 'light' | 'standard' | 'heavy';

/** 경량/고급 티어용 별도 CLI 프로필. enabled=false면 기본 실행기로 폴백. */
export type TierProfile = {
  enabled: boolean;
  provider: string;
  command: string;
  argsTemplate: string[];
  argsWithModel: string[];
  outputMode: 'stdout' | 'file';
  model: string;
  timeoutMs: number;
};

/** 파이프라인 묶음 — 스테이지 id를 사용자에게 보이는 5개 그룹으로 접는다. */
export type StageGroup = 'planning' | 'distill' | 'draft' | 'qa' | 'memory';

export const STAGE_GROUPS: Array<{ id: StageGroup; label: string; hint: string }> = [
  { id: 'planning', label: '기획·설계', hint: '소재/세계관/바이블/플롯/브리프/장면 계획' },
  { id: 'distill', label: '컨텍스트 정제', hint: '선별된 설정 자료를 집필용 캡슐로 압축' },
  { id: 'draft', label: '원고 집필', hint: '초안 후보·수정 후보 생성 (가장 비싼 단계)' },
  { id: 'qa', label: '검수', hint: '문체/연속성/정사 점검과 수정 계획' },
  { id: 'memory', label: '요약·기억', hint: '회차 요약과 정사 변경 후보' }
];

export type HarnessSettings = {
  schema_version: 'bindery.settings.v1';
  provider: string;
  command: string;
  argsTemplate: string[];
  argsWithModel: string[];
  outputMode: 'stdout' | 'file';
  model: string;
  timeoutMs: number;
  offline: boolean;
  showStatusBar: boolean;
  /** simple: 자동화 중심 최소 UI (기본) · advanced: 설계자 모드 — 전체 파이프라인 노출 */
  uiMode: UiMode;
  /** 경량/고급 티어 프로필 (standard는 위 기본 실행기) */
  profiles: { light: TierProfile; heavy: TierProfile };
  /** 파이프라인 그룹 → 티어 배정 */
  stageTiers: Record<StageGroup, AgentTier>;
  /** 로컬 선별 컨텍스트의 문자 예산 (설정 자료 팩) */
  contextBudgetChars: number;
  /** 이 크기를 넘으면 AI 정제(distill) 스테이지로 캡슐 압축 */
  distillThresholdChars: number;
  /** 모델별 단가 (USD/1M 토큰) — 비용 추정에 사용 */
  modelRates: ModelRate[];
  /** 월 예산 상한 (USD, 0이면 없음) */
  monthlyBudgetUsd: number;
};

function defaultTierProfile(): TierProfile {
  const preset = PROVIDER_PRESETS[0];
  return {
    enabled: false,
    provider: preset.id,
    command: preset.command,
    argsTemplate: [...preset.argsTemplate],
    argsWithModel: [...preset.argsWithModel],
    outputMode: preset.outputMode,
    model: '',
    timeoutMs: 180_000
  };
}

export function defaultStageTiers(): Record<StageGroup, AgentTier> {
  return {
    planning: 'standard',
    distill: 'light',
    draft: 'heavy',
    qa: 'standard',
    memory: 'light'
  };
}

export function defaultSettings(): HarnessSettings {
  const preset = PROVIDER_PRESETS[0];
  return {
    schema_version: 'bindery.settings.v1',
    provider: preset.id,
    command: preset.command,
    argsTemplate: [...preset.argsTemplate],
    argsWithModel: [...preset.argsWithModel],
    outputMode: preset.outputMode,
    model: '',
    timeoutMs: 180_000,
    offline: false,
    showStatusBar: true,
    uiMode: 'simple',
    profiles: { light: defaultTierProfile(), heavy: defaultTierProfile() },
    stageTiers: defaultStageTiers(),
    contextBudgetChars: 6000,
    distillThresholdChars: 3000,
    modelRates: defaultModelRates(),
    monthlyBudgetUsd: 0
  };
}

export function applyPreset(settings: HarnessSettings, presetId: string): HarnessSettings {
  const preset = PROVIDER_PRESETS.find((p) => p.id === presetId) ?? PROVIDER_PRESETS[0];
  return {
    ...settings,
    provider: preset.id,
    command: preset.id === 'custom' ? settings.command : preset.command,
    argsTemplate: preset.id === 'custom' ? settings.argsTemplate : [...preset.argsTemplate],
    argsWithModel: preset.id === 'custom' ? settings.argsWithModel : [...preset.argsWithModel],
    outputMode: preset.outputMode
  };
}

/** 실행용 AgentSettings로 변환. */
export function toAgentSettings(s: HarnessSettings): AgentSettings {
  return {
    command: s.command,
    argsTemplate: s.model.trim() ? s.argsWithModel : s.argsTemplate,
    outputMode: s.outputMode,
    model: s.model.trim() || undefined,
    timeoutMs: s.timeoutMs
  };
}

/** 스테이지 id → 파이프라인 그룹. 새 스테이지는 안전하게 planning(기본 실행기)으로 흡수한다. */
export function stageGroupOf(stage: string): StageGroup {
  if (stage.startsWith('draft-candidate') || stage === 'revision-candidate') return 'draft';
  if (stage === 'context-distill') return 'distill';
  if (stage.startsWith('qa-') || stage === 'revision-plan') return 'qa';
  if (stage === 'summary' || stage === 'canon-delta') return 'memory';
  // 문체 분석은 결 추출 품질이 중요하다 — 기획·설계와 같은 티어로 묶는다.
  return 'planning';
}

/** 티어 프로필 해석 — 비활성/미설정 티어는 기본 실행기로 폴백한다. */
export function toAgentSettingsForTier(s: HarnessSettings, tier: AgentTier): AgentSettings {
  if (tier === 'standard') return toAgentSettings(s);
  const p = s.profiles?.[tier];
  if (!p?.enabled || !p.command.trim()) return toAgentSettings(s);
  return {
    command: p.command,
    argsTemplate: p.model.trim() ? p.argsWithModel : p.argsTemplate,
    outputMode: p.outputMode,
    model: p.model.trim() || undefined,
    timeoutMs: p.timeoutMs
  };
}

/** 스테이지별 실행기 해석 — 러너가 매 스테이지 호출 직전에 사용한다. */
export function toAgentSettingsForStage(s: HarnessSettings, stage: string): AgentSettings {
  const tier = s.stageTiers?.[stageGroupOf(stage)] ?? 'standard';
  return toAgentSettingsForTier(s, tier);
}

export async function loadSettings(bridge: Bridge, root: string): Promise<HarnessSettings> {
  try {
    if (!(await bridge.exists(root, LAYOUT.bindery.settings))) return defaultSettings();
    const raw = JSON.parse(await bridge.readFile(root, LAYOUT.bindery.settings)) as HarnessSettings;
    if (raw.schema_version === 'bindery.settings.v1') {
      const d = defaultSettings();
      // 구버전 settings.json에는 profiles/stageTiers가 없다 — 기본값으로 채운다.
      return {
        ...d,
        ...raw,
        profiles: {
          light: { ...d.profiles.light, ...(raw.profiles?.light ?? {}) },
          heavy: { ...d.profiles.heavy, ...(raw.profiles?.heavy ?? {}) }
        },
        stageTiers: { ...d.stageTiers, ...(raw.stageTiers ?? {}) },
        modelRates: raw.modelRates?.length ? raw.modelRates : d.modelRates
      };
    }
  } catch {
    /* 설정 파일 없음 */
  }
  return defaultSettings();
}

export async function saveSettings(bridge: Bridge, root: string, settings: HarnessSettings): Promise<void> {
  await bridge.writeFile(root, LAYOUT.bindery.settings, JSON.stringify(settings, null, 2));
}
