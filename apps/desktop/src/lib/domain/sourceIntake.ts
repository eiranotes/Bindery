import type { PlotGrid, Tension } from './plot';

export type SourceIntakeBucket = 'characters' | 'world' | 'plot' | 'threads' | 'style' | 'raw';

export type SourceIntakeCharacter = {
  id: string;
  name: string;
  role: string;
  notes: string[];
};

export type SourceIntakeBeat = {
  id: string;
  title: string;
  summary: string;
  tension: Tension;
};

export type SourceIntakeOrganization = {
  id: string;
  name: string;
  kind: string;
  notes: string[];
};

export type SourceIntakeResult = {
  schema_version: 'bindery.source_intake.v1';
  source: 'local' | 'agent';
  title: string;
  sourceFileName?: string;
  sourceStats: {
    chars: number;
    lines: number;
    paragraphs: number;
  };
  premise: string;
  logline: string;
  worldRules: string[];
  characters: SourceIntakeCharacter[];
  organizations: SourceIntakeOrganization[];
  plotBeats: SourceIntakeBeat[];
  openThreads: string[];
  styleNotes: string[];
  sourceDigest: string[];
  plotGrid: PlotGrid;
};

export type SourceIntakeInput = {
  title: string;
  sourceText: string;
  sourceFileName?: string;
};

export type SourceIntakeFile = {
  path: string;
  content: string;
};

const BUCKET_PATTERNS: Record<Exclude<SourceIntakeBucket, 'raw'>, RegExp[]> = {
  characters: [/등장\s*인물/, /인물/, /캐릭터/, /character/i, /cast/i],
  world: [/세계관/, /설정/, /배경/, /규칙/, /장소/, /world/i, /canon/i, /setting/i],
  plot: [/플롯/, /줄거리/, /시놉/, /스토리/, /전개/, /에피소드/, /episode/i, /plot/i, /outline/i],
  threads: [/떡밥/, /복선/, /미스터리/, /질문/, /열린\s*문제/, /thread/i, /mystery/i],
  style: [/문체/, /톤/, /분위기/, /시점/, /스타일/, /style/i, /tone/i, /pov/i, /voice/i]
};

const DEFAULT_PREMISE = '원천 문서에서 핵심 전제를 아직 확정하지 않았습니다.';

function cleanLine(line: string): string {
  return line
    .replace(/^\s*(#{1,6}\s*)?/, '')
    .replace(/^\s*(?:[-*+]|[0-9]+[.)]|[ㄱ-ㅎ가-힣]\)|•)\s*/, '')
    .trim();
}

function cleanItem(line: string): string {
  return cleanLine(line)
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function unique(items: string[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items.map(cleanItem).filter(Boolean)) {
    const key = item.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

function bucketForKey(key: string): Exclude<SourceIntakeBucket, 'raw'> | null {
  const normalized = cleanItem(key).replace(/[:：]$/, '');
  for (const [bucket, patterns] of Object.entries(BUCKET_PATTERNS) as Array<[Exclude<SourceIntakeBucket, 'raw'>, RegExp[]]>) {
    if (patterns.some((pattern) => pattern.test(normalized))) return bucket;
  }
  return null;
}

function classifySource(raw: string): Record<SourceIntakeBucket, string[]> {
  const buckets: Record<SourceIntakeBucket, string[]> = {
    characters: [],
    world: [],
    plot: [],
    threads: [],
    style: [],
    raw: []
  };
  let current: SourceIntakeBucket = 'raw';

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const keyValue = trimmed.match(/^\s*(?:#{1,6}\s*)?(.{1,28}?)[：:]\s*(.+)$/);
    if (keyValue) {
      const bucket = bucketForKey(keyValue[1]);
      if (bucket) {
        current = bucket;
        buckets[bucket].push(keyValue[2]);
        continue;
      }
    }

    const heading = trimmed.match(/^\s*(?:#{1,6}\s*)?(.{1,28}?)(?:[：:]|\s*)$/);
    const headingBucket = heading ? bucketForKey(heading[1]) : null;
    if (headingBucket && cleanItem(trimmed).length <= 32) {
      current = headingBucket;
      continue;
    }

    buckets[current].push(trimmed);

    if (current === 'raw') {
      if (/[?？]|비밀|떡밥|복선|미정|정체|의문|회수/.test(trimmed)) buckets.threads.push(trimmed);
      if (/문체|분위기|톤|시점|대화|서술|스타일/.test(trimmed)) buckets.style.push(trimmed);
      if (/세계|왕국|도시|길드|마법|능력|규칙|금지|법|배경|설정/.test(trimmed)) buckets.world.push(trimmed);
    }
  }

  return buckets;
}

function paragraphs(raw: string): string[] {
  return raw
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
}

function titleFromBeat(line: string, index: number): string {
  const item = cleanItem(line).replace(/^(?:ep|episode|에피소드|회차)\s*[0-9]+[：:\s-]*/i, '');
  const [head] = item.split(/[.。?!？！]/);
  const title = head.trim().slice(0, 34);
  return title || `장면 씨앗 ${String(index + 1).padStart(2, '0')}`;
}

function tensionFor(line: string, index: number): Tension {
  if (/위기|전투|폭로|배신|결전|추격|죽음|붕괴|파국|절정|!/.test(line)) return 'high';
  if (/갈등|비밀|결정|대립|선택|거절|고백|단서|의심/.test(line)) return 'mid';
  if (index >= 2) return 'mid';
  return 'low';
}

function extractPremise(rawParagraphs: string[], buckets: Record<SourceIntakeBucket, string[]>): string {
  const candidates = [...buckets.raw, ...rawParagraphs, ...buckets.plot, ...buckets.world];
  const found = candidates.map(cleanItem).find((line) => line.length >= 18);
  return found?.replace(/^(핵심|전제|로그라인|premise|logline)[：:]\s*/i, '') ?? DEFAULT_PREMISE;
}

function extractWorldRules(buckets: Record<SourceIntakeBucket, string[]>): string[] {
  const world = unique(buckets.world, 10);
  if (world.length) return world;
  return ['확정된 세계 규칙은 집필 전에 추가 확인이 필요합니다.'];
}

function slugFor(value: string, fallback: string): string {
  const slug = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  return slug || fallback;
}

function safeId(value: unknown, fallback: string): string {
  return slugFor(typeof value === 'string' ? value : '', fallback);
}

function roleFor(line: string): string {
  if (/주인공|protagonist/i.test(line)) return '주인공';
  if (/악역|antagonist|빌런/i.test(line)) return '대립축';
  if (/조력자|동료|파트너|ally/i.test(line)) return '조력자';
  if (/라이벌|rival/i.test(line)) return '라이벌';
  if (/스승|mentor/i.test(line)) return '멘토';
  return '미정';
}

function parseCharacterLine(line: string, index: number): SourceIntakeCharacter | null {
  const item = cleanItem(line);
  if (!item || item.length > 180) return null;
  const match = item.match(/^([^:：\-–—()（）,\s]{1,28}(?:\s+[^:：\-–—()（）,\s]{1,12})?)(?:\s*[:：\-–—]\s*(.+))?$/);
  if (!match) return null;
  const name = match[1].trim();
  const note = (match[2] ?? item).trim();
  if (!name || /설정|세계관|플롯|줄거리|문체/.test(name)) return null;
  return {
    id: slugFor(name, `character-${String(index + 1).padStart(2, '0')}`),
    name,
    role: roleFor(item),
    notes: unique([note], 4)
  };
}

function extractCharacters(buckets: Record<SourceIntakeBucket, string[]>): SourceIntakeCharacter[] {
  const raw = buckets.characters.length ? buckets.characters : buckets.raw.filter((line) => /주인공|인물|캐릭터|동료|악역|라이벌/.test(line));
  const out: SourceIntakeCharacter[] = [];
  const seen = new Set<string>();
  raw.slice(0, 18).forEach((line, index) => {
    const parsed = parseCharacterLine(line, index);
    if (!parsed || seen.has(parsed.id)) return;
    seen.add(parsed.id);
    out.push(parsed);
  });
  if (out.length) return out.slice(0, 10);
  return [{ id: 'cast-inbox', name: '등장인물 미정', role: '미정', notes: ['원천 문서에서 명시 인물을 찾지 못했습니다.'] }];
}

function extractPlotBeats(rawParagraphs: string[], buckets: Record<SourceIntakeBucket, string[]>): SourceIntakeBeat[] {
  const plotLines = unique(
    buckets.plot.length
      ? buckets.plot
      : buckets.raw.filter((line) => /장면|사건|회차|에피소드|전개|시작|중반|후반|결말|->|→/.test(line)),
    8
  );
  const source = plotLines.length ? plotLines : rawParagraphs.slice(0, 5);
  const beats = source.slice(0, 6).map((line, index) => ({
    id: `beat-${String(index + 1).padStart(2, '0')}`,
    title: titleFromBeat(line, index),
    summary: cleanItem(line),
    tension: tensionFor(line, index)
  }));
  if (beats.length) return beats;
  return [
    { id: 'beat-01', title: '첫 장면 씨앗', summary: '주요 인물과 목표를 여는 장면을 확정한다.', tension: 'low' },
    { id: 'beat-02', title: '갈등 표면화', summary: '첫 회차에서 부딪힐 선택이나 질문을 드러낸다.', tension: 'mid' }
  ];
}

function extractThreads(buckets: Record<SourceIntakeBucket, string[]>): string[] {
  const threads = unique([...buckets.threads, ...buckets.raw.filter((line) => /[?？]|비밀|떡밥|복선|미정|정체|의문|회수/.test(line))], 10);
  if (threads.length) return threads;
  return ['첫 회차 끝에서 독자가 다음 장면을 궁금해할 질문을 확정합니다.'];
}

function extractStyleNotes(buckets: Record<SourceIntakeBucket, string[]>): string[] {
  const notes = unique([...buckets.style, ...buckets.raw.filter((line) => /문체|분위기|톤|시점|대화|서술|스타일/.test(line))], 8);
  if (notes.length) return notes;
  return ['문체/시점/톤은 아직 분리되지 않았습니다. 문체 시스템에서 샘플 분석으로 보강하세요.'];
}

function stringProp(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? cleanItem(value) : fallback;
}

function stringArray(value: unknown, limit = 12): string[] {
  if (!Array.isArray(value)) return [];
  return unique(value.filter((item): item is string => typeof item === 'string'), limit);
}

function objectArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item));
}

function normalizeTension(value: unknown, line = '', index = 0): Tension {
  if (value === 'low' || value === 'mid' || value === 'high') return value;
  return tensionFor(line, index);
}

function extractJsonObject(text: string): unknown | null {
  const trimmed = text.trim().replace(/^codex\s*/i, '').trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1]?.trim();
  const candidates = [fenced, trimmed, trimmed.slice(trimmed.indexOf('{'), trimmed.lastIndexOf('}') + 1)].filter(Boolean) as string[];
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function normalizeCharacters(value: unknown, fallback: SourceIntakeCharacter[]): SourceIntakeCharacter[] {
  const out: SourceIntakeCharacter[] = [];
  const seen = new Set<string>();
  objectArray(value).forEach((item, index) => {
    const name = stringProp(item.name);
    if (!name || /^\d+$/.test(name) || /^(이름|나이|성격|말투|특징|외양)$/.test(name)) return;
    const id = safeId(item.id || name, `character-${String(index + 1).padStart(2, '0')}`);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name,
      role: stringProp(item.role, '미정'),
      notes: stringArray(item.notes, 10)
    });
  });
  return out.length ? out.slice(0, 24) : fallback;
}

function normalizeOrganizations(value: unknown): SourceIntakeOrganization[] {
  const out: SourceIntakeOrganization[] = [];
  const seen = new Set<string>();
  objectArray(value).forEach((item, index) => {
    const name = stringProp(item.name);
    if (!name || /^\d+$/.test(name)) return;
    const id = safeId(item.id || name, `organization-${String(index + 1).padStart(2, '0')}`);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      name,
      kind: stringProp(item.kind, '조직/세력'),
      notes: stringArray(item.notes, 8)
    });
  });
  return out.slice(0, 20);
}

function normalizePlotBeats(value: unknown, fallback: SourceIntakeBeat[]): SourceIntakeBeat[] {
  const out: SourceIntakeBeat[] = [];
  const seen = new Set<string>();
  objectArray(value).forEach((item, index) => {
    const summary = stringProp(item.summary);
    const title = stringProp(item.title, titleFromBeat(summary, index));
    if (!summary || !title || /^(MEDALLION|세계관 통합 설정 바이블|ver\s)/i.test(title)) return;
    const id = safeId(item.id || title, `beat-${String(index + 1).padStart(2, '0')}`);
    if (seen.has(id)) return;
    seen.add(id);
    out.push({
      id,
      title,
      summary,
      tension: normalizeTension(item.tension, `${title} ${summary}`, index)
    });
  });
  return out.length ? out.slice(0, 24) : fallback;
}

function makeSourceDigest(result: SourceIntakeResult): string[] {
  return unique(
    [
      result.premise,
      ...result.worldRules.slice(0, 4),
      ...result.characters.slice(0, 4).map((character) => `${character.name}: ${character.role}`),
      ...result.plotBeats.slice(0, 4).map((beat) => `${beat.title}: ${beat.summary}`)
    ],
    12
  );
}

function buildPlotGrid(beats: SourceIntakeBeat[]): PlotGrid {
  return {
    plotlines: [{ id: 'main', label: '주 플롯', color: '#315e63' }],
    rows: beats.map((beat, index) => ({
      scene: `scene-${String(index + 1).padStart(2, '0')}`,
      title: beat.title,
      episode: 'ep001',
      tension: beat.tension,
      beats: { main: beat.summary }
    }))
  };
}

export function buildSourceIntake(input: SourceIntakeInput): SourceIntakeResult {
  const sourceText = input.sourceText.trim();
  const rawParagraphs = paragraphs(sourceText);
  const buckets = classifySource(sourceText);
  const premise = extractPremise(rawParagraphs, buckets);
  const characters = extractCharacters(buckets);
  const plotBeats = extractPlotBeats(rawParagraphs, buckets);
  const openThreads = extractThreads(buckets);
  const styleNotes = extractStyleNotes(buckets);
  const worldRules = extractWorldRules(buckets);
  const sourceDigest = unique([...buckets.raw, ...buckets.plot, ...buckets.world], 10);

  return {
    schema_version: 'bindery.source_intake.v1',
    source: 'local',
    title: input.title.trim() || '새 작품',
    sourceFileName: input.sourceFileName,
    sourceStats: {
      chars: sourceText.length,
      lines: sourceText.split(/\r?\n/).length,
      paragraphs: rawParagraphs.length
    },
    premise,
    logline: premise.length > 120 ? `${premise.slice(0, 117).trim()}...` : premise,
    worldRules,
    characters,
    organizations: [],
    plotBeats,
    openThreads,
    styleNotes,
    sourceDigest,
    plotGrid: buildPlotGrid(plotBeats)
  };
}

export function sourceIntakeAgentPrompt(sourceRelativePath: string, local: SourceIntakeResult): string {
  const localHints = {
    title: local.title,
    sourceFileName: local.sourceFileName,
    sourceStats: local.sourceStats,
    localPremise: local.premise,
    localCharacters: local.characters.map((item) => item.name),
    localPlotBeats: local.plotBeats.map((item) => item.title)
  };
  return [
    '너는 장기 연재소설 바이블을 Bindery 하네스 파일로 분해하는 편집자다.',
    `프로젝트 안의 원천 문서 \`${sourceRelativePath}\`를 직접 읽고, 문맥에 따라 설정/인물/조직/플롯/복선/문체를 재구성하라.`,
    '섹션 번호, 필드명(나이/이름/성격/말투), 버전 문자열, 표제어를 인물이나 플롯으로 승격하지 않는다.',
    '문서에 근거한 사실만 사용하고 새 설정이나 산문을 창작하지 않는다.',
    '최종 답변은 JSON object 하나만 출력한다. markdown fence, 설명, 사과 문구를 붙이지 않는다.',
    '',
    'Required shape:',
    JSON.stringify(
      {
        schema_version: 'bindery.source_intake.ai.v1',
        source: 'agent',
        title: '작품 제목',
        premise: '핵심 세계/이야기 전제',
        logline: '한 문단 로그라인',
        worldRules: ['세계 규칙/배경 사실'],
        characters: [{ id: 'slug', name: '인물명', role: '서사 역할', notes: ['근거 메모'] }],
        organizations: [{ id: 'slug', name: '조직/세력명', kind: '유형', notes: ['근거 메모'] }],
        plotBeats: [{ id: 'slug', title: '비트 제목', summary: '비트 요약', tension: 'low' }],
        openThreads: ['미해결 복선/질문'],
        styleNotes: ['시점/말투/장면 구조/집필 가이드'],
        sourceDigest: ['원천 문서 핵심 줄'],
        uncertainties: ['문서가 미확정이라고 밝힌 항목']
      },
      null,
      2
    ),
    '',
    'Local deterministic split is only a weak hint. Correct it when it mistook labels for entities:',
    JSON.stringify(localHints, null, 2)
  ].join('\n');
}

export function parseAgentSourceIntake(text: string, fallback: SourceIntakeResult): SourceIntakeResult | null {
  const parsed = extractJsonObject(text);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const data = parsed as Record<string, unknown>;
  const premise = stringProp(data.premise, fallback.premise);
  const logline = stringProp(data.logline, premise.length > 160 ? `${premise.slice(0, 157).trim()}...` : premise);
  const characters = normalizeCharacters(data.characters, []);
  const plotBeats = normalizePlotBeats(data.plotBeats, []);
  if (premise.length < 18 || characters.length === 0 || plotBeats.length === 0) return null;

  const result: SourceIntakeResult = {
    ...fallback,
    source: 'agent',
    title: stringProp(data.title, fallback.title) || fallback.title,
    premise,
    logline,
    worldRules: stringArray(data.worldRules, 40).length ? stringArray(data.worldRules, 40) : fallback.worldRules,
    characters,
    organizations: normalizeOrganizations(data.organizations),
    plotBeats,
    openThreads: stringArray(data.openThreads, 24).length ? stringArray(data.openThreads, 24) : fallback.openThreads,
    styleNotes: stringArray(data.styleNotes, 24).length ? stringArray(data.styleNotes, 24) : fallback.styleNotes,
    sourceDigest: stringArray(data.sourceDigest, 16),
    plotGrid: buildPlotGrid(plotBeats)
  };
  if (!result.sourceDigest.length) result.sourceDigest = makeSourceDigest(result);
  return result;
}

function markdownList(items: string[], fallback = '미정'): string {
  const clean = items.map(cleanItem).filter(Boolean);
  if (!clean.length) return `- ${fallback}`;
  return clean.map((item) => `- ${item}`).join('\n');
}

function renderSettingBible(result: SourceIntakeResult): string {
  return `# 설정집

> 통합 아이디어/바이블 문서에서 첫 분리한 하네스 기준 문서입니다.

## 핵심 전제

${result.premise}

## 로그라인

${result.logline}

## 세계 규칙과 배경

${markdownList(result.worldRules)}

## 주요 인물

${result.characters.map((character) => `- ${character.name} (${character.role})`).join('\n')}

## 조직과 세력

${result.organizations.length ? result.organizations.map((organization) => `- ${organization.name} (${organization.kind})`).join('\n') : '- 원천 문서에서 별도 조직/세력 항목을 확정하지 않았습니다.'}

## 첫 회차 플롯 씨앗

${result.plotBeats.map((beat) => `- ${beat.title}: ${beat.summary}`).join('\n')}

## 열린 질문

${markdownList(result.openThreads)}
`;
}

function renderOpenThreads(result: SourceIntakeResult): string {
  return `# 열린 떡밥

${markdownList(result.openThreads)}

## 회수 메모

- 각 항목은 회차 브리프와 장면 계획에서 다룰지, 보류할지 결정합니다.
`;
}

function renderCastInbox(result: SourceIntakeResult): string {
  return `# 등장인물 인박스

${result.characters.map((character) => `- ${character.name}: ${character.role} · ${character.notes.join(' / ')}`).join('\n')}

## 다음 정리

- 인물별 목표, 결핍, 관계 변화를 확정하면 개별 캐릭터 파일에 옮깁니다.
`;
}

function renderCharacterFile(character: SourceIntakeCharacter): string {
  return `# ${character.name}

- 역할: ${character.role}
- 상태: 원천 문서에서 1차 분리

## 메모

${markdownList(character.notes)}

## 관계와 변화

- 미정
`;
}

function renderOrganizations(result: SourceIntakeResult): string {
  return `# 조직과 세력

${result.organizations.length ? result.organizations.map((organization) => `## ${organization.name}\n\n- 유형: ${organization.kind}\n${markdownList(organization.notes)}`).join('\n\n') : '- 원천 문서에서 별도 조직/세력 항목을 확정하지 않았습니다.'}
`;
}

function renderSourceIntake(result: SourceIntakeResult): string {
  const json = JSON.stringify(
    {
      schema_version: result.schema_version,
      source: result.source,
      title: result.title,
      sourceFileName: result.sourceFileName,
      sourceStats: result.sourceStats,
      premise: result.premise,
      logline: result.logline,
      worldRules: result.worldRules,
      characters: result.characters,
      organizations: result.organizations,
      plotBeats: result.plotBeats,
      openThreads: result.openThreads,
      styleNotes: result.styleNotes,
      sourceDigest: result.sourceDigest
    },
    null,
    2
  );
  return `# 통합 문서 분해 리포트

## 원천

- 작품: ${result.title}
- 파일: ${result.sourceFileName || '붙여넣기 입력'}
- 분해: ${result.source === 'agent' ? 'AI 문맥 분해' : '로컬 규칙 분해'}
- 글자: ${result.sourceStats.chars}
- 문단: ${result.sourceStats.paragraphs}

## 생성된 하네스 파일

- canon/setting-bible.md
- plot/open-threads.md
- plot/plot-board.json
- characters/cast-inbox.md
- world/organizations.md
- story/chapters/ep001/index.md
- story/chapters/ep001/manuscript.md

## 원천 핵심 줄

${markdownList(result.sourceDigest)}

## 문체 메모

${markdownList(result.styleNotes)}

<!-- bindery:source-intake-json
${json}
-->
`;
}

function renderEpisodeIndex(result: SourceIntakeResult): string {
  return `# EP001 작업 메모

- 작품: ${result.title}
- 시작 방식: 통합 문서 분해
- 원고: manuscript.md
- 설정집: ../../../canon/setting-bible.md
- 플롯 보드: ../../../plot/plot-board.json
- 상태: seed

## 첫 회차 목표

${result.logline}

## 장면 씨앗

${result.plotBeats.map((beat) => `- ${beat.title} (${beat.tension}): ${beat.summary}`).join('\n')}
`;
}

function renderManuscriptSeed(result: SourceIntakeResult): string {
  const characters = result.characters.map((character) => `  - ${character.id}`).join('\n');
  return `---
episode: ep001
status: seed
pov: 미정
characters:
${characters || '  - cast-inbox'}
---

# EP001

> 통합 문서에서 분리한 첫 회차 원고 자리입니다. 아래 장면 씨앗을 prose로 확장하기 전에 AI 작업에서 회차 브리프와 장면 계획을 확정하세요.

## 장면 씨앗

${result.plotBeats.map((beat) => `- ${beat.title}: ${beat.summary}`).join('\n')}
`;
}

export function buildSourceIntakeFiles(result: SourceIntakeResult, rawSource: string): SourceIntakeFile[] {
  const files: SourceIntakeFile[] = [
    { path: 'canon/setting-bible.md', content: renderSettingBible(result) },
    { path: 'plot/open-threads.md', content: renderOpenThreads(result) },
    { path: 'plot/plot-board.json', content: `${JSON.stringify(result.plotGrid, null, 2)}\n` },
    { path: 'characters/cast-inbox.md', content: renderCastInbox(result) },
    { path: 'world/organizations.md', content: renderOrganizations(result) },
    { path: 'notes/source-intake.md', content: renderSourceIntake(result) },
    { path: 'notes/source-raw.md', content: `# 원천 통합 문서\n\n${rawSource.trim()}\n` },
    { path: 'story/chapters/ep001/index.md', content: renderEpisodeIndex(result) },
    { path: 'story/chapters/ep001/manuscript.md', content: renderManuscriptSeed(result) }
  ];

  for (const character of result.characters.filter((item) => item.id !== 'cast-inbox')) {
    files.push({ path: `characters/${character.id}.md`, content: renderCharacterFile(character) });
  }

  return files;
}
