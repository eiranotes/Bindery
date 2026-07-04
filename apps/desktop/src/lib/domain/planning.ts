import { parseFrontmatter } from './frontmatter';
import type { PlotGrid, PlotRow, Tension } from './plot';

export type CharacterStateTarget = {
  character: string;
  from?: string;
  to: string;
};

export type EpisodeBrief = {
  schema_version: 'bindery.episode_brief.v1';
  episode: string;
  logline: string;
  must_hit_beats: string[];
  must_not_happen: string[];
  reader_knowledge_target: string[];
  character_state_targets: CharacterStateTarget[];
  open_threads_to_touch: string[];
  open_threads_to_avoid: string[];
  plot_rows: string[];
  risks: string[];
  source: 'agent' | 'local';
};

export type ScenePlanCard = {
  scene_id: string;
  title: string;
  purpose: string;
  goal: string;
  conflict: string;
  turn: string;
  pov: string;
  entities: string[];
  memory_required: string[];
  target_length: number;
  tension: Tension;
  exit_hook: string;
  beats: string[];
};

export type ScenePlan = {
  schema_version: 'bindery.scene_plan.v1';
  episode: string;
  scenes: ScenePlanCard[];
  source: 'agent' | 'local';
  warnings: string[];
};

type PlanningInput = {
  episode: string;
  manuscript: string;
  plotGrid: PlotGrid | null;
  openThreads: string;
  previousSummary?: string;
  lengthTarget?: number;
};

function bodyText(manuscript: string): string {
  const fm = parseFrontmatter(manuscript);
  return fm.present ? manuscript.slice(fm.end).trim() : manuscript.trim();
}

function metadataCharacters(manuscript: string): string[] {
  const fm = parseFrontmatter(manuscript);
  const chars = fm.data.characters;
  return Array.isArray(chars) ? chars.map(String).filter(Boolean) : [];
}

function clampLine(text: string, max = 180): string {
  const one = text.replace(/\s+/g, ' ').trim();
  return one.length > max ? `${one.slice(0, max)}...` : one;
}

function openThreadLines(openThreads: string): string[] {
  return openThreads
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter((line) => line && !line.startsWith('#'))
    .slice(0, 8);
}

function rowsForEpisode(grid: PlotGrid | null, episode: string): PlotRow[] {
  if (!grid) return [];
  return grid.rows.filter((row) => row.episode === episode);
}

function beatLines(row: PlotRow, grid: PlotGrid): string[] {
  return grid.plotlines
    .map((plotline) => {
      const beat = row.beats[plotline.id]?.trim();
      return beat ? `${plotline.label}: ${beat}` : '';
    })
    .filter(Boolean);
}

function plotlineIdsToTouch(rows: PlotRow[]): string[] {
  const ids = new Set<string>();
  for (const row of rows) {
    for (const [id, beat] of Object.entries(row.beats)) {
      if (beat?.trim()) ids.add(id);
    }
  }
  return [...ids];
}

function firstParagraphs(manuscript: string, count: number): string[] {
  return bodyText(manuscript)
    .split(/\n{2,}/)
    .map((p) => clampLine(p, 140))
    .filter(Boolean)
    .slice(0, count);
}

function tensionConflict(tension: Tension): string {
  if (tension === 'high') return '압박이 즉시 커지고 선택의 비용이 드러난다.';
  if (tension === 'mid') return '정보와 감정이 어긋나며 장면 안에서 입장이 흔들린다.';
  return '낮은 압력 속에서 다음 갈등의 단서가 조용히 배치된다.';
}

function sceneTargetLength(total: number | undefined, count: number, tension: Tension): number {
  if (total && total > 0) {
    const weight = tension === 'high' ? 1.2 : tension === 'low' ? 0.85 : 1;
    return Math.max(600, Math.round((total / Math.max(1, count)) * weight));
  }
  return tension === 'high' ? 2200 : tension === 'mid' ? 1800 : 1400;
}

export function buildLocalEpisodeBrief(input: PlanningInput): EpisodeBrief {
  const rows = rowsForEpisode(input.plotGrid, input.episode);
  const rowLabels = rows.map((row) => `${row.scene}: ${row.title}`);
  const plotBeats =
    input.plotGrid && rows.length
      ? rows.flatMap((row) => beatLines(row, input.plotGrid as PlotGrid)).slice(0, 10)
      : [];
  const threads = openThreadLines(input.openThreads);
  const characters = metadataCharacters(input.manuscript);
  const lead = firstParagraphs(input.manuscript, 1)[0];
  const hitBeats = plotBeats.length
    ? plotBeats
    : lead
      ? [`현재 원고의 핵심 상황을 다음 결정으로 전진시킨다: ${lead}`]
      : ['이번 회차의 중심 갈등, 선택, 다음 훅을 명확히 만든다.'];

  return {
    schema_version: 'bindery.episode_brief.v1',
    episode: input.episode,
    logline: rows.length
      ? `${input.episode}은 ${rows.map((row) => row.title).join(' -> ')} 흐름으로 플롯 beat를 전진시킨다.`
      : `${input.episode}은 현재 원고 상태를 기준으로 중심 갈등을 정리하고 다음 장면의 목표를 고정한다.`,
    must_hit_beats: hitBeats,
    must_not_happen: ['확정되지 않은 설정 변경을 원고에 단정하지 않는다.', '장기 영향 사건은 brief/scene plan에 없는 경우 새로 확정하지 않는다.'],
    reader_knowledge_target: threads.length ? threads.slice(0, 3) : ['독자가 이번 회차의 선택 비용과 다음 질문을 이해한다.'],
    character_state_targets: characters.slice(0, 4).map((character) => ({
      character,
      from: '현재 원고 상태',
      to: '이번 회차의 선택과 반응이 한 단계 더 구체화됨'
    })),
    open_threads_to_touch: plotlineIdsToTouch(rows).slice(0, 6),
    open_threads_to_avoid: [],
    plot_rows: rowLabels,
    risks: [
      '로컬 브리프는 플롯 보드와 원고 표면 정보만 사용한다.',
      '인물 상태 변화와 숨길 정보는 사용자가 산출물을 검토해 확정해야 한다.'
    ],
    source: 'local'
  };
}

export function buildLocalScenePlan(input: PlanningInput, brief: EpisodeBrief): ScenePlan {
  const rows = rowsForEpisode(input.plotGrid, input.episode);
  const characters = metadataCharacters(input.manuscript);
  const fallbackParas = firstParagraphs(input.manuscript, 3);
  const fallbackSeeds = fallbackParas.length ? fallbackParas : brief.must_hit_beats.slice(0, 3);
  const sceneRows =
    input.plotGrid && rows.length
      ? rows.map((row) => ({ row, beats: beatLines(row, input.plotGrid as PlotGrid) }))
      : fallbackSeeds.map((para, index) => ({
          row: {
            scene: `scene-${String(index + 1).padStart(2, '0')}`,
            title: index === 0 ? '현재 상황 고정' : index === 1 ? '갈등 확장' : '회차 훅',
            episode: input.episode,
            tension: (index === 2 ? 'high' : index === 1 ? 'mid' : 'low') as Tension,
            beats: { main: para || brief.must_hit_beats[index] || '장면 기능 정리' }
          },
          beats: [para || brief.must_hit_beats[index] || '장면 기능 정리']
        }));

  const scenes = sceneRows.map(({ row, beats }, index) => {
    const beatText = beats.join(' / ') || brief.must_hit_beats[index] || row.title;
    const entityTargets = [
      ...new Set([
        ...characters,
        ...brief.character_state_targets.map((target) => target.character)
      ])
    ].slice(0, 6);
    return {
      scene_id: row.scene || `scene-${String(index + 1).padStart(2, '0')}`,
      title: row.title || `장면 ${index + 1}`,
      purpose: beatText,
      goal: `${row.title || `장면 ${index + 1}`}에서 ${beatText}를 원고 사건으로 보여준다.`,
      conflict: tensionConflict(row.tension),
      turn: row.tension === 'high' ? '끝에서 새 위험 또는 숨긴 정보의 그림자를 남긴다.' : '장면 끝에서 다음 선택지를 좁힌다.',
      pov: '현재 원고의 화자/시점을 유지',
      entities: entityTargets,
      memory_required: [`episode-brief:${brief.episode}`, ...brief.open_threads_to_touch.slice(0, 4)],
      target_length: sceneTargetLength(input.lengthTarget, sceneRows.length, row.tension),
      tension: row.tension,
      exit_hook: row.tension === 'high' ? '독자가 다음 장면을 확인해야 하는 질문을 남긴다.' : '다음 장면의 정보 결핍을 남긴다.',
      beats
    };
  });

  return {
    schema_version: 'bindery.scene_plan.v1',
    episode: input.episode,
    scenes,
    source: 'local',
    warnings: scenes.length ? [] : ['원고와 플롯 보드에서 장면 후보를 찾지 못했습니다.']
  };
}

function safeString(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function safeStringArray(value: unknown, fallback: string[]): string[] {
  if (!Array.isArray(value)) return fallback;
  const out = value.map((item) => String(item).trim()).filter(Boolean);
  return out.length ? out : fallback;
}

function safeSource(value: unknown, fallback: 'agent' | 'local' = 'agent'): 'agent' | 'local' {
  return value === 'local' || value === 'agent' ? value : fallback;
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    /* try fenced or embedded object */
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

export function parseEpisodeBrief(text: string, fallback: EpisodeBrief): EpisodeBrief | null {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  return {
    ...fallback,
    episode: safeString(data.episode, fallback.episode),
    logline: safeString(data.logline, fallback.logline),
    must_hit_beats: safeStringArray(data.must_hit_beats, fallback.must_hit_beats),
    must_not_happen: safeStringArray(data.must_not_happen, fallback.must_not_happen),
    reader_knowledge_target: safeStringArray(data.reader_knowledge_target, fallback.reader_knowledge_target),
    character_state_targets: Array.isArray(data.character_state_targets)
      ? data.character_state_targets
          .map((item) => {
            const target = item as Record<string, unknown>;
            return {
              character: safeString(target.character),
              from: safeString(target.from),
              to: safeString(target.to, '이번 회차에서 상태가 구체화됨')
            };
          })
          .filter((item) => item.character)
      : fallback.character_state_targets,
    open_threads_to_touch: safeStringArray(data.open_threads_to_touch, fallback.open_threads_to_touch),
    open_threads_to_avoid: safeStringArray(data.open_threads_to_avoid, fallback.open_threads_to_avoid),
    plot_rows: safeStringArray(data.plot_rows, fallback.plot_rows),
    risks: safeStringArray(data.risks, fallback.risks),
    source: safeSource(data.source, 'agent')
  };
}

export function parseScenePlan(text: string, fallback: ScenePlan): ScenePlan | null {
  const raw = extractJsonObject(text);
  if (!raw || typeof raw !== 'object') return null;
  const data = raw as Record<string, unknown>;
  const scenes = Array.isArray(data.scenes)
    ? data.scenes
        .map((item, index) => {
          const scene = item as Record<string, unknown>;
          const base = fallback.scenes[index] ?? fallback.scenes[0];
          if (!base) return null;
          const tension = safeString(scene.tension, base.tension) as Tension;
          return {
            ...base,
            scene_id: safeString(scene.scene_id, base.scene_id),
            title: safeString(scene.title, base.title),
            purpose: safeString(scene.purpose, base.purpose),
            goal: safeString(scene.goal, base.goal),
            conflict: safeString(scene.conflict, base.conflict),
            turn: safeString(scene.turn, base.turn),
            pov: safeString(scene.pov, base.pov),
            entities: safeStringArray(scene.entities, base.entities),
            memory_required: safeStringArray(scene.memory_required, base.memory_required),
            target_length: Number(scene.target_length) > 0 ? Number(scene.target_length) : base.target_length,
            tension: ['low', 'mid', 'high'].includes(tension) ? tension : base.tension,
            exit_hook: safeString(scene.exit_hook, base.exit_hook),
            beats: safeStringArray(scene.beats, base.beats)
          };
        })
        .filter((scene): scene is ScenePlanCard => Boolean(scene))
    : fallback.scenes;
  if (!scenes.length) return null;
  return {
    ...fallback,
    episode: safeString(data.episode, fallback.episode),
    scenes,
    source: safeSource(data.source, 'agent'),
    warnings: safeStringArray(data.warnings, fallback.warnings)
  };
}

function jsonBlock(label: string, payload: unknown): string {
  return [`<!-- bindery:${label}-json`, JSON.stringify(payload, null, 2), '-->'].join('\n');
}

export function renderEpisodeBriefArtifact(brief: EpisodeBrief): string {
  return [
    `# Episode Brief: ${brief.episode}`,
    '',
    jsonBlock('episode-brief', brief),
    '',
    `- source: ${brief.source}`,
    `- logline: ${brief.logline}`,
    '',
    '## Must Hit Beats',
    ...brief.must_hit_beats.map((beat) => `- ${beat}`),
    '',
    '## Must Not Happen',
    ...brief.must_not_happen.map((item) => `- ${item}`),
    '',
    '## Reader Knowledge Target',
    ...brief.reader_knowledge_target.map((item) => `- ${item}`),
    '',
    '## Character State Targets',
    ...(brief.character_state_targets.length
      ? brief.character_state_targets.map((target) => `- ${target.character}: ${target.from ? `${target.from} -> ` : ''}${target.to}`)
      : ['- (없음)']),
    '',
    '## Open Threads',
    `- touch: ${brief.open_threads_to_touch.length ? brief.open_threads_to_touch.join(', ') : '(없음)'}`,
    `- avoid: ${brief.open_threads_to_avoid.length ? brief.open_threads_to_avoid.join(', ') : '(없음)'}`,
    '',
    '## Risks',
    ...brief.risks.map((risk) => `- ${risk}`)
  ].join('\n');
}

export function renderScenePlanArtifact(plan: ScenePlan): string {
  return [
    `# Scene Plan: ${plan.episode}`,
    '',
    jsonBlock('scene-plan', plan),
    '',
    `- source: ${plan.source}`,
    `- scenes: ${plan.scenes.length}`,
    '',
    '## Scene Cards',
    ...plan.scenes.flatMap((scene, index) => [
      '',
      `### ${index + 1}. ${scene.title} (${scene.scene_id})`,
      `- purpose: ${scene.purpose}`,
      `- goal: ${scene.goal}`,
      `- conflict: ${scene.conflict}`,
      `- turn: ${scene.turn}`,
      `- pov: ${scene.pov}`,
      `- target_length: ${scene.target_length}`,
      `- tension: ${scene.tension}`,
      `- entities: ${scene.entities.length ? scene.entities.join(', ') : '(없음)'}`,
      `- memory_required: ${scene.memory_required.length ? scene.memory_required.join(', ') : '(없음)'}`,
      `- exit_hook: ${scene.exit_hook}`,
      `- beats: ${scene.beats.length ? scene.beats.join(' / ') : '(없음)'}`
    ]),
    '',
    '## Warnings',
    ...(plan.warnings.length ? plan.warnings.map((warning) => `- ${warning}`) : ['- (없음)'])
  ].join('\n');
}

export function episodeBriefPrompt(input: PlanningInput): string {
  const rows = rowsForEpisode(input.plotGrid, input.episode);
  const plotLines = input.plotGrid
    ? rows.length
      ? rows.map((row) => `- ${row.scene} · ${row.title} · tension=${row.tension} · ${beatLines(row, input.plotGrid as PlotGrid).join(' / ') || 'beat 없음'}`).join('\n')
      : '(현재 회차 plot board row 없음)'
    : '(plot board 없음)';
  return [
    '너는 한국어 장기 연재소설의 스토리 에디터다. 초안을 쓰지 말고 이번 회차의 EpisodeBrief JSON만 만든다.',
    'Plan-And-Write 원칙: 이번 출력은 이후 초안 후보가 반드시 따라야 할 회차 계획이다.',
    '반드시 JSON object만 출력한다. 마크다운 설명을 붙이지 않는다.',
    '',
    '## JSON schema',
    '{ "schema_version": "bindery.episode_brief.v1", "episode": "ep001", "logline": "...", "must_hit_beats": ["..."], "must_not_happen": ["..."], "reader_knowledge_target": ["..."], "character_state_targets": [ { "character": "...", "from": "...", "to": "..." } ], "open_threads_to_touch": ["..."], "open_threads_to_avoid": ["..."], "plot_rows": ["scene-01: title"], "risks": ["..."] }',
    '',
    `## Episode`,
    input.episode,
    '',
    '## Plot Board Rows',
    plotLines,
    '',
    '## Open Threads',
    input.openThreads.trim() || '(없음)',
    '',
    '## Previous Summary',
    input.previousSummary?.trim() || '(없음)',
    '',
    '## Current Manuscript Excerpt',
    bodyText(input.manuscript).slice(0, 9000) || '(빈 원고)'
  ].join('\n');
}

export function scenePlanPrompt(input: PlanningInput, brief: EpisodeBrief): string {
  const rows = rowsForEpisode(input.plotGrid, input.episode);
  const plotLines = input.plotGrid
    ? rows.length
      ? rows.map((row) => `- ${row.scene} · ${row.title} · tension=${row.tension} · ${beatLines(row, input.plotGrid as PlotGrid).join(' / ') || 'beat 없음'}`).join('\n')
      : '(현재 회차 plot board row 없음)'
    : '(plot board 없음)';
  return [
    '너는 한국어 장기 연재소설의 장면 설계자다. 초안을 쓰지 말고 ScenePlan JSON만 만든다.',
    'EpisodeBrief의 must_hit_beats/must_not_happen을 장면 카드로 분해한다.',
    '반드시 JSON object만 출력한다. 마크다운 설명을 붙이지 않는다.',
    '',
    '## JSON schema',
    '{ "schema_version": "bindery.scene_plan.v1", "episode": "ep001", "scenes": [ { "scene_id": "scene-01", "title": "...", "purpose": "...", "goal": "...", "conflict": "...", "turn": "...", "pov": "...", "entities": ["..."], "memory_required": ["..."], "target_length": 1800, "tension": "low|mid|high", "exit_hook": "...", "beats": ["..."] } ], "warnings": ["..."] }',
    '',
    '## EpisodeBrief JSON',
    JSON.stringify(brief, null, 2),
    '',
    '## Plot Board Rows',
    plotLines,
    '',
    '## Current Manuscript Excerpt',
    bodyText(input.manuscript).slice(0, 9000) || '(빈 원고)'
  ].join('\n');
}
