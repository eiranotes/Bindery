// Line-level diff used by the candidate → diff → apply flow.
//
// AI outputs are candidates, never destructive overwrites (state.md), so the
// GUI always shows a reviewable diff between the working document and a
// candidate before anything is written. This module produces both a flat row
// stream (for an inline unified view) and a hunk grouping (for granular apply).

export type DiffOp = 'equal' | 'add' | 'remove';

export type DiffRow = {
  op: DiffOp;
  /** line text (without trailing newline) */
  text: string;
  /** 1-based line number in the original document, if present */
  oldLine?: number;
  /** 1-based line number in the candidate document, if present */
  newLine?: number;
};

export type DiffHunk = {
  id: string;
  /** contiguous changed rows plus surrounding context */
  rows: DiffRow[];
  added: number;
  removed: number;
};

export type DiffResult = {
  rows: DiffRow[];
  hunks: DiffHunk[];
  added: number;
  removed: number;
};

function splitLines(text: string): string[] {
  // Preserve intent: an empty document is zero lines, not one blank line.
  if (text === '') return [];
  return text.replace(/\r\n/g, '\n').split('\n');
}

/** Longest-common-subsequence table over lines (O(n·m), fine for episodes). */
function lcs(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export function diffLines(original: string, candidate: string): DiffResult {
  const a = splitLines(original);
  const b = splitLines(candidate);
  const dp = lcs(a, b);

  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  let added = 0;
  let removed = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      rows.push({ op: 'equal', text: a[i], oldLine: i + 1, newLine: j + 1 });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ op: 'remove', text: a[i], oldLine: i + 1 });
      removed++;
      i++;
    } else {
      rows.push({ op: 'add', text: b[j], newLine: j + 1 });
      added++;
      j++;
    }
  }
  while (i < a.length) {
    rows.push({ op: 'remove', text: a[i], oldLine: i + 1 });
    removed++;
    i++;
  }
  while (j < b.length) {
    rows.push({ op: 'add', text: b[j], newLine: j + 1 });
    added++;
    j++;
  }

  return { rows, hunks: buildHunks(rows), added, removed };
}

/** Group changed rows (with up to `context` equal rows) into applyable hunks. */
function buildHunks(rows: DiffRow[], context = 2): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let start = -1;
  for (let k = 0; k < rows.length; k++) {
    const changed = rows[k].op !== 'equal';
    if (changed && start === -1) start = k;
    if (!changed && start !== -1) {
      // look ahead: if the next change is within 2*context, keep the hunk open
      let nextChange = -1;
      for (let t = k + 1; t < rows.length; t++) {
        if (rows[t].op !== 'equal') { nextChange = t; break; }
      }
      if (nextChange !== -1 && nextChange - k <= context * 2) continue;
      hunks.push(makeHunk(rows, start, k - 1, context, hunks.length));
      start = -1;
    }
  }
  if (start !== -1) hunks.push(makeHunk(rows, start, rows.length - 1, context, hunks.length));
  return hunks;
}

function makeHunk(rows: DiffRow[], from: number, to: number, context: number, idx: number): DiffHunk {
  const lo = Math.max(0, from - context);
  const hi = Math.min(rows.length - 1, to + context);
  const slice = rows.slice(lo, hi + 1);
  return {
    id: `hunk-${idx}`,
    rows: slice,
    added: slice.filter((r) => r.op === 'add').length,
    removed: slice.filter((r) => r.op === 'remove').length
  };
}

/**
 * Apply a single hunk from a diff of (original → candidate) onto the original
 * text, returning the new text. The caller recomputes the diff afterward, so
 * line drift from earlier applied hunks is handled naturally.
 */
export function applyHunk(original: string, hunk: DiffHunk): string {
  const lines = splitLines(original);
  const oldNums = hunk.rows.filter((r) => r.oldLine != null).map((r) => r.oldLine as number);
  const replacement = hunk.rows.filter((r) => r.op !== 'remove').map((r) => r.text);

  if (oldNums.length === 0) {
    // pure insertion with no anchor line — append at end
    return [...lines, ...replacement].join('\n');
  }
  const minOld = Math.min(...oldNums) - 1;
  const maxOld = Math.max(...oldNums) - 1;
  const next = [...lines.slice(0, minOld), ...replacement, ...lines.slice(maxOld + 1)];
  return next.join('\n');
}
