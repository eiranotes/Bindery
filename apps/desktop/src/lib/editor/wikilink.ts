// wikiLinkCompletion + aiCommandMenu
import { autocompletion } from '@codemirror/autocomplete';
import type { CompletionContext, CompletionResult, Completion } from '@codemirror/autocomplete';
import { StateEffect, StateField } from '@codemirror/state';
import { codexField } from './state';

// --- wiki links: complete [[codex name]] -----------------------------------
function wikiLinkSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/\[\[[^\]]*/);
  if (!before) return null;
  const typed = before.text.slice(2);
  if (!context.explicit && typed.length === 0) return null;
  const codex = context.state.field(codexField, false) ?? [];
  const options: Completion[] = codex.map((item) => ({
    label: item.name,
    type: item.type === 'character' ? 'variable' : 'constant',
    detail: item.type,
    info: item.summary,
    apply: `[[${item.name}]]`
  }));
  return { from: before.from, options, filter: true };
}

// --- AI command menu: `/context`, `/draft`, `/qa` … ------------------------
export type AICommand = { name: string; label: string; hint: string };

const AI_COMMANDS: AICommand[] = [
  { name: 'context', label: '/context', hint: '이번 회차의 컨텍스트 묶음 생성' },
  { name: 'draft', label: '/draft', hint: '초안 후보 A/B 생성' },
  { name: 'continue', label: '/continue', hint: '커서 위치부터 이어쓰기' },
  { name: 'rewrite', label: '/rewrite', hint: '선택 영역을 후보로 다시 쓰기' },
  { name: 'qa', label: '/qa', hint: '현재 원고 QA 검사' },
  { name: 'revise', label: '/revise', hint: '수정 계획 생성' },
  { name: 'summarize', label: '/summarize', hint: '회차 요약 생성' }
];

/** Effect fired when the user picks an AI command from the menu. */
export const aiCommandEffect = StateEffect.define<{ name: string; from: number; to: number }>();

/** A tiny field so a host can subscribe to the last AI command request. */
export const aiCommandField = StateField.define<{ name: string } | null>({
  create: () => null,
  update(v, tr) {
    for (const e of tr.effects) if (e.is(aiCommandEffect)) return { name: e.value.name };
    return v;
  }
});

function aiCommandSource(context: CompletionContext): CompletionResult | null {
  const before = context.matchBefore(/(^|\s)\/[a-z]*/);
  if (!before) return null;
  const slashIdx = before.text.lastIndexOf('/');
  const from = before.from + slashIdx;
  const options: Completion[] = AI_COMMANDS.map((c) => ({
    label: c.label,
    type: 'keyword',
    detail: 'AI',
    info: c.hint,
    apply: (view, _c, fromPos, toPos) => {
      // remove the typed slash-command, then signal the host to run it
      view.dispatch({
        changes: { from: fromPos, to: toPos, insert: '' },
        effects: aiCommandEffect.of({ name: c.name, from: fromPos, to: toPos })
      });
    }
  }));
  return { from, options, filter: true };
}

export const wikiLinkCompletion = autocompletion({
  override: [wikiLinkSource, aiCommandSource],
  icons: false,
  defaultKeymap: true
});

export { AI_COMMANDS };
