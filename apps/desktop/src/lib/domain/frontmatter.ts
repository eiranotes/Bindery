// Minimal, dependency-free YAML frontmatter reader.
// Supports scalars and simple `- ` list items which is all the project's
// canonical files use. Returns both the parsed map and the source ranges so
// the editor can decorate the frontmatter block.

export type Frontmatter = {
  data: Record<string, unknown>;
  /** character offset where the frontmatter block starts (0 if present) */
  start: number;
  /** character offset immediately after the closing fence */
  end: number;
  present: boolean;
};

export function parseFrontmatter(text: string): Frontmatter {
  const empty: Frontmatter = { data: {}, start: 0, end: 0, present: false };
  if (!text.startsWith('---')) return empty;

  const closeIdx = text.indexOf('\n---', 3);
  if (closeIdx === -1) return empty;

  // end = position just after the closing `---` line (+ its newline if any)
  const afterClose = text.indexOf('\n', closeIdx + 1);
  const end = afterClose === -1 ? text.length : afterClose + 1;
  const body = text.slice(text.indexOf('\n') + 1, closeIdx);

  const data: Record<string, unknown> = {};
  let currentKey: string | null = null;
  for (const raw of body.split('\n')) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const listMatch = /^\s*-\s+(.*)$/.exec(line);
    if (listMatch && currentKey) {
      const arr = (data[currentKey] as unknown[]) ?? [];
      arr.push(stripQuotes(listMatch[1]));
      data[currentKey] = arr;
      continue;
    }
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (kv) {
      currentKey = kv[1];
      const value = kv[2];
      data[currentKey] = value === '' ? [] : stripQuotes(value);
    }
  }
  return { data, start: 0, end, present: true };
}

function stripQuotes(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

export function frontmatterField(text: string, key: string): string | undefined {
  const fm = parseFrontmatter(text);
  const v = fm.data[key];
  return typeof v === 'string' ? v : undefined;
}
