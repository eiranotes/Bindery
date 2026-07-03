// frontmatterExtension + wordCountPlugin
import { Decoration, EditorView, ViewPlugin, WidgetType } from '@codemirror/view';
import type { DecorationSet, ViewUpdate } from '@codemirror/view';
import { StateField } from '@codemirror/state';
import { parseFrontmatter } from '$lib/domain/frontmatter';

// --- frontmatter -----------------------------------------------------------
class FmBadge extends WidgetType {
  constructor(readonly label: string) { super(); }
  eq(o: FmBadge) { return o.label === this.label; }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cm-fm-badge';
    el.textContent = this.label;
    return el;
  }
  ignoreEvent() { return true; }
}

function frontmatterDecorations(view: EditorView): DecorationSet {
  const text = view.state.doc.toString();
  const fm = parseFrontmatter(text);
  if (!fm.present) return Decoration.none;
  const builder: ReturnType<typeof Decoration.line>[] = [];
  const ranges: { from: number; deco: Decoration }[] = [];
  const lastLine = view.state.doc.lineAt(Math.max(0, fm.end - 1)).number;
  for (let n = 1; n <= lastLine; n++) {
    const line = view.state.doc.line(n);
    ranges.push({ from: line.from, deco: Decoration.line({ class: 'cm-frontmatter-line' }) });
  }
  const firstLine = view.state.doc.line(1);
  const keys = Object.keys(fm.data);
  const label = keys.length ? `frontmatter · ${keys.slice(0, 4).join(', ')}${keys.length > 4 ? '…' : ''}` : 'frontmatter';
  ranges.push({ from: firstLine.from, deco: Decoration.widget({ widget: new FmBadge(label), side: -1 }) });
  ranges.sort((a, b) => a.from - b.from);
  return Decoration.set(ranges.map((r) => r.deco.range(r.from)), true);
}

export const frontmatterExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = frontmatterDecorations(view); }
    update(u: ViewUpdate) { if (u.docChanged || u.viewportChanged) this.decorations = frontmatterDecorations(u.view); }
  },
  { decorations: (v) => v.decorations }
);

// --- word count ------------------------------------------------------------
export type WordStats = {
  words: number;
  chars: number;
  charsNoSpace: number;
  paragraphs: number;
  sentences: number;
  manuscriptPages: number;
};

export function computeStats(text: string): WordStats {
  const stripped = text.replace(/^---[\s\S]*?\n---\n?/, '');
  const words = stripped.trim() ? stripped.trim().split(/\s+/).filter(Boolean).length : 0;
  const chars = stripped.length;
  const charsNoSpace = stripped.replace(/\s/g, '').length;
  const paragraphs = stripped.split(/\n\s*\n/).filter((p) => p.trim()).length;
  const sentences = stripped.split(/[.!?。！？…]+|\n{2,}/).filter((s) => /[가-힣A-Za-z0-9]/.test(s)).length;
  const manuscriptPages = Math.ceil(charsNoSpace / 200);
  return { words, chars, charsNoSpace, paragraphs, sentences, manuscriptPages };
}

export const wordCountField = StateField.define<WordStats>({
  create: (state) => computeStats(state.doc.toString()),
  update(value, tr) {
    if (!tr.docChanged) return value;
    return computeStats(tr.newDoc.toString());
  }
});
