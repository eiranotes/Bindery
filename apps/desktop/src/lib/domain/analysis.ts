// Client-side manuscript analysis. Runs on the actual open document so editor
// decorations and the repetition panel always reflect real text (the mock
// command returned canned offsets that never matched the manuscript).
//
// Covers three "smart highlighting" families seen in peer tools (Novelcrafter):
//   - overused content words (frequency + rate)
//   - crutch reaction descriptions (curated Korean watchlist)
//   - repeated dialogue tags (voice sameness) and AI-cliché phrases
import type { RepetitionAnalysis, RepetitionTerm } from './reports';
import { parseFrontmatter } from './frontmatter';

export type AnalysisMode = 'word' | 'phrase' | 'ending';

// Reaction/description crutches common in Korean web fiction — flagged earlier
// than generic words because a few repeats already read as a tic.
const REACTION_WATCH = ['시선', '침묵', '고개', '표정', '미소', '한숨', '눈빛', '눈길', '입술', '어깨'];

// Dialogue tags / action beats that flatten character voice when repeated.
const DIALOGUE_TAGS = ['고개를 끄덕였다', '고개를 저었다', '어깨를 으쓱', '말했다', '중얼거렸다', '내뱉었다', '되물었다', '한숨을 쉬었다'];

// AI / genre clichés and crutch phrases.
const CLICHES = ['알 수 없는', '묘한', '그 순간', '한 줄기', '말로 표현할 수 없', '미묘한', '뭐라 형용할 수 없', '알 수 없는 감정'];

const KO_PARTICLE_SUFFIX = /(은|는|이|가|을|를|에|의|와|과|도|만|께|에게|한테|으로|로|에서|부터|까지|처럼|보다|라도|마저|조차)$/;

function bodyWithOffset(text: string): { body: string; offset: number } {
  const fm = parseFrontmatter(text);
  return fm.present ? { body: text.slice(fm.end), offset: fm.end } : { body: text, offset: 0 };
}

function allIndexes(hay: string, needle: string): number[] {
  const out: number[] = [];
  if (!needle) return out;
  let i = hay.indexOf(needle);
  while (i !== -1) {
    out.push(i);
    i = hay.indexOf(needle, i + needle.length);
  }
  return out;
}

function judge(count: number, chars: number, boosted: boolean, kind: RepetitionTerm['kind']): RepetitionTerm['judgment'] {
  let level = 0; // 0 ok, 1 watch, 2 overused
  if (count >= 6) level = 2;
  else if (count >= 3) level = 1;
  // rate acts only as a secondary bump on real-length documents
  if (chars >= 800) {
    const per1k = (count * 1000) / chars;
    if (per1k >= 4 && count >= 3) level = 2;
    else if (per1k >= 2 && count >= 2) level = Math.max(level, 1);
  }
  if (boosted && level < 2) level += 1; // crutch / tag / cliché read as a tic sooner
  if (kind === 'cliche' && count >= 1) level = Math.max(level, 1); // even one AI cliché is worth a look
  return level >= 2 ? 'overused' : level >= 1 ? 'watch' : 'ok';
}

/** Tokenise the body into content words, stripping trailing Korean particles. */
function tokenize(body: string): Array<{ term: string; at: number }> {
  const tokens: Array<{ term: string; at: number }> = [];
  const re = /[\uac00-\ud7a3A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) {
    let t = m[0];
    // strip a single trailing particle for Korean tokens (에이라는 → 에이라)
    const stripped = t.replace(KO_PARTICLE_SUFFIX, '');
    if (stripped.length >= 2) t = stripped;
    if (t.length >= 2) tokens.push({ term: t, at: m.index });
  }
  return tokens;
}

export function analyzeManuscript(text: string, mode: AnalysisMode = 'word'): RepetitionAnalysis {
  const { body, offset } = bodyWithOffset(text);
  const chars = body.length || 1;

  const groups = new Map<string, { positions: number[]; boosted: boolean; kind: RepetitionTerm['kind'] }>();

  const add = (term: string, positions: number[], boosted: boolean, kind: RepetitionTerm['kind']) => {
    if (!positions.length) return;
    const g = groups.get(term) ?? { positions: [], boosted, kind };
    g.positions.push(...positions.map((p) => p + offset));
    g.boosted = g.boosted || boosted;
    g.kind = g.kind ?? kind;
    groups.set(term, g);
  };

  if (mode === 'ending') {
    // sentence-ending patterns (…다. …까. …요.) to catch monotonous rhythm
    const re = /([가-힣]{1,3})([.?!]|”|"|다\.)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(body))) {
      const ending = m[1] + m[2];
      add(ending, [m.index], false, 'word');
    }
  } else {
    // words
    for (const { term, at } of tokenize(body)) {
      add(term, [at], REACTION_WATCH.includes(term), REACTION_WATCH.includes(term) ? 'crutch' : 'word');
    }
    // curated crutch reaction words (ensure caught even after particle merges)
    for (const w of REACTION_WATCH) add(w, allIndexes(body, w), true, 'crutch');
  }

  // dialogue tags + clichés always scanned as phrase-level signals
  for (const tag of DIALOGUE_TAGS) add(tag, allIndexes(body, tag), true, 'dialogue-tag');
  for (const c of CLICHES) add(c, allIndexes(body, c), true, 'cliche');

  const terms: RepetitionTerm[] = [];
  for (const [term, g] of groups) {
    const positions = Array.from(new Set(g.positions)).sort((a, b) => a - b);
    const count = positions.length;
    if (count < 2 && g.kind === 'word') continue; // ignore singletons for plain words
    const judgment = judge(count, chars, g.boosted, g.kind);
    if (judgment === 'ok') continue;
    terms.push({ term, count, positions, judgment, kind: g.kind });
  }

  terms.sort((a, b) => {
    const order = { overused: 0, watch: 1, ok: 2 } as const;
    if (order[a.judgment] !== order[b.judgment]) return order[a.judgment] - order[b.judgment];
    return b.count - a.count;
  });

  const paragraphs = body.split(/\n\s*\n/).filter((p) => p.trim()).length;
  return { path: 'doc', terms, rhythm: { chars, paragraphs } };
}
