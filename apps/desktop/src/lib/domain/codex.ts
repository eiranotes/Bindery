// Codex (setting wiki) model + Dynamic Link scan.
//
// Mirrors design_v0.2/docs/13_codex_dynamic_links.md. The scan builds an alias
// set, walks the document while skipping frontmatter / code / existing links,
// finds candidate mentions, and scores confidence. It is deterministic and
// runs entirely client-side so the browser/mock mode behaves like the real app.

export type CodexType =
  | 'character'
  | 'location'
  | 'faction'
  | 'system'
  | 'item'
  | 'term'
  | 'event';

export type CodexAlias = {
  value: string;
  autoLink: boolean;
  minLength: number;
};

export type CodexItem = {
  id: string;
  type: CodexType;
  name: string;
  aliases: CodexAlias[];
  path: string;
  summary?: string;
  firstAppearance?: string;
  lastSeen?: string;
  status?: string;
  relatedThreads?: string[];
  /** Progressions: how this entry changes over episodes (design doc 13). */
  progressions?: Array<{ episode: string; note: string }>;
  autoLink: boolean;
  minAliasLength: number;
};

export type Mention = {
  itemId: string;
  name: string;
  type: CodexType;
  surface: string;
  /** character offset in the document */
  from: number;
  to: number;
  confidence: number;
  alreadyLinked: boolean;
};

export type MentionReport = {
  path: string;
  mentions: Mention[];
  /** items that never appear in the scanned document */
  missing: string[];
};

const KO_PARTICLE = /^(은|는|이|가|을|를|에|의|와|과|도|만|께|에게|한테|으로|로|에서|부터|까지|처럼|보다)/;

/** Regions to exclude from scanning: frontmatter, fenced code, inline code, links. */
function maskedRegions(text: string): Array<[number, number]> {
  const regions: Array<[number, number]> = [];
  // frontmatter
  if (text.startsWith('---')) {
    const close = text.indexOf('\n---', 3);
    if (close !== -1) {
      const after = text.indexOf('\n', close + 1);
      regions.push([0, after === -1 ? text.length : after]);
    }
  }
  // fenced code blocks
  const fence = /```[\s\S]*?```/g;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(text))) regions.push([m.index, m.index + m[0].length]);
  // inline code
  const inline = /`[^`\n]+`/g;
  while ((m = inline.exec(text))) regions.push([m.index, m.index + m[0].length]);
  // markdown / wiki links
  const link = /\[\[[^\]]+\]\]|\[[^\]]*\]\([^)]*\)/g;
  while ((m = link.exec(text))) regions.push([m.index, m.index + m[0].length]);
  return regions;
}

function inRegions(pos: number, regions: Array<[number, number]>): boolean {
  return regions.some(([s, e]) => pos >= s && pos < e);
}

const COMMON_NOUNS = new Set(['시간', '사람', '문제', '이야기', '세계', '이유', '방법']);

function scoreMention(item: CodexItem, alias: CodexAlias, surface: string, ctxAfter: string, alreadyLinked: boolean): number {
  let score = 0.5;
  if (surface === item.name) score += 0.4;
  if (surface.length >= 3) score += 0.2;
  if (KO_PARTICLE.test(ctxAfter)) score += 0.1;
  if (alreadyLinked) score += 0.2;
  if (COMMON_NOUNS.has(surface)) score -= 0.4;
  if (!alias.autoLink) score -= 0.2;
  return Math.max(0, Math.min(1, score));
}

/**
 * Scan a document for codex mentions.
 * @param minConfidence drop candidates below this score (default 0.35)
 */
export function scanDynamicLinks(path: string, text: string, codex: CodexItem[], minConfidence = 0.35): MentionReport {
  const regions = maskedRegions(text);
  const mentions: Mention[] = [];
  const seen = new Set<string>();

  // Build (alias, item) pairs, longest-first so "에이라 파트너" beats "에이라".
  type Entry = { item: CodexItem; alias: CodexAlias };
  const entries: Entry[] = [];
  for (const item of codex) {
    entries.push({ item, alias: { value: item.name, autoLink: item.autoLink, minLength: item.minAliasLength } });
    for (const a of item.aliases) entries.push({ item, alias: a });
  }
  entries.sort((a, b) => b.alias.value.length - a.alias.value.length);

  for (const { item, alias } of entries) {
    const needle = alias.value;
    if (!needle || needle.length < alias.minLength) continue;
    let idx = text.indexOf(needle);
    while (idx !== -1) {
      const from = idx;
      const to = idx + needle.length;
      idx = text.indexOf(needle, to);
      if (inRegions(from, regions)) continue;

      // avoid double-counting an overlapping longer match
      const key = `${from}:${to}`;
      if (seen.has(key)) continue;
      let overlapped = false;
      for (const done of seen) {
        const [s, e] = done.split(':').map(Number);
        if (from < e && to > s) { overlapped = true; break; }
      }
      if (overlapped) continue;

      const alreadyLinked = text.slice(Math.max(0, from - 2), from) === '[[';
      const ctxAfter = text.slice(to, to + 3);
      const confidence = scoreMention(item, alias, needle, ctxAfter, alreadyLinked);
      if (confidence < minConfidence) continue;

      seen.add(key);
      mentions.push({
        itemId: item.id,
        name: item.name,
        type: item.type,
        surface: needle,
        from,
        to,
        confidence: Math.round(confidence * 100) / 100,
        alreadyLinked
      });
    }
  }

  mentions.sort((a, b) => a.from - b.from);
  const hit = new Set(mentions.map((m) => m.itemId));
  const missing = codex.filter((c) => !hit.has(c.id)).map((c) => c.name);
  return { path, mentions, missing };
}
