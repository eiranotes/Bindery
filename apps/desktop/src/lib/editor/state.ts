// Bridges between Svelte stores and CodeMirror. External analysis data
// (codex items, QA issues, repetition terms) is pushed into the editor through
// StateEffects and read by the decoration plugins from StateFields. This keeps
// decoration recomputation tied to editor transactions (good for performance
// and Korean IME safety) instead of ad-hoc DOM mutation.

import { StateEffect, StateField } from '@codemirror/state';
import type { CodexItem } from '$lib/domain/codex';
import type { QAIssue, RepetitionTerm } from '$lib/domain/reports';

export const setCodexEffect = StateEffect.define<CodexItem[]>();
export const setQAIssuesEffect = StateEffect.define<QAIssue[]>();
export const setRepetitionEffect = StateEffect.define<RepetitionTerm[]>();

export const codexField = StateField.define<CodexItem[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setCodexEffect)) return e.value;
    return value;
  }
});

export const qaIssuesField = StateField.define<QAIssue[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setQAIssuesEffect)) return e.value;
    return value;
  }
});

export const repetitionField = StateField.define<RepetitionTerm[]>({
  create: () => [],
  update(value, tr) {
    for (const e of tr.effects) if (e.is(setRepetitionEffect)) return e.value;
    return value;
  }
});
