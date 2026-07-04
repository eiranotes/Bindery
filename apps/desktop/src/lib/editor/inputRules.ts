// Muvel-style writing conveniences (benchmark: 뮤블 스마트 따옴표 / 자동 대치 /
// 작가 주석). All rules act only on single ASCII trigger characters, so Korean
// IME composition is never intercepted.
import { EditorView, Decoration, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

/**
 * Smart quotes:
 *  - typing `"` inserts a curly pair “”​ with the caret inside
 *    (typing `"` again right before a closing quote steps over it)
 *  - typing `'` behaves the same with ‘’ (독백용)
 *  - pressing Enter just before a closing quote at end of line jumps past it
 *    first, so 대사 → 다음 줄 흐름이 끊기지 않는다 (뮤블 빠른 따옴표)
 */
export const smartQuotes = [
  EditorView.inputHandler.of((view, from, to, text) => {
    if (text !== '"' && text !== "'") return false;
    const [open, close] = text === '"' ? ['“', '”'] : ['‘', '’'];
    const next = view.state.doc.sliceString(to, to + 1);
    if (next === close) {
      // step over an existing closing quote instead of nesting
      view.dispatch({ selection: { anchor: to + 1 } });
      return true;
    }
    view.dispatch({
      changes: { from, to, insert: open + close },
      selection: { anchor: from + 1 }
    });
    return true;
  }),
  EditorView.domEventHandlers({
    keydown(e, view) {
      if (e.key !== 'Enter' || e.isComposing) return false;
      const { head } = view.state.selection.main;
      const nextChar = view.state.doc.sliceString(head, head + 1);
      if (nextChar !== '”' && nextChar !== '’') return false;
      const line = view.state.doc.lineAt(head);
      if (head + 1 !== line.to) return false; // only when the quote closes the line
      view.dispatch({
        changes: { from: head + 1, to: head + 1, insert: '\n' },
        selection: { anchor: head + 2 }
      });
      e.preventDefault();
      return true;
    }
  })
];

export type AutoReplaceOptions = {
  dash: boolean;
  arrow: boolean;
  ellipsis: boolean;
};

/** Auto replacements while typing. Each rule is user-configurable in Preferences. */
export function autoReplaceRules(options: AutoReplaceOptions) {
  return EditorView.inputHandler.of((view, from, to, text) => {
    const rules: Array<[boolean, string, string, string]> = [
      // [enabled, trigger char, preceding text, replacement]
      [options.dash, '-', '-', '—'],
      [options.arrow, '>', '-', '→'],
      [options.ellipsis, '.', '..', '…']
    ];
    for (const [enabled, trigger, before, repl] of rules) {
      if (!enabled) continue;
      if (text !== trigger) continue;
      const start = from - before.length;
      if (start < 0) continue;
      if (view.state.doc.sliceString(start, from) !== before) continue;
      view.dispatch({
        changes: { from: start, to, insert: repl },
        selection: { anchor: start + repl.length }
      });
      return true;
    }
    return false;
  });
}

export const autoReplace = autoReplaceRules({ dash: true, arrow: true, ellipsis: true });

/** Writer comments: lines starting with `//` are author-only notes — dimmed. */
function commentDecos(view: EditorView): DecorationSet {
  const deco: Array<ReturnType<Decoration['range']>> = [];
  for (const { from, to } of view.visibleRanges) {
    let line = view.state.doc.lineAt(from);
    while (line.from <= to) {
      if (line.text.trimStart().startsWith('//')) {
        deco.push(Decoration.line({ class: 'cm-writer-comment' }).range(line.from));
      }
      if (line.to + 1 > view.state.doc.length) break;
      line = view.state.doc.lineAt(line.to + 1);
    }
  }
  return Decoration.set(deco, true);
}

export const writerComments = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = commentDecos(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.viewportChanged) this.decorations = commentDecos(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);
