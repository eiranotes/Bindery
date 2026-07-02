// dynamicMentionDecoration + repetitionDecoration
//
// Performance: the codex scan runs once per relevant change inside the
// ViewPlugin, the result is cached (keyed by view) and reused by the hover
// tooltip instead of re-scanning on every pointer move. Scans are skipped
// while a Korean IME composition is active and above a size cutoff.
import { Decoration, EditorView, ViewPlugin, hoverTooltip } from '@codemirror/view';
import type { DecorationSet, ViewUpdate, Tooltip } from '@codemirror/view';
import { scanDynamicLinks } from '$lib/domain/codex';
import type { CodexType, MentionReport } from '$lib/domain/codex';
import { codexField, repetitionField } from './state';

const SCAN_CHAR_CUTOFF = 60000; // beyond this, auto-scan pauses (worker path is a future upgrade)
const scanCache = new WeakMap<EditorView, MentionReport>();

const TYPE_ICON: Record<CodexType, string> = {
  character: '◆', location: '⌂', faction: '⚑', system: '⚙', item: '✦', term: '§', event: '✳'
};

function computeReport(view: EditorView): MentionReport {
  const codex = view.state.field(codexField, false) ?? [];
  const text = view.state.doc.toString();
  if (!codex.length || text.length > SCAN_CHAR_CUTOFF) {
    const empty: MentionReport = { path: 'doc', mentions: [], missing: codex.map((c) => c.name) };
    scanCache.set(view, empty);
    return empty;
  }
  const report = scanDynamicLinks('doc', text, codex, 0.4);
  scanCache.set(view, report);
  return report;
}

function mentionDecorations(report: MentionReport): DecorationSet {
  const ranges = report.mentions
    .filter((m) => !m.alreadyLinked)
    .map((m) =>
      Decoration.mark({
        class: m.confidence >= 0.7 ? 'cm-mention cm-mention-strong' : 'cm-mention cm-mention-weak',
        attributes: { 'data-codex': m.itemId, 'data-type': m.type }
      }).range(m.from, m.to)
    );
  return Decoration.set(ranges, true);
}

export const dynamicMentionDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = mentionDecorations(computeReport(view)); }
    update(u: ViewUpdate) {
      const codexChanged = u.startState.field(codexField, false) !== u.state.field(codexField, false);
      if ((u.docChanged || codexChanged) && !u.view.composing) {
        this.decorations = mentionDecorations(computeReport(u.view));
      }
    }
  },
  { decorations: (v) => v.decorations }
);

/** Hover card showing codex summary — reuses the cached scan. */
export const mentionHover = hoverTooltip((view, pos): Tooltip | null => {
  const codex = view.state.field(codexField, false) ?? [];
  if (!codex.length) return null;
  const report = scanCache.get(view) ?? computeReport(view);
  const hit = report.mentions.find((m) => pos >= m.from && pos <= m.to);
  if (!hit) return null;
  const item = codex.find((c) => c.id === hit.itemId);
  if (!item) return null;
  return {
    pos: hit.from,
    end: hit.to,
    above: true,
    create() {
      const dom = document.createElement('div');
      dom.className = 'cm-codex-tooltip';
      const meta = [item.type, item.status, item.firstAppearance ? `First: ${item.firstAppearance}` : null]
        .filter(Boolean)
        .join(' · ');
      dom.innerHTML =
        `<div class="cm-ct-head">${TYPE_ICON[item.type]} <strong>${escapeHtml(item.name)}</strong></div>` +
        `<div class="cm-ct-meta">${escapeHtml(meta)}</div>` +
        (item.summary ? `<div class="cm-ct-body">${escapeHtml(item.summary)}</div>` : '') +
        `<div class="cm-ct-foot">confidence ${(hit.confidence * 100) | 0}%</div>`;
      return { dom };
    }
  };
});

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

// --- repetition ------------------------------------------------------------
function repetitionDecorations(view: EditorView): DecorationSet {
  const terms = view.state.field(repetitionField, false) ?? [];
  const flagged = terms.filter((t) => t.judgment !== 'ok' && !t.intentional);
  if (!flagged.length) return Decoration.none;
  const text = view.state.doc.toString();
  const ranges: { from: number; to: number; cls: string }[] = [];
  for (const t of flagged) {
    if (!t.term) continue;
    const cls = t.judgment === 'overused' ? 'cm-rep-over' : 'cm-rep-watch';
    let idx = text.indexOf(t.term);
    while (idx !== -1) {
      ranges.push({ from: idx, to: idx + t.term.length, cls });
      idx = text.indexOf(t.term, idx + t.term.length);
    }
  }
  ranges.sort((a, b) => a.from - b.from);
  const deco: Array<ReturnType<Decoration['range']>> = [];
  let lastEnd = -1;
  for (const r of ranges) {
    if (r.from < lastEnd) continue; // keep sorted, non-overlapping
    deco.push(Decoration.mark({ class: r.cls }).range(r.from, r.to));
    lastEnd = r.to;
  }
  return Decoration.set(deco, true);
}

export const repetitionDecoration = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) { this.decorations = repetitionDecorations(view); }
    update(u: ViewUpdate) {
      const changed = u.startState.field(repetitionField, false) !== u.state.field(repetitionField, false);
      if ((u.docChanged || changed) && !u.view.composing) this.decorations = repetitionDecorations(u.view);
    }
  },
  { decorations: (v) => v.decorations }
);
