// AI 출력 계약 — 각 단계 산출물의 타입과 구조 검증기.
// JSON Schema 문서 사본은 schemas/*.schema.json 에 있다 (외부 도구·웹 AI 교환용).
// 검증 실패 시 null을 반환하고, 호출부(runner)가 repair 또는 fallback을 결정한다.
import { extractJsonObject, safeString, safeStringArray } from '$lib/core/text';

// ---------------------------------------------------------------------------
// IdeaSeed
// ---------------------------------------------------------------------------
export type IdeaSeed = {
  schema_version: 'bindery.idea_seed.v1';
  id: string;
  title: string;
  genre_tags: string[];
  hook: string;
  emotional_engine: string;
  reader_promise: string;
  longform_potential: string;
  first_scene_image: string;
  risks: string[];
  source: 'agent' | 'local' | 'manual' | 'web-import';
  createdAt: string;
};

export function parseIdeaSeedBatch(text: string, now: string): Omit<IdeaSeed, 'id' | 'source' | 'createdAt'>[] | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.seeds) || raw.seeds.length === 0) return null;
  const seeds: Omit<IdeaSeed, 'id' | 'source' | 'createdAt'>[] = [];
  for (const item of raw.seeds as Record<string, unknown>[]) {
    const title = safeString(item.title);
    const hook = safeString(item.hook);
    const promise = safeString(item.reader_promise);
    if (!title || !hook || !promise) continue;
    seeds.push({
      schema_version: 'bindery.idea_seed.v1',
      title,
      genre_tags: safeStringArray(item.genre_tags, 6),
      hook,
      emotional_engine: safeString(item.emotional_engine),
      reader_promise: promise,
      longform_potential: safeString(item.longform_potential),
      first_scene_image: safeString(item.first_scene_image),
      risks: safeStringArray(item.risks, 5)
    });
  }
  void now;
  return seeds.length ? seeds : null;
}

// ---------------------------------------------------------------------------
// WorldExpansionProposal
// ---------------------------------------------------------------------------
export const WORLD_ASSET_KINDS = ['character', 'location', 'institution', 'system', 'rule', 'term', 'relationship', 'conflict'] as const;
export type WorldAssetKind = (typeof WORLD_ASSET_KINDS)[number];

export type WorldAsset = {
  kind: WorldAssetKind;
  name: string;
  one_line_function: string;
  detail_md: string;
  needed_by: string;
  risk: string;
};

export type WorldExpansionProposal = {
  schema_version: 'bindery.world_expansion_proposal.v1';
  premise: string;
  assets: WorldAsset[];
  story_license_notes: string[];
};

export function parseWorldExpansionProposal(text: string): WorldExpansionProposal | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.assets) || raw.assets.length === 0) return null;
  const assets: WorldAsset[] = [];
  for (const item of raw.assets as Record<string, unknown>[]) {
    const name = safeString(item.name);
    const fn = safeString(item.one_line_function);
    const kind = safeString(item.kind) as WorldAssetKind;
    if (!name || !fn || !WORLD_ASSET_KINDS.includes(kind)) continue;
    assets.push({
      kind,
      name,
      one_line_function: fn,
      detail_md: safeString(item.detail_md, `# ${name}\n\n- 기능: ${fn}\n`),
      needed_by: safeString(item.needed_by, '미정'),
      risk: safeString(item.risk)
    });
  }
  if (!assets.length) return null;
  return {
    schema_version: 'bindery.world_expansion_proposal.v1',
    premise: safeString(raw.premise),
    assets,
    story_license_notes: safeStringArray(raw.story_license_notes, 10)
  };
}

// ---------------------------------------------------------------------------
// PlotPlan
// ---------------------------------------------------------------------------
export type PlotArc = { id: string; label: string; goal: string; episodes: string };
export type PlotEpisodeRow = {
  episode: string;
  arc: string;
  title: string;
  goal: string;
  beats: string[];
  threads_open: string[];
  threads_close: string[];
  hook: string;
  risk: string;
  status: 'draft' | 'approved';
};
export type PlotPlan = {
  schema_version: 'bindery.plot_plan.v1';
  arcs: PlotArc[];
  episodes: PlotEpisodeRow[];
  source: 'agent' | 'local' | 'web-import';
  updatedAt: string;
};

export function parsePlotPlan(text: string, now: string): PlotPlan | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.episodes) || raw.episodes.length === 0) return null;
  const episodes: PlotEpisodeRow[] = [];
  for (let i = 0; i < (raw.episodes as unknown[]).length; i++) {
    const item = (raw.episodes as Record<string, unknown>[])[i];
    const goal = safeString(item.goal);
    if (!goal) continue;
    const ep = /^ep\d{3}$/.test(safeString(item.episode)) ? safeString(item.episode) : `ep${String(i + 1).padStart(3, '0')}`;
    episodes.push({
      episode: ep,
      arc: safeString(item.arc, 'arc1'),
      title: safeString(item.title, `${ep} (제목 미정)`),
      goal,
      beats: safeStringArray(item.beats, 6),
      threads_open: safeStringArray(item.threads_open, 6),
      threads_close: safeStringArray(item.threads_close, 6),
      hook: safeString(item.hook),
      risk: safeString(item.risk),
      status: 'draft'
    });
  }
  if (episodes.length < 2) return null;
  const arcs: PlotArc[] = Array.isArray(raw.arcs)
    ? (raw.arcs as Record<string, unknown>[]).map((a, i) => ({
        id: safeString(a.id, `arc${i + 1}`),
        label: safeString(a.label, `${i + 1}부`),
        goal: safeString(a.goal),
        episodes: safeString(a.episodes)
      }))
    : [];
  return { schema_version: 'bindery.plot_plan.v1', arcs, episodes, source: 'agent', updatedAt: now };
}

// ---------------------------------------------------------------------------
// EpisodeBrief
// ---------------------------------------------------------------------------
export type EpisodeBrief = {
  schema_version: 'bindery.episode_brief.v1';
  episode: string;
  goal: string;
  must_events: string[];
  characters: string[];
  locations: string[];
  pov: string;
  knowledge_change: string[];
  emotion_change: string[];
  conflict_change: string;
  threads_touch: string[];
  forbidden: string[];
  target_length: number;
  exit_hook: string;
  source: 'agent' | 'local' | 'web-import';
};

export function parseEpisodeBrief(text: string, episode: string): EpisodeBrief | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw) return null;
  const goal = safeString(raw.goal);
  const events = safeStringArray(raw.must_events, 8);
  if (!goal || events.length === 0) return null;
  return {
    schema_version: 'bindery.episode_brief.v1',
    episode: safeString(raw.episode, episode),
    goal,
    must_events: events,
    characters: safeStringArray(raw.characters, 10),
    locations: safeStringArray(raw.locations, 6),
    pov: safeString(raw.pov, '미정'),
    knowledge_change: safeStringArray(raw.knowledge_change, 6),
    emotion_change: safeStringArray(raw.emotion_change, 6),
    conflict_change: safeString(raw.conflict_change),
    threads_touch: safeStringArray(raw.threads_touch, 8),
    forbidden: safeStringArray(raw.forbidden, 8),
    target_length: typeof raw.target_length === 'number' && raw.target_length > 0 ? raw.target_length : 5000,
    exit_hook: safeString(raw.exit_hook),
    source: 'agent'
  };
}

// ---------------------------------------------------------------------------
// ScenePlan
// ---------------------------------------------------------------------------
export type SceneCard = {
  id: string;
  purpose: string;
  setting: string;
  characters: string[];
  conflict: string;
  turn: string;
  carries: string[];
  target_length: number;
  exit: string;
};
export type ScenePlan = {
  schema_version: 'bindery.scene_plan.v1';
  episode: string;
  scenes: SceneCard[];
  risks: string[];
  source: 'agent' | 'local' | 'web-import';
};

export function parseScenePlan(text: string, episode: string): ScenePlan | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.scenes) || raw.scenes.length === 0) return null;
  const scenes: SceneCard[] = [];
  for (let i = 0; i < (raw.scenes as unknown[]).length; i++) {
    const item = (raw.scenes as Record<string, unknown>[])[i];
    const purpose = safeString(item.purpose);
    const turn = safeString(item.turn);
    if (!purpose || !turn) continue;
    scenes.push({
      id: safeString(item.id, `s${i + 1}`),
      purpose,
      setting: safeString(item.setting),
      characters: safeStringArray(item.characters, 8),
      conflict: safeString(item.conflict),
      turn,
      carries: safeStringArray(item.carries, 8),
      target_length: typeof item.target_length === 'number' && item.target_length > 0 ? item.target_length : 1200,
      exit: safeString(item.exit)
    });
  }
  if (!scenes.length) return null;
  return {
    schema_version: 'bindery.scene_plan.v1',
    episode: safeString(raw.episode, episode),
    scenes,
    risks: safeStringArray(raw.risks, 6),
    source: 'agent'
  };
}

// ---------------------------------------------------------------------------
// DraftCandidate (초안·수정 후보 공용 envelope)
// ---------------------------------------------------------------------------
export type CanonDeltaCandidate = { summary: string; target_hint: string; risk: string };
export type DraftCandidate = {
  schema_version: 'bindery.draft_candidate.v1';
  episode: string;
  manuscript_md: string;
  scene_coverage: { scene: string; covered: boolean; note: string }[];
  canon_delta_candidates: CanonDeltaCandidate[];
  style_self_check: { score: number; notes: string };
  change_summary: string;
  source: 'agent' | 'local' | 'web-import';
};

const REFUSAL_PATTERNS = /(죄송|할 수 없습니다|as an ai|cannot assist|i can't)/i;

export function parseDraftCandidate(text: string, episode: string, baseManuscript: string): { candidate: DraftCandidate | null; reason?: string } {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw) return { candidate: null, reason: 'JSON object를 찾지 못함' };
  const manuscript = typeof raw.manuscript_md === 'string' ? raw.manuscript_md.trim() : '';
  if (manuscript.length < 200) return { candidate: null, reason: 'manuscript_md가 없거나 너무 짧음' };
  if (REFUSAL_PATTERNS.test(manuscript.slice(0, 300))) return { candidate: null, reason: '거절/메타 응답으로 판정' };
  if (!/[가-힣]/.test(manuscript)) return { candidate: null, reason: '한국어 본문이 아님' };
  if (baseManuscript.trim() && manuscript === baseManuscript.trim()) return { candidate: null, reason: '기존 원고와 동일' };
  const coverage = Array.isArray(raw.scene_coverage)
    ? (raw.scene_coverage as Record<string, unknown>[]).map((c) => ({
        scene: safeString(c.scene),
        covered: c.covered !== false,
        note: safeString(c.note)
      }))
    : [];
  const deltas = Array.isArray(raw.canon_delta_candidates)
    ? (raw.canon_delta_candidates as Record<string, unknown>[])
        .map((d) => ({ summary: safeString(d.summary), target_hint: safeString(d.target_hint), risk: safeString(d.risk, 'low') }))
        .filter((d) => d.summary)
    : [];
  const selfCheck = (raw.style_self_check ?? {}) as Record<string, unknown>;
  return {
    candidate: {
      schema_version: 'bindery.draft_candidate.v1',
      episode: safeString(raw.episode, episode),
      manuscript_md: manuscript,
      scene_coverage: coverage,
      canon_delta_candidates: deltas,
      style_self_check: {
        score: typeof selfCheck.score === 'number' ? selfCheck.score : 0,
        notes: safeString(selfCheck.notes)
      },
      change_summary: safeString(raw.change_summary),
      source: 'agent'
    }
  };
}

// ---------------------------------------------------------------------------
// QAReport
// ---------------------------------------------------------------------------
export type QAVerdict = 'pass' | 'warn' | 'fail';
export type QAIssue = { severity: QAVerdict | 'info'; summary: string; evidence: string; location: string; suggestion: string };
export type QAGate = { id: string; score: number; verdict: QAVerdict; issues: QAIssue[] };
export type QAAspect = 'style' | 'continuity' | 'canon';
export type QAReport = {
  schema_version: 'bindery.qa_report.v1';
  aspect: QAAspect;
  episode: string;
  gates: QAGate[];
  overall: { score: number; verdict: QAVerdict; note: string };
  source: 'agent' | 'local' | 'web-import';
  targetLabel: string;
  contentHash: string;
};

function asVerdict(value: unknown, fallback: QAVerdict = 'warn'): QAVerdict {
  return value === 'pass' || value === 'warn' || value === 'fail' ? value : fallback;
}

export function parseQAReport(text: string, aspect: QAAspect, episode: string): Omit<QAReport, 'targetLabel' | 'contentHash'> | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.gates) || raw.gates.length === 0) return null;
  const gates: QAGate[] = [];
  for (const g of raw.gates as Record<string, unknown>[]) {
    const id = safeString(g.id);
    if (!id) continue;
    const issues = Array.isArray(g.issues)
      ? (g.issues as Record<string, unknown>[]).map((i) => ({
          severity: (i.severity === 'info' ? 'info' : asVerdict(i.severity)) as QAIssue['severity'],
          summary: safeString(i.summary),
          evidence: safeString(i.evidence),
          location: safeString(i.location),
          suggestion: safeString(i.suggestion)
        })).filter((i) => i.summary)
      : [];
    // 근거 없는 fail은 warn으로 강등 — 추정만으로 실패 처리하지 않는다.
    for (const issue of issues) {
      if (issue.severity === 'fail' && !issue.evidence) issue.severity = 'warn';
    }
    gates.push({
      id,
      score: typeof g.score === 'number' ? Math.max(0, Math.min(100, g.score)) : 0,
      verdict: asVerdict(g.verdict),
      issues
    });
  }
  if (!gates.length) return null;
  const overall = (raw.overall ?? {}) as Record<string, unknown>;
  return {
    schema_version: 'bindery.qa_report.v1',
    aspect: (safeString(raw.aspect) as QAAspect) || aspect,
    episode: safeString(raw.episode, episode),
    gates,
    overall: {
      score: typeof overall.score === 'number' ? overall.score : Math.round(gates.reduce((s, g) => s + g.score, 0) / gates.length),
      verdict: asVerdict(overall.verdict, gates.some((g) => g.verdict === 'fail') ? 'fail' : gates.some((g) => g.verdict === 'warn') ? 'warn' : 'pass'),
      note: safeString(overall.note)
    },
    source: 'agent'
  };
}

// ---------------------------------------------------------------------------
// RevisionPlan
// ---------------------------------------------------------------------------
export type RevisionItem = { id: string; severity: QAVerdict; instruction: string; target: string; source_gate: string; accepted: boolean };
export type RevisionPlan = {
  schema_version: 'bindery.revision_plan.v1';
  episode: string;
  items: RevisionItem[];
  note: string;
  source: 'agent' | 'local' | 'web-import';
};

export function parseRevisionPlan(text: string, episode: string): RevisionPlan | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.items) || raw.items.length === 0) return null;
  const items: RevisionItem[] = [];
  for (let i = 0; i < (raw.items as unknown[]).length; i++) {
    const item = (raw.items as Record<string, unknown>[])[i];
    const instruction = safeString(item.instruction);
    if (!instruction) continue;
    items.push({
      id: safeString(item.id, `r${i + 1}`),
      severity: asVerdict(item.severity),
      instruction,
      target: safeString(item.target),
      source_gate: safeString(item.source_gate),
      accepted: true
    });
  }
  if (!items.length) return null;
  return { schema_version: 'bindery.revision_plan.v1', episode: safeString(raw.episode, episode), items: items.slice(0, 10), note: safeString(raw.note), source: 'agent' };
}

// ---------------------------------------------------------------------------
// CanonDeltaProposal
// ---------------------------------------------------------------------------
export const CANON_CHANGE_TYPES = ['create', 'update', 'append', 'close_thread', 'add_fact', 'change_status'] as const;
export type CanonChangeType = (typeof CANON_CHANGE_TYPES)[number];
export type CanonChange = {
  target_path: string;
  change_type: CanonChangeType;
  summary: string;
  patch: string;
  risk: 'low' | 'medium' | 'high';
};
export type CanonDeltaProposal = {
  schema_version: 'bindery.canon_delta_proposal.v1';
  episode: string;
  requires_human_approval: true;
  changes: CanonChange[];
};

const CANON_TARGET_PREFIX = /^(canon|characters|relationships|world|plot|status)\//;

export function parseCanonDeltaProposal(text: string, episode: string): CanonDeltaProposal | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || !Array.isArray(raw.changes)) return null;
  const changes: CanonChange[] = [];
  for (const c of raw.changes as Record<string, unknown>[]) {
    const target = safeString(c.target_path);
    const summary = safeString(c.summary);
    const patch = safeString(c.patch);
    const type = safeString(c.change_type) as CanonChangeType;
    if (!target || !summary || !patch || !CANON_CHANGE_TYPES.includes(type)) continue;
    if (!CANON_TARGET_PREFIX.test(target) || target.includes('..')) continue;
    const risk = c.risk === 'high' || c.risk === 'medium' ? c.risk : 'low';
    changes.push({ target_path: target, change_type: type, summary, patch, risk });
  }
  if (!changes.length) return null;
  return { schema_version: 'bindery.canon_delta_proposal.v1', episode: safeString(raw.episode, episode), requires_human_approval: true, changes };
}
