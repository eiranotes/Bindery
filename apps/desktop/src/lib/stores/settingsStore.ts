import { writable } from 'svelte/store';

export type AgentProvider = 'codex' | 'antigravity' | 'gemini' | 'custom';
export type AgentOutputMode = 'stdout' | 'file';

export type Settings = {
  /** Legacy field kept for migration from earlier builds. */
  geminiCliPath?: string;
  agentProvider: AgentProvider;
  agentCliPath: string;
  agentOutputMode: AgentOutputMode;
  novelctlPath: string;
  mockMode: boolean;
  autosave: boolean;
  autosaveDelayMs: number;
  showLineNumbers: boolean;
  showMentions: boolean;
  smartInput: boolean;
  editorFont: 'serif' | 'gothic';
  editorFontSize: number;
};

const defaults: Settings = {
  geminiCliPath: 'gemini',
  agentProvider: 'codex',
  agentCliPath: 'codex',
  agentOutputMode: 'stdout',
  novelctlPath: 'novelctl',
  mockMode: false,
  autosave: true,
  autosaveDelayMs: 1000,
  showLineNumbers: true,
  showMentions: true,
  smartInput: true,
  editorFont: 'serif',
  editorFontSize: 16
};

function migrate(raw: Partial<Settings>): Settings {
  const migrated = { ...defaults, ...raw };
  if (!raw.agentCliPath && raw.geminiCliPath) {
    migrated.agentProvider = 'gemini';
    migrated.agentCliPath = raw.geminiCliPath;
    migrated.agentOutputMode = 'stdout';
  }
  if (migrated.agentProvider === 'antigravity' && !raw.agentOutputMode) migrated.agentOutputMode = 'file';
  return migrated;
}

function load(): Settings {
  if (typeof localStorage === 'undefined') return defaults;
  try {
    const raw = localStorage.getItem('bindery-settings') || localStorage.getItem('novel-studio-settings') || '{}';
    return migrate(JSON.parse(raw));
  } catch {
    return defaults;
  }
}

export const settingsStore = writable<Settings>(load());
const FONT_STACKS: Record<Settings['editorFont'], string> = {
  serif: "'Noto Serif KR', 'KoPub Batang', 'RIDIBatang', ui-serif, Georgia, serif",
  gothic: "'Pretendard Variable', Pretendard, 'Noto Sans KR', -apple-system, sans-serif"
};

settingsStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('bindery-settings', JSON.stringify(v));
  if (typeof document !== 'undefined') {
    const r = document.documentElement.style;
    r.setProperty('--manuscript-font', FONT_STACKS[v.editorFont] ?? FONT_STACKS.serif);
    r.setProperty('--manuscript-size', `${Math.min(22, Math.max(13, v.editorFontSize || 16))}px`);
  }
});
