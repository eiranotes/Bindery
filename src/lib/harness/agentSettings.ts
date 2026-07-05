// 에이전트 실행기 설정 — provider에 고정되지 않는 CLI 프로필.
// 프로젝트 파일(.bindery/settings.json)이 진실이고, 앱은 그것을 편집하는 UI다.
import { LAYOUT } from '$lib/core/layout';
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
    argsTemplate: ['exec', '{prompt}'],
    argsWithModel: ['exec', '-m', '{model}', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    id: 'claude', label: 'Claude Code CLI', command: 'claude',
    argsTemplate: ['-p', '{prompt}'],
    argsWithModel: ['--model', '{model}', '-p', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    id: 'gemini', label: 'Gemini CLI', command: 'gemini',
    argsTemplate: ['-p', '{prompt}'],
    argsWithModel: ['-m', '{model}', '-p', '{prompt}'],
    outputMode: 'stdout'
  },
  {
    id: 'custom', label: '직접 설정', command: '',
    argsTemplate: ['{prompt}'],
    argsWithModel: ['{prompt}'],
    outputMode: 'stdout'
  }
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
};

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
    offline: false
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

export async function loadSettings(bridge: Bridge, root: string): Promise<HarnessSettings> {
  try {
    const raw = JSON.parse(await bridge.readFile(root, LAYOUT.bindery.settings)) as HarnessSettings;
    if (raw.schema_version === 'bindery.settings.v1') return { ...defaultSettings(), ...raw };
  } catch {
    /* 설정 파일 없음 */
  }
  return defaultSettings();
}

export async function saveSettings(bridge: Bridge, root: string, settings: HarnessSettings): Promise<void> {
  await bridge.writeFile(root, LAYOUT.bindery.settings, JSON.stringify(settings, null, 2));
}
