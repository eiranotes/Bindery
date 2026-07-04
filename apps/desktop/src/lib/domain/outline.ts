// 작품 단위 다회차 아웃라인 — 바이블/원천 자료에서 N화 회별 아웃라인을 제안하고,
// 사람이 승인한 row만 플롯 보드로 내려보낸다. 회차 브리프(EpisodeBrief)의 상위 입력.
// 산출/저장: plot/episode-outline.json (사람이 승인 상태를 소유하는 파일)
import type { PlotGrid, PlotRow, Tension } from './plot';

export type OutlineRowStatus = 'draft' | 'approved';

export type EpisodeOutlineRow = {
  episode: string;
  title: string;
  logline: string;
  beats: string[];
  threads: string[];
  risk: string;
  status: OutlineRowStatus;
};

export type EpisodeOutline = {
  schema_version: 'bindery.episode_outline.v1';
  episodeCount: number;
  rows: EpisodeOutlineRow[];
  source: 'agent' | 'local';
  createdAt: string;
  updatedAt: string;
};

export type OutlineInput = {
  episodeCount: number;
  sourceContext: string;
  codexContext: string;
  openThreads: string;
  plotGrid: PlotGrid | null;
  previousOutline?: EpisodeOutline | null;
};

export const OUTLINE_PATH = 'plot/episode-outline.json';

export function episodeIdFor(index: number): string {
  return `ep${String(index + 1).padStart(3, '0')}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function clampLine(text: string, max = 200): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}...` : one;
}

function openThreadIds(openThreads: string): string[] {
  return openThreads
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => clampLine(line, 60))
    .slice(0, 8);
}

/** 로컬 fallback — 기존 플롯 보드 row와 열린 떡밥으로 뼈대 아웃라인을 만든다.
 *  근거가 없으면 그렇다고 risk에 정직하게 남긴다. */
export function buildLocalOutline(input: OutlineInput): EpisodeOutline {
  const count = Math.max(1, Math.min(60, input.episodeCount || 8));
  const threads = openThreadIds(input.openThreads);
  const byEpisode = new Map<string, PlotRow[]>();
  for (const row of input.plotGrid?.rows ?? []) {
    const list = byEpisode.get(row.episode) ?? [];
    list.push(row);
    byEpisode.set(row.episode, list);
  }
  const sourceDigest = clampLine(input.sourceContext, 160);
  const rows: EpisodeOutlineRow[] = [];
  for (let i = 0; i < count; i++) {
    const episode = episodeIdFor(i);
    const existing = byEpisode.get(episode) ?? [];
    const prevRow = input.previousOutline?.rows.find((r) => r.episode === episode);
    if (prevRow) {
      rows.push({ ...prevRow });
      continue;
    }
    if (existing.length) {
      rows.push({
        episode,
        title: existing[0].title || episode,
        logline: `${existing.map((r) => r.title).join(' -> ')} 흐름으로 플롯을 전진시킨다.`,
        beats: existing.map((r) => r.title).slice(0, 5),
        threads: threads.slice(0, 2),
        risk: '',
        status: 'draft'
      });
      continue;
    }
    rows.push({
      episode,
      title: `${episode} (제목 미정)`,
      logline: sourceDigest
        ? `원천 자료의 중심 갈등을 ${i + 1}단계로 전개한다: ${sourceDigest}`
        : '이 회차의 중심 갈등과 훅을 사람이 확정해야 한다.',
      beats: [],
      threads: threads.length ? [threads[i % threads.length]] : [],
      risk: 'AI/원천 근거 없이 만들어진 뼈대 row입니다. 내용을 채우거나 AI 제안으로 대체하세요.',
      status: 'draft'
    });
  }
  return {
    schema_version: 'bindery.episode_outline.v1',
    episodeCount: count,
    rows,
    source: 'local',
    createdAt: input.previousOutline?.createdAt ?? nowIso(),
    updatedAt: nowIso()
  };
}

export function outlinePrompt(input: OutlineInput): string {
  const count = Math.max(1, Math.min(60, input.episodeCount || 8));
  const existingRows = (input.plotGrid?.rows ?? [])
    .map((row) => `- ${row.episode} · ${row.scene} · ${row.title} · tension=${row.tension}`)
    .join('\n');
  return [
    '너는 한국어 장기 연재소설의 스토리 아키텍트다. 원고를 쓰지 말고 회별 아웃라인 JSON만 만든다.',
    `바이블/원천 자료를 근거로 총 ${count}화의 회별 아웃라인을 제안하라.`,
    '각 회차는 반드시: 그 회차만의 목적(logline), 반드시 일어나야 할 beat 2~5개, 건드리는 떡밥, 위험(근거 부족·설정 충돌 가능성)을 가진다.',
    '전체 흐름은 기승전결과 중간 훅 배치를 고려하고, 원천 자료에 없는 대형 설정은 새로 확정하지 말고 risk에 제안으로 표시한다.',
    '반드시 JSON object만 출력한다. 마크다운 설명을 붙이지 않는다.',
    '',
    '## JSON schema',
    `{ "schema_version": "bindery.episode_outline.v1", "episodeCount": ${count}, "rows": [ { "episode": "ep001", "title": "...", "logline": "...", "beats": ["..."], "threads": ["..."], "risk": "" } ] }`,
    '',
    '## Project Source Documents (바이블·원천·인물·조직)',
    input.sourceContext.trim() || '(읽을 원천 문서 없음 — 이 경우 위험을 명시하고 보수적으로 제안하라)',
    '',
    '## Codex Items',
    input.codexContext.trim() || '(설정 항목 없음)',
    '',
    '## Open Threads',
    input.openThreads.trim() || '(없음)',
    '',
    '## 기존 플롯 보드 row (있으면 존중하고 이어서 제안)',
    existingRows || '(없음)'
  ].join('\n');
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* fenced/embedded */
  }
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) {
    try {
      return JSON.parse(fenced[1]);
    } catch {
      /* fall through */
    }
  }
  const first = trimmed.indexOf('{');
  const last = trimmed.lastIndexOf('}');
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(trimmed.slice(first, last + 1));
    } catch {
      return null;
    }
  }
  return null;
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).trim()).filter(Boolean);
}

/** 에이전트 출력 검증 — rows가 비거나 logline이 없는 아웃라인은 채택하지 않는다. */
export function parseEpisodeOutline(text: string, requestedCount: number): EpisodeOutline | null {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  if (!Array.isArray(data.rows) || data.rows.length === 0) return null;
  const rows: EpisodeOutlineRow[] = [];
  for (let i = 0; i < data.rows.length; i++) {
    const item = data.rows[i] as Record<string, unknown>;
    const episode = /^ep\d{3}$/.test(safeString(item.episode)) ? safeString(item.episode) : episodeIdFor(i);
    const logline = safeString(item.logline);
    if (!logline || logline.length < 8) continue;
    rows.push({
      episode,
      title: safeString(item.title, `${episode} (제목 미정)`),
      logline,
      beats: safeStringArray(item.beats).slice(0, 6),
      threads: safeStringArray(item.threads).slice(0, 6),
      risk: safeString(item.risk),
      status: 'draft'
    });
  }
  if (rows.length < Math.min(2, requestedCount)) return null;
  return {
    schema_version: 'bindery.episode_outline.v1',
    episodeCount: rows.length,
    rows,
    source: 'agent',
    createdAt: nowIso(),
    updatedAt: nowIso()
  };
}

export function parseStoredOutline(raw: string): EpisodeOutline | null {
  try {
    const parsed = JSON.parse(raw) as EpisodeOutline;
    if (parsed?.schema_version !== 'bindery.episode_outline.v1' || !Array.isArray(parsed.rows)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function renderOutlineArtifact(outline: EpisodeOutline): string {
  const approved = outline.rows.filter((row) => row.status === 'approved').length;
  return [
    `# 작품 아웃라인 (${outline.rows.length}화 · 승인 ${approved})`,
    '',
    `- source: ${outline.source}`,
    `- updatedAt: ${outline.updatedAt}`,
    '',
    '| 회차 | 제목 | 로그라인 | beats | 떡밥 | 리스크 | 상태 |',
    '|---|---|---|---|---|---|---|',
    ...outline.rows.map((row) =>
      `| ${row.episode} | ${row.title} | ${row.logline} | ${row.beats.join(' / ') || '-'} | ${row.threads.join(', ') || '-'} | ${row.risk || '-'} | ${row.status === 'approved' ? '승인' : '검토 필요'} |`
    )
  ].join('\n');
}

function outlineTension(index: number, total: number): Tension {
  if (total <= 1) return 'mid';
  const ratio = index / (total - 1);
  if (ratio > 0.7) return 'high';
  if (ratio < 0.25) return 'low';
  return 'mid';
}

/** 승인된 아웃라인 row를 플롯 보드에 반영한다.
 *  이미 그 회차 row가 있는 경우 건드리지 않는다(사람이 만든 보드가 진실). */
export function applyOutlineToPlotGrid(outline: EpisodeOutline, grid: PlotGrid | null): { grid: PlotGrid; added: number } {
  const base: PlotGrid = grid && grid.plotlines?.length
    ? { plotlines: grid.plotlines, rows: [...grid.rows] }
    : { plotlines: [{ id: 'main', label: '주 플롯', color: '#315e63' }], rows: [...(grid?.rows ?? [])] };
  const mainId = base.plotlines[0].id;
  const existingEpisodes = new Set(base.rows.map((row) => row.episode));
  let added = 0;
  const approvedRows = outline.rows.filter((row) => row.status === 'approved');
  for (let i = 0; i < approvedRows.length; i++) {
    const row = approvedRows[i];
    if (existingEpisodes.has(row.episode)) continue;
    base.rows.push({
      scene: `${row.episode}-outline`,
      title: row.title,
      episode: row.episode,
      tension: outlineTension(i, approvedRows.length),
      beats: { [mainId]: row.beats.length ? row.beats.join(' / ') : row.logline }
    });
    added += 1;
  }
  base.rows.sort((a, b) => a.episode.localeCompare(b.episode) || a.scene.localeCompare(b.scene));
  return { grid: base, added };
}

/** 특정 회차의 승인 아웃라인 row — 회차 브리프 프롬프트에 주입한다. */
export function outlineRowFor(outline: EpisodeOutline | null, episode: string): EpisodeOutlineRow | null {
  return outline?.rows.find((row) => row.episode === episode) ?? null;
}

export function renderOutlineRowContext(row: EpisodeOutlineRow): string {
  return [
    `- episode: ${row.episode}`,
    `- title: ${row.title}`,
    `- logline: ${row.logline}`,
    `- beats: ${row.beats.join(' / ') || '(없음)'}`,
    `- threads: ${row.threads.join(', ') || '(없음)'}`,
    row.risk ? `- risk: ${row.risk}` : '',
    `- status: ${row.status}`
  ].filter(Boolean).join('\n');
}
