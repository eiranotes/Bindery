// Assembles the full extension set and exposes a small helper API for the
// Svelte editor component to push analysis data into the running editor.
import { EditorView } from '@codemirror/view';
import type { Extension } from '@codemirror/state';
import type { CodexItem } from '$lib/domain/codex';
import type { QAIssue, RepetitionTerm } from '$lib/domain/reports';
import {
  codexField,
  qaIssuesField,
  repetitionField,
  setCodexEffect,
  setQAIssuesEffect,
  setRepetitionEffect
} from './state';
import { frontmatterExtension, wordCountField } from './frontmatter';
import { smartQuotes, autoReplace, writerComments } from './inputRules';
import { dynamicMentionDecoration, mentionHover, repetitionDecoration } from './mentions';
import { qaDiagnosticsExtension } from './qaDiagnostics';
import { wikiLinkCompletion, aiCommandField, aiCommandEffect } from './wikilink';
import { editorTheme } from './theme';
export { editorTheme } from './theme';

export { wordCountField, computeStats } from './frontmatter';
export type { WordStats } from './frontmatter';
export { AI_COMMANDS, aiCommandEffect, aiCommandField } from './wikilink';
export type { AICommand } from './wikilink';
export { focusModeExtension, typewriterExtension } from './focus';
export { smartQuotes, autoReplace } from './inputRules';

/** All Bindery editor extensions, in order. */
export function novelExtensions(): Extension[] {
  return [
    codexField,
    qaIssuesField,
    repetitionField,
    wordCountField,
    aiCommandField,
    frontmatterExtension,
    writerComments,
    dynamicMentionDecoration,
    mentionHover,
    repetitionDecoration,
    qaDiagnosticsExtension,
    wikiLinkCompletion
  ];
}

// --- imperative data push helpers -----------------------------------------
export function pushCodex(view: EditorView, items: CodexItem[]) {
  view.dispatch({ effects: setCodexEffect.of(items) });
}
export function pushQAIssues(view: EditorView, issues: QAIssue[]) {
  view.dispatch({ effects: setQAIssuesEffect.of(issues) });
}
export function pushRepetition(view: EditorView, terms: RepetitionTerm[]) {
  view.dispatch({ effects: setRepetitionEffect.of(terms) });
}

/** Read AI command effects from a transaction (used by the host updateListener). */
export function readAICommand(effects: readonly import('@codemirror/state').StateEffect<unknown>[]): string | null {
  for (const e of effects) if (e.is(aiCommandEffect)) return (e.value as { name: string }).name;
  return null;
}
