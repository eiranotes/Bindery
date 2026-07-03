// qaDiagnosticsExtension — surfaces QA issues as CodeMirror lint diagnostics
// so problems appear in the gutter and inline, and can be navigated with the
// standard lint keymap.
import { linter } from '@codemirror/lint';
import type { Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { qaIssuesField } from './state';

const SEVERITY_MAP: Record<string, Diagnostic['severity']> = {
  fail: 'error',
  warn: 'warning',
  info: 'info'
};

export const qaDiagnosticsExtension = linter((view: EditorView): Diagnostic[] => {
  const issues = view.state.field(qaIssuesField, false) ?? [];
  const doc = view.state.doc;
  const out: Diagnostic[] = [];
  for (const issue of issues) {
    if (!issue.lineStart) continue;
    const startLine = Math.min(Math.max(1, issue.lineStart), doc.lines);
    const endLine = Math.min(Math.max(startLine, issue.lineEnd ?? startLine), doc.lines);
    const from = doc.line(startLine).from;
    const to = doc.line(endLine).to;
    out.push({
      from,
      to,
      severity: SEVERITY_MAP[issue.severity] ?? 'info',
      source: issue.source ? `QA · ${issue.source}` : 'QA',
      message: (issue.title ? issue.title + ': ' : '') + issue.message,
      actions: issue.suggestedAction
        ? [{ name: 'note', apply: () => { /* suggestion is advisory; applying is done via revision plan */ } }]
        : undefined
    });
  }
  return out;
}, { delay: 400 });
