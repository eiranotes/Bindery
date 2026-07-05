// 라인 기반 diff — 후보 원고 vs 기준 원고 비교와 hunk 단위 적용.
// LCS 기반. 외부 의존성 없음.

export type DiffLine = { kind: 'same' | 'add' | 'del'; text: string };
export type Hunk = { id: number; baseStart: number; lines: DiffLine[] };

function lcsTable(a: string[], b: string[]): Int32Array {
  const w = b.length + 1;
  const table = new Int32Array((a.length + 1) * w);
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      table[i * w + j] = a[i] === b[j]
        ? table[(i + 1) * w + j + 1] + 1
        : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
    }
  }
  return table;
}

export function diffLines(baseText: string, nextText: string): DiffLine[] {
  const a = baseText.split('\n');
  const b = nextText.split('\n');
  // 대용량 보호: 표가 너무 크면 통짜 교체 diff로 처리
  if (a.length * b.length > 4_000_000) {
    return [...a.map((text) => ({ kind: 'del' as const, text })), ...b.map((text) => ({ kind: 'add' as const, text }))];
  }
  const table = lcsTable(a, b);
  const w = b.length + 1;
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      out.push({ kind: 'same', text: a[i] });
      i++; j++;
    } else if (table[(i + 1) * w + j] >= table[i * w + j + 1]) {
      out.push({ kind: 'del', text: a[i++] });
    } else {
      out.push({ kind: 'add', text: b[j++] });
    }
  }
  while (i < a.length) out.push({ kind: 'del', text: a[i++] });
  while (j < b.length) out.push({ kind: 'add', text: b[j++] });
  return out;
}

/** 연속된 add/del 구간을 hunk로 묶는다. baseStart는 기준 원고에서의 시작 라인. */
export function groupHunks(lines: DiffLine[]): Hunk[] {
  const hunks: Hunk[] = [];
  let current: DiffLine[] = [];
  let baseLine = 0;
  let hunkBase = 0;
  let id = 0;
  const flush = () => {
    if (current.some((l) => l.kind !== 'same')) hunks.push({ id: id++, baseStart: hunkBase, lines: current });
    current = [];
  };
  for (const line of lines) {
    if (line.kind === 'same') {
      flush();
      baseLine++;
      continue;
    }
    if (current.length === 0) hunkBase = baseLine;
    current.push(line);
    if (line.kind === 'del') baseLine++;
  }
  flush();
  return hunks;
}

/** 선택한 hunk만 기준 원고에 적용한다. */
export function applyHunks(baseText: string, hunks: Hunk[], selectedIds: Set<number>): string {
  const base = baseText.split('\n');
  const chosen = hunks.filter((h) => selectedIds.has(h.id)).sort((x, y) => x.baseStart - y.baseStart);
  const out: string[] = [];
  let cursor = 0;
  for (const hunk of chosen) {
    out.push(...base.slice(cursor, hunk.baseStart));
    cursor = hunk.baseStart;
    for (const line of hunk.lines) {
      if (line.kind === 'add') out.push(line.text);
      if (line.kind === 'del') cursor++;
    }
  }
  out.push(...base.slice(cursor));
  return out.join('\n');
}
