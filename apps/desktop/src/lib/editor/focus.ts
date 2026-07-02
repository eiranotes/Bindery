// Focus mode + typewriter scrolling — distraction-free writing affordances
// found in iA Writer / FocusWriter. Both are toggled from the host via
// compartment reconfiguration, so they add zero cost when disabled.
import { Decoration, EditorView, ViewPlugin } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';

// --- focus mode: dim every paragraph except the one with the cursor --------
function focusDecorations(view: EditorView): DecorationSet {
  const sel = view.state.selection.main.head;
  const doc = view.state.doc;
  const cursorLine = doc.lineAt(sel).number;
  // find the paragraph (block of non-blank lines) containing the cursor
  let top = cursorLine;
  while (top > 1 && doc.line(top - 1).text.trim() !== '') top--;
  let bottom = cursorLine;
  while (bottom < doc.lines && doc.line(bottom + 1).text.trim() !== '') bottom++;

  const ranges = [] as ReturnType<typeof Decoration.line>[];
  const deco: Array<ReturnType<Decoration['range']>> = [];
  void ranges;
  for (let n = 1; n <= doc.lines; n++) {
    if (n < top || n > bottom) {
      deco.push(Decoration.line({ class: 'cm-focus-dim' }).range(doc.line(n).from));
    }
  }
  return Decoration.set(deco, true);
}

export const focusModeExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = focusDecorations(view); }
    update(u: ViewUpdate) {
      if (u.docChanged || u.selectionSet || u.viewportChanged) this.decorations = focusDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);

// --- typewriter scrolling: keep the active line centred --------------------
export const typewriterExtension = [
  EditorView.updateListener.of((u: ViewUpdate) => {
    if (!u.selectionSet && !u.docChanged) return;
    const head = u.state.selection.main.head;
    // defer to next frame so layout is settled
    requestAnimationFrame(() => {
      u.view.dispatch({ effects: EditorView.scrollIntoView(head, { y: 'center' }) });
    });
  }),
  EditorView.theme({
    // generous padding lets the first/last lines reach the vertical centre
    '.cm-content': { paddingTop: '40vh', paddingBottom: '40vh' }
  })
];
