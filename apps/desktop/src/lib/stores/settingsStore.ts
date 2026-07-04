import { writable } from 'svelte/store';

export type AgentProvider = 'codex' | 'antigravity' | 'gemini' | 'custom';
export type AgentOutputMode = 'stdout' | 'file';
export type EditorFont = 'serif' | 'gothic';
export type ParagraphSpacing = 'compact' | 'normal' | 'relaxed';
export type DraftKind = 'draft' | 'continue' | 'rewrite';
export type CanonViolationPolicy = 'warn' | 'block';

export type Settings = {
  version: 2;
  /** Legacy field kept for migration from earlier builds. */
  geminiCliPath?: string;
  agentProvider: AgentProvider;
  agentCliPath: string;
  agentOutputMode: AgentOutputMode;
  novelctlPath: string;
  agentDefaultTimeoutSec: number;
  agentTestCommand: string;
  mockMode: boolean;
  showPromptPreviewByDefault: boolean;
  keepAgentTempFiles: boolean;
  verboseJobConsole: boolean;
  autosave: boolean;
  autosaveDelayMs: number;
  snapshotBeforeCandidateApply: boolean;
  snapshotBeforeFullEpisodeCompose: boolean;
  snapshotBeforeMemoryDeltaApply: boolean;
  maxSnapshotsPerFile: number;
  pruneOldSnapshots: boolean;
  showLineNumbers: boolean;
  showMentions: boolean;
  showHoverCards: boolean;
  autoSuggestWikiLinks: boolean;
  minAliasLength: number;
  ignoreAlreadyLinked: boolean;
  confidenceThreshold: number;
  smartInput: boolean;
  smartQuotes: boolean;
  autoReplaceDash: boolean;
  autoReplaceArrow: boolean;
  autoReplaceEllipsis: boolean;
  commentPrefix: string;
  editorFont: EditorFont;
  editorFontSize: number;
  editorLineHeight: number;
  editorMeasureCh: number;
  paragraphIndent: boolean;
  paragraphSpacing: ParagraphSpacing;
  typewriterScroll: boolean;
  focusModeDefault: boolean;
  showWordCount: boolean;
  showCharacterCountNoSpaces: boolean;
  aiDefaultCandidateCount: number;
  aiDefaultDraftKind: DraftKind;
  autoIncludeContextPack: boolean;
  autoIncludeStyleGuide: boolean;
  autoIncludeQA: boolean;
  autoIncludeRevisionPlan: boolean;
  autoIncludeRepetitionReport: boolean;
  maxPromptChars: number;
  requirePromptPreviewForFullCompose: boolean;
  fullComposeEnabled: boolean;
  fullComposeRequirePreflight: boolean;
  fullComposeRequireEpisodePlot: boolean;
  fullComposeRequireBible: boolean;
  fullComposeRequireMemoryPack: boolean;
  fullComposeAllowNewCharacters: boolean;
  fullComposeAllowNewSettings: boolean;
  fullComposeCanonViolationPolicy: CanonViolationPolicy;
  fullComposeRunAnalyze: boolean;
  fullComposeRunQA: boolean;
  fullComposeGenerateSummary: boolean;
  fullComposeGenerateMemoryDelta: boolean;
  contextAutoBuild: boolean;
  contextPreviousSummariesCount: number;
  contextIncludeArcSummary: boolean;
  contextIncludeUnresolvedThreads: boolean;
  contextIncludeCharacterState: boolean;
  contextMemoryDeltaReviewRequired: boolean;
  contextBudgetBibleChars: number;
  contextBudgetSummariesChars: number;
  contextBudgetMemoryChars: number;
  contextBudgetPlotChars: number;
  contextBudgetStyleChars: number;
};

const defaults: Settings = {
  version: 2,
  geminiCliPath: 'gemini',
  agentProvider: 'codex',
  agentCliPath: 'codex',
  agentOutputMode: 'stdout',
  novelctlPath: 'novelctl',
  agentDefaultTimeoutSec: 240,
  agentTestCommand: '--version',
  mockMode: false,
  showPromptPreviewByDefault: true,
  keepAgentTempFiles: true,
  verboseJobConsole: false,
  autosave: true,
  autosaveDelayMs: 1000,
  snapshotBeforeCandidateApply: true,
  snapshotBeforeFullEpisodeCompose: true,
  snapshotBeforeMemoryDeltaApply: true,
  maxSnapshotsPerFile: 50,
  pruneOldSnapshots: false,
  showLineNumbers: true,
  showMentions: true,
  showHoverCards: true,
  autoSuggestWikiLinks: true,
  minAliasLength: 2,
  ignoreAlreadyLinked: true,
  confidenceThreshold: 0.4,
  smartInput: true,
  smartQuotes: true,
  autoReplaceDash: true,
  autoReplaceArrow: true,
  autoReplaceEllipsis: true,
  commentPrefix: '//',
  editorFont: 'serif',
  editorFontSize: 16,
  editorLineHeight: 2,
  editorMeasureCh: 70,
  paragraphIndent: false,
  paragraphSpacing: 'relaxed',
  typewriterScroll: false,
  focusModeDefault: false,
  showWordCount: true,
  showCharacterCountNoSpaces: true,
  aiDefaultCandidateCount: 2,
  aiDefaultDraftKind: 'draft',
  autoIncludeContextPack: true,
  autoIncludeStyleGuide: true,
  autoIncludeQA: true,
  autoIncludeRevisionPlan: true,
  autoIncludeRepetitionReport: true,
  maxPromptChars: 24000,
  requirePromptPreviewForFullCompose: true,
  fullComposeEnabled: true,
  fullComposeRequirePreflight: true,
  fullComposeRequireEpisodePlot: true,
  fullComposeRequireBible: true,
  fullComposeRequireMemoryPack: true,
  fullComposeAllowNewCharacters: false,
  fullComposeAllowNewSettings: false,
  fullComposeCanonViolationPolicy: 'warn',
  fullComposeRunAnalyze: true,
  fullComposeRunQA: true,
  fullComposeGenerateSummary: true,
  fullComposeGenerateMemoryDelta: true,
  contextAutoBuild: true,
  contextPreviousSummariesCount: 1,
  contextIncludeArcSummary: true,
  contextIncludeUnresolvedThreads: true,
  contextIncludeCharacterState: true,
  contextMemoryDeltaReviewRequired: true,
  contextBudgetBibleChars: 6000,
  contextBudgetSummariesChars: 4000,
  contextBudgetMemoryChars: 4000,
  contextBudgetPlotChars: 3000,
  contextBudgetStyleChars: 2400
};

function migrate(raw: Partial<Settings>): Settings {
  const migrated = { ...defaults, ...raw };
  migrated.version = 2;
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
const FONT_STACKS: Record<EditorFont, string> = {
  serif: "'Noto Serif KR', 'KoPub Batang', 'RIDIBatang', ui-serif, Georgia, serif",
  gothic: "'Pretendard Variable', Pretendard, 'Noto Sans KR', -apple-system, sans-serif"
};

settingsStore.subscribe((v) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem('bindery-settings', JSON.stringify(v));
  if (typeof document !== 'undefined') {
    const r = document.documentElement.style;
    r.setProperty('--manuscript-font', FONT_STACKS[v.editorFont] ?? FONT_STACKS.serif);
    r.setProperty('--manuscript-size', `${Math.min(22, Math.max(13, v.editorFontSize || 16))}px`);
    r.setProperty('--manuscript-lh', `${Math.min(2.6, Math.max(1.4, v.editorLineHeight || 2))}`);
    r.setProperty('--manuscript-measure', `${Math.min(88, Math.max(48, v.editorMeasureCh || 70))}ch`);
  }
});
