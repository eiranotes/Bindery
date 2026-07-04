// Editor theme + markdown syntax highlighting tuned to the Bindery
// dark palette. Also styles every custom decoration class introduced by the
// extensions so they read as one coherent surface.
import { EditorView } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';

export const novelThemeDark = EditorView.theme(
  {
    '&': { color: 'var(--text)', backgroundColor: 'transparent', height: '100%' },
    '.cm-scroller': {
      fontFamily: 'var(--manuscript-font)',
      fontSize: 'var(--manuscript-size)',
      lineHeight: 'var(--manuscript-lh)',
      padding: '22px 18px 28px'
    },
    '.cm-content': { caretColor: 'var(--accent-2)', maxWidth: 'var(--manuscript-measure)', margin: '0 auto' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent-2)', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(139,92,246,.28)'
    },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--faint)', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(255,255,255,.025)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },

    // frontmatter
    '.cm-frontmatter-line': {
      backgroundColor: 'rgba(34,211,238,.045)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12.5px',
      color: 'var(--muted)'
    },
    '.cm-fm-badge': {
      display: 'inline-block',
      fontFamily: 'ui-monospace, monospace',
      fontSize: '10px',
      letterSpacing: '.04em',
      textTransform: 'uppercase',
      color: 'var(--accent-2)',
      border: '1px solid rgba(34,211,238,.3)',
      borderRadius: '6px',
      padding: '1px 6px',
      marginRight: '8px',
      verticalAlign: 'middle'
    },

    // codex mentions
    '.cm-mention': { borderBottom: '1px dashed', cursor: 'help' },
    '.cm-mention-strong': { borderColor: 'var(--accent)', color: '#d7c9ff' },
    '.cm-mention-weak': { borderColor: 'rgba(139,92,246,.4)' },

    // repetition
    '.cm-rep-over': { backgroundColor: 'rgba(251,113,133,.22)', borderRadius: '3px', boxShadow: 'inset 0 -2px 0 rgba(251,113,133,.6)' },
    '.cm-rep-watch': { backgroundColor: 'rgba(251,191,36,.16)', borderRadius: '3px' },

    // codex hover card
    '.cm-codex-tooltip': {
      maxWidth: '280px',
      padding: '10px 12px',
      background: '#0d1017',
      border: '1px solid var(--line)',
      borderRadius: '12px',
      boxShadow: '0 12px 40px rgba(0,0,0,.5)',
      color: 'var(--text)'
    },
    '.cm-codex-tooltip .cm-ct-head': { fontSize: '14px', marginBottom: '3px' },
    '.cm-codex-tooltip .cm-ct-meta': { fontSize: '11px', color: 'var(--accent-2)', textTransform: 'capitalize', marginBottom: '6px' },
    '.cm-codex-tooltip .cm-ct-body': { fontSize: '12.5px', color: 'var(--muted)', lineHeight: '1.5' },
    '.cm-codex-tooltip .cm-ct-foot': { fontSize: '10px', color: 'var(--faint)', marginTop: '6px' },

    '.cm-tooltip': { border: 'none', background: 'transparent' },

    // focus mode: dim inactive paragraphs
    '.cm-focus-dim': { opacity: '0.32', transition: 'opacity .18s ease' },
    '.cm-writer-comment': { opacity: '0.45', fontStyle: 'italic', fontSize: '.92em' },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'Inter, system-ui, sans-serif',
      background: '#0d1017',
      border: '1px solid var(--line)',
      borderRadius: '12px',
      maxHeight: '260px'
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'rgba(139,92,246,.22)', color: 'var(--text)' },
    '.cm-completionDetail': { color: 'var(--accent-2)', fontStyle: 'normal', fontSize: '11px' }
  },
  { dark: true }
);

export const novelHighlightDark = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, fontSize: '1.5em', fontWeight: '800', color: '#f2f5fb', lineHeight: '2.4' },
    { tag: t.heading2, fontSize: '1.25em', fontWeight: '750', color: '#e8edf6' },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700', color: '#dbe3f0' },
    { tag: t.strong, fontWeight: '700', color: '#f0ecff' },
    { tag: t.emphasis, fontStyle: 'italic', color: '#cfe9f2' },
    { tag: t.link, color: 'var(--accent-2)', textDecoration: 'underline' },
    { tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
    { tag: [t.monospace], fontFamily: 'ui-monospace, monospace', color: '#9fe6c9', fontSize: '.9em' },
    { tag: t.list, color: 'var(--muted)' },
    { tag: [t.processingInstruction, t.meta], color: 'var(--faint)' }
  ])
);


/* ---------------- light (paper) variants ---------------- */
export const novelThemeLight = EditorView.theme(
  {
    '&': { color: 'var(--text)', backgroundColor: 'transparent', height: '100%' },
    '.cm-scroller': {
      fontFamily: 'var(--manuscript-font)',
      fontSize: 'var(--manuscript-size)',
      lineHeight: 'var(--manuscript-lh)',
      padding: '26px 20px 32px'
    },
    '.cm-content': { caretColor: 'var(--accent)', maxWidth: 'var(--manuscript-measure)', margin: '0 auto' },
    '&.cm-focused': { outline: 'none' },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection': {
      backgroundColor: 'rgba(109,91,208,.18)'
    },
    '.cm-gutters': { backgroundColor: 'transparent', color: 'var(--faint)', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(60,56,48,.035)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--muted)' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 8px 0 12px' },

    '.cm-frontmatter-line': {
      backgroundColor: 'var(--accent-2-soft)',
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
      fontSize: '12.5px',
      color: 'var(--muted)'
    },
    '.cm-fm-badge': {
      display: 'inline-block', fontFamily: 'ui-monospace, monospace',
      fontSize: '10px', letterSpacing: '.04em', textTransform: 'uppercase',
      color: 'var(--accent-2)', border: '1px solid var(--accent-2)',
      borderRadius: '6px', padding: '1px 6px', marginRight: '8px', verticalAlign: 'middle'
    },

    '.cm-mention': { borderBottom: '1px dashed', cursor: 'help' },
    '.cm-mention-strong': { borderColor: 'var(--accent)', color: 'var(--accent)' },
    '.cm-mention-weak': { borderColor: 'var(--faint)' },

    '.cm-rep-over': { backgroundColor: 'var(--bad-soft)', borderRadius: '3px', boxShadow: 'inset 0 -2px 0 var(--bad)' },
    '.cm-rep-watch': { backgroundColor: 'var(--warn-soft)', borderRadius: '3px' },

    '.cm-focus-dim': { opacity: '0.3', transition: 'opacity .18s ease' },
    '.cm-writer-comment': { opacity: '0.5', fontStyle: 'italic', fontSize: '.92em' },

    '.cm-codex-tooltip': {
      maxWidth: '280px', padding: '10px 12px',
      background: 'var(--pop)', border: '1px solid var(--line)',
      borderRadius: '12px', boxShadow: 'var(--shadow-pop)', color: 'var(--text)'
    },
    '.cm-codex-tooltip .cm-ct-head': { fontSize: '14px', marginBottom: '3px' },
    '.cm-codex-tooltip .cm-ct-meta': { fontSize: '11px', color: 'var(--accent-2)', textTransform: 'capitalize', marginBottom: '6px' },
    '.cm-codex-tooltip .cm-ct-body': { fontSize: '12.5px', color: 'var(--muted)', lineHeight: '1.5' },
    '.cm-codex-tooltip .cm-ct-foot': { fontSize: '10px', color: 'var(--faint)', marginTop: '6px' },

    '.cm-tooltip': { border: 'none', background: 'transparent' },
    '.cm-tooltip-autocomplete > ul': {
      fontFamily: 'inherit', background: 'var(--pop)',
      border: '1px solid var(--line)', borderRadius: '12px', maxHeight: '260px',
      boxShadow: 'var(--shadow-pop)'
    },
    '.cm-tooltip-autocomplete ul li[aria-selected]': { background: 'var(--accent-soft)', color: 'var(--text)' },
    '.cm-completionDetail': { color: 'var(--accent-2)', fontStyle: 'normal', fontSize: '11px' }
  },
  { dark: false }
);

export const novelHighlightLight = syntaxHighlighting(
  HighlightStyle.define([
    { tag: t.heading1, fontSize: '1.5em', fontWeight: '800', color: '#211d18', lineHeight: '2.4' },
    { tag: t.heading2, fontSize: '1.25em', fontWeight: '750', color: '#2a251f' },
    { tag: [t.heading3, t.heading4, t.heading5, t.heading6], fontWeight: '700', color: '#332e27' },
    { tag: t.strong, fontWeight: '700', color: '#241f2e' },
    { tag: t.emphasis, fontStyle: 'italic', color: '#1e4750' },
    { tag: t.link, color: 'var(--accent-2)', textDecoration: 'underline' },
    { tag: t.quote, color: 'var(--muted)', fontStyle: 'italic' },
    { tag: [t.monospace], fontFamily: 'ui-monospace, monospace', color: '#1c7a55', fontSize: '.9em' },
    { tag: t.list, color: 'var(--muted)' },
    { tag: [t.processingInstruction, t.meta], color: 'var(--faint)' }
  ])
);

/** Theme bundle picker for the editor compartment. */
export function editorTheme(mode: 'light' | 'dark') {
  return mode === 'dark' ? [novelThemeDark, novelHighlightDark] : [novelThemeLight, novelHighlightLight];
}
