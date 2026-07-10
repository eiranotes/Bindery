// 문체 재현 — 레거시 Bindery style_system의 핵심 아이디어를 신 하네스 방식으로 준용한다.
//
// 준용한 것: 장면 후보 분할 + 장면 유형 분류(로컬 결정적), 전역 규칙 + 장면 유형별
// 오버레이라는 2층 구조, content term 누출 방지(원문 고유명사 복제 금지),
// 짧은 인용 fewshot(형태 참고용 — 표현 복제 금지).
// 개선한 것: 규칙 기반 풀스택(라우터/스택 병합/스코어러/SQLite) 대신
// 로컬 분해 → AI 종합 분석(1회) → 프리셋 파일 진실 → 집필 시 장면 매칭 캡슐 주입.
//
// 흐름: 한/일 원문 입력 → 장면별 분해(로컬) → 문체 종합 분석(AI, 한국어 프로필)
// → 프리셋 저장 → 적용 시 style-guide.md 렌더(기존 파이프라인 즉시 소비)
// → 집필 시 장면 계획과 매칭된 오버레이만 골라 캡슐로 주입 → 한국어 아웃풋.
import { LAYOUT, artifactPath } from '$lib/core/layout';
import { clip, extractJsonObject, nowIso, safeString, safeStringArray, stamp } from '$lib/core/text';
import { BLUEPRINTS } from '$lib/prompts';
import type { ScenePlan } from '$lib/schemas/contracts';
import { readOptional } from './project';
import { runStage } from './runner';
import { snapshotFile } from './snapshots';
import type { Ctx, StageSource } from './types';

// ---------------------------------------------------------------------------
// 타입
// ---------------------------------------------------------------------------

export type StyleSceneType = 'dialogue' | 'action' | 'description' | 'emotion' | 'transition';

export const SCENE_TYPE_LABELS: Record<StyleSceneType, string> = {
  dialogue: '대화',
  action: '행동·사건',
  description: '묘사·관찰',
  emotion: '감정·내면',
  transition: '전환·정리'
};

/** 로컬 분해 결과 — 분석 프롬프트에 유형 표찰과 함께 들어가는 원문 샘플. */
export type StyleSceneSample = {
  id: string;
  type: StyleSceneType;
  dialogueRatio: number;
  chars: number;
  excerpt: string;
};

/** 장면 유형별 오버레이 — 전역 위에 얹는 특징과 짧은 인용(복제 금지). */
export type StyleSceneTrait = {
  scene_type: string;
  traits: string[];
  quote: string;
};

export type StyleProfile = {
  schema_version: 'bindery.style_profile.v1';
  source_lang: string;
  /** 전역 분위기 — 작품 전체에 흐르는 결 한 문단 */
  summary: string;
  /** 전역 문체 규칙 (지시형 한국어) */
  global_rules: string[];
  /** 장면 유형별 특징 */
  scene_overlays: StyleSceneTrait[];
  /** 대화 처리 특징 */
  dialogue_voice: string[];
  /** 하지 말아야 할 것 */
  forbidden: string[];
  /** 원문 고유명사/내용어 — 산출물에 복제 금지 */
  content_terms: string[];
};

export type StylePreset = {
  schema_version: 'bindery.style_preset.v1';
  id: string;
  name: string;
  createdAt: string;
  source: StageSource;
  sourceStats: { chars: number; scenes: number; lang: string };
  profile: StyleProfile;
};

export type StylePresetIndex = {
  schema_version: 'bindery.style_preset_index.v1';
  activePresetId: string | null;
  presets: Array<Pick<StylePreset, 'id' | 'name' | 'createdAt' | 'source'> & { lang: string; summary: string }>;
};

export type StyleHistoryEntry = {
  at: string;
  action: 'analyzed' | 'saved' | 'applied' | 'deactivated' | 'deleted';
  presetId?: string;
  name?: string;
  note?: string;
};

// ---------------------------------------------------------------------------
// 로컬 정적: 언어 감지 · 장면 분해 · 유형 분류 · content term 추출
// ---------------------------------------------------------------------------

export function detectLang(text: string): string {
  const ja = (text.match(/[぀-ヿ]/g) ?? []).length;
  const ko = (text.match(/[가-힣]/g) ?? []).length;
  if (ja > 40 && ja > ko * 0.5) return ko > ja ? 'mixed' : 'ja';
  if (ko > 40) return 'ko';
  return 'unknown';
}

const DIALOGUE_LINE_RE = /^\s*(?:["“」『「]|―|—|['‘])/;
const DIALOGUE_MARK_RE = /["“”「」『』]/g;
const ACTION_MARKERS = ['달려', '뛰었', '부딪', '휘둘', '쓰러', '터졌', '덮쳤', '走っ', '駆け', '斬', '殴', '倒れ'];
const EMOTION_MARKERS = ['마음', '가슴', '두려움', '분노', '슬픔', '眩暈', '심장', '떨렸', '怒り', '悲し', '恐怖', '胸'];
const TRANSITION_MARKERS = ['다음 날', '이튿날', '그로부터', '한참', '翌日', 'それから', 'しばらく'];

function dialogueRatioOf(block: string): number {
  const lines = block.split('\n').filter((l) => l.trim());
  if (!lines.length) return 0;
  const dialogueLines = lines.filter((l) => DIALOGUE_LINE_RE.test(l)).length;
  const marks = (block.match(DIALOGUE_MARK_RE) ?? []).length;
  return Math.min(1, dialogueLines / lines.length + marks / Math.max(80, block.length / 8));
}

function countHits(text: string, markers: string[]): number {
  return markers.reduce((sum, m) => sum + (text.includes(m) ? 1 : 0), 0);
}

export function classifyStyleScene(block: string): StyleSceneType {
  const ratio = dialogueRatioOf(block);
  if (ratio >= 0.35) return 'dialogue';
  const scores: Array<[StyleSceneType, number]> = [
    ['action', countHits(block, ACTION_MARKERS)],
    ['emotion', countHits(block, EMOTION_MARKERS)],
    ['transition', countHits(block, TRANSITION_MARKERS)]
  ];
  scores.sort((a, b) => b[1] - a[1]);
  return scores[0][1] > 0 ? scores[0][0] : 'description';
}

const SOFT_MAX_SCENE_CHARS = 1800;
const MAX_SAMPLE_SCENES = 10;
const EXCERPT_CLIP = 900;

/** 원문을 장면 후보로 분해한다 (레거시 paragraphCandidates 휴리스틱 준용·단순화). */
export function splitStyleScenes(rawText: string): StyleSceneSample[] {
  const blocks = rawText
    .replace(/\r\n/g, '\n')
    .replace(/^\s*(?:\*\s*\*\s*\*|---+|={3,}|◇+|◆+|＊+)\s*$/gm, '\n\n@@SCENE-BREAK@@\n\n')
    .replace(/^(#{1,3}\s+\S.*|제\s*\d+\s*[장화]\b.*|第\s*\d+\s*[章話]\b.*)$/gm, '\n\n@@SCENE-BREAK@@\n$1\n')
    .trim()
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const scenes: string[] = [];
  let current: string[] = [];
  const flush = () => {
    const text = current.join('\n\n').trim();
    if (text) scenes.push(text);
    current = [];
  };
  for (const block of blocks) {
    if (block === '@@SCENE-BREAK@@') {
      flush();
      continue;
    }
    const chars = current.join('\n\n').replace(/\s/g, '').length;
    if (current.length && chars >= SOFT_MAX_SCENE_CHARS) flush();
    current.push(block.replace(/@@SCENE-BREAK@@/g, '').trim());
  }
  flush();

  // 장면이 너무 많으면 앞/중/뒤에서 고르게 샘플링 — 문체는 전체 분포가 중요하다.
  let picked = scenes;
  if (scenes.length > MAX_SAMPLE_SCENES) {
    const step = (scenes.length - 1) / (MAX_SAMPLE_SCENES - 1);
    const indexes = new Set<number>();
    for (let i = 0; i < MAX_SAMPLE_SCENES; i++) indexes.add(Math.round(i * step));
    picked = [...indexes].sort((a, b) => a - b).map((i) => scenes[i]);
  }

  return picked.map((text, i) => ({
    id: `S${String(i + 1).padStart(2, '0')}`,
    type: classifyStyleScene(text),
    dialogueRatio: Math.round(dialogueRatioOf(text) * 100) / 100,
    chars: text.replace(/\s/g, '').length,
    excerpt: clip(text, EXCERPT_CLIP)
  }));
}

const TERM_STOPWORDS = new Set([
  '그리고', '하지만', '그러나', '그녀', '자신', '지금', '당신', '우리', '여기', '무엇',
  'それ', 'これ', 'あなた', '自分', 'そして', 'しかし'
]);

const JOSA_TAIL_RE = /(에서|으로|이라|한테|에게|처럼|보다|까지|부터|라는|는|은|이|가|을|를|의|에|도|와|과|로|만)$/u;

/** 한국어 낱말 정규화 — 흔한 조사 꼬리를 떼어 같은 고유명사를 하나로 센다. */
function stripJosa(word: string): string {
  if (!/[가-힣]/.test(word)) return word;
  const stripped = word.replace(JOSA_TAIL_RE, '');
  return stripped.length >= 2 ? stripped : word;
}

/** 원문 반복 고유명사 근사 추출 — 복제 금지 목록의 로컬 시드. */
export function extractContentTerms(text: string, max = 16): string[] {
  const counts = new Map<string, number>();
  for (const raw of text.match(/[가-힣]{2,7}|[゠-ヿ]{2,8}|[一-鿿]{2,4}/g) ?? []) {
    const term = stripJosa(raw);
    if (TERM_STOPWORDS.has(term) || term.length < 2) continue;
    counts.set(term, (counts.get(term) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([term]) => term);
}

// ---------------------------------------------------------------------------
// AI 종합 분석 (style-analysis 스테이지)
// ---------------------------------------------------------------------------

function parseStyleProfile(text: string): StyleProfile | null {
  const raw = extractJsonObject(text) as Record<string, unknown> | null;
  if (!raw || safeString(raw.schema_version) !== 'bindery.style_profile.v1') return null;
  const summary = safeString(raw.summary).trim();
  const globalRules = safeStringArray(raw.global_rules, 14);
  if (!summary || globalRules.length < 2) return null;
  const overlaysRaw = Array.isArray(raw.scene_overlays) ? (raw.scene_overlays as Record<string, unknown>[]) : [];
  const overlays: StyleSceneTrait[] = overlaysRaw
    .map((o) => ({
      scene_type: safeString(o.scene_type),
      traits: safeStringArray(o.traits, 6),
      quote: clip(safeString(o.quote), 140)
    }))
    .filter((o) => o.scene_type && o.traits.length);
  return {
    schema_version: 'bindery.style_profile.v1',
    source_lang: safeString(raw.source_lang) || 'unknown',
    summary,
    global_rules: globalRules,
    scene_overlays: overlays,
    dialogue_voice: safeStringArray(raw.dialogue_voice, 8),
    forbidden: safeStringArray(raw.forbidden, 10),
    content_terms: safeStringArray(raw.content_terms, 24)
  };
}

/** AI 없이도 정직하게 돌아가는 최소 프로필 — 로컬 통계 기반 뼈대. */
function localProfileFallback(lang: string, samples: StyleSceneSample[], contentTerms: string[]): StyleProfile {
  const avgChars = samples.length ? Math.round(samples.reduce((s, x) => s + x.chars, 0) / samples.length) : 0;
  const dialogueHeavy = samples.filter((s) => s.type === 'dialogue').length / Math.max(1, samples.length);
  return {
    schema_version: 'bindery.style_profile.v1',
    source_lang: lang,
    summary: '(AI 미연결 — 로컬 통계 뼈대) 원문 장면 분포를 기준으로 한 기초 지침입니다. AI 분석 후 교체하세요.',
    global_rules: [
      `장면당 평균 분량 감각을 유지한다 (원문 약 ${avgChars.toLocaleString()}자/장면).`,
      dialogueHeavy >= 0.4 ? '대화 비중이 높은 원문이다 — 대화로 장면을 굴린다.' : '서술 비중이 높은 원문이다 — 서술의 호흡을 유지한다.'
    ],
    scene_overlays: samples.slice(0, 4).map((s) => ({
      scene_type: s.type,
      traits: [`${SCENE_TYPE_LABELS[s.type]} 장면 비율 참고 (대화율 ${Math.round(s.dialogueRatio * 100)}%)`],
      quote: ''
    })),
    dialogue_voice: [],
    forbidden: [],
    content_terms: contentTerms
  };
}

export type StyleAnalysisResult = {
  profile: StyleProfile;
  source: 'agent' | 'fallback';
  samples: StyleSceneSample[];
  stats: { chars: number; scenes: number; lang: string };
};

/** 원문 → 장면 분해(로컬) → 문체 종합 분석(AI). 프리셋 저장 전의 미리보기 결과. */
export async function analyzeStyleSource(ctx: Ctx, rawText: string): Promise<StyleAnalysisResult> {
  const lang = detectLang(rawText);
  const samples = splitStyleScenes(rawText);
  const localTerms = extractContentTerms(rawText);
  const stats = { chars: rawText.replace(/\s/g, '').length, scenes: samples.length, lang };

  const sceneBlock = samples
    .map((s) => `### ${s.id} · ${SCENE_TYPE_LABELS[s.type]} (대화율 ${Math.round(s.dialogueRatio * 100)}%)\n${s.excerpt}`)
    .join('\n\n');

  const outcome = await runStage<StyleProfile>(ctx, {
    stage: 'style-analysis',
    scope: 'style',
    blueprint: BLUEPRINTS.styleAnalysis,
    vars: {
      sourceLang: lang,
      sceneCount: String(samples.length),
      scenes: sceneBlock,
      contentTerms: localTerms.join(', ') || '(로컬 추출 없음)'
    },
    parse: parseStyleProfile,
    fallback: () => localProfileFallback(lang, samples, localTerms),
    repairHint:
      '{"schema_version":"bindery.style_profile.v1","source_lang":"ja","summary":"...","global_rules":["..."],"scene_overlays":[{"scene_type":"dialogue","traits":["..."],"quote":"..."}],"dialogue_voice":["..."],"forbidden":["..."],"content_terms":["..."]}'
  });

  // 복제 금지 목록은 로컬 추출과 AI 추출의 합집합 — 누출 방지는 보수적으로.
  const merged = new Set([...outcome.output.content_terms, ...localTerms]);
  outcome.output.content_terms = [...merged].slice(0, 24);

  await appendStyleHistory(ctx, {
    at: nowIso(),
    action: 'analyzed',
    note: `${lang} 원문 ${stats.chars.toLocaleString()}자 · 장면 ${stats.scenes}개 · ${outcome.source === 'agent' ? 'AI 분석' : '로컬 뼈대'}`
  });

  return { profile: outcome.output, source: outcome.source, samples, stats };
}

// ---------------------------------------------------------------------------
// 프리셋 저장 · 적용 · 삭제 (style/presets/* 파일이 진실)
// ---------------------------------------------------------------------------

function presetPath(id: string): string {
  return `${LAYOUT.style.presets}/${id}.json`;
}

export async function loadPresetIndex(ctx: Ctx): Promise<StylePresetIndex> {
  try {
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, LAYOUT.style.presetIndex)) as StylePresetIndex;
    if (raw.schema_version === 'bindery.style_preset_index.v1') return raw;
  } catch {
    /* 첫 사용 */
  }
  return { schema_version: 'bindery.style_preset_index.v1', activePresetId: null, presets: [] };
}

async function savePresetIndex(ctx: Ctx, index: StylePresetIndex): Promise<void> {
  await ctx.bridge.writeFile(ctx.root, LAYOUT.style.presetIndex, JSON.stringify(index, null, 2));
}

export async function loadPreset(ctx: Ctx, id: string): Promise<StylePreset | null> {
  try {
    const raw = JSON.parse(await ctx.bridge.readFile(ctx.root, presetPath(id))) as StylePreset;
    return raw.schema_version === 'bindery.style_preset.v1' ? raw : null;
  } catch {
    return null;
  }
}

export async function saveStylePreset(
  ctx: Ctx,
  name: string,
  analysis: StyleAnalysisResult
): Promise<StylePreset> {
  const preset: StylePreset = {
    schema_version: 'bindery.style_preset.v1',
    id: `style-${stamp()}`,
    name: name.trim() || `문체 ${new Date().toLocaleDateString()}`,
    createdAt: nowIso(),
    source: analysis.source,
    sourceStats: analysis.stats,
    profile: analysis.profile
  };
  await ctx.bridge.writeFile(ctx.root, presetPath(preset.id), JSON.stringify(preset, null, 2));
  const index = await loadPresetIndex(ctx);
  index.presets.unshift({
    id: preset.id,
    name: preset.name,
    createdAt: preset.createdAt,
    source: preset.source,
    lang: preset.sourceStats.lang,
    summary: clip(preset.profile.summary, 120)
  });
  await savePresetIndex(ctx, index);
  await appendStyleHistory(ctx, { at: nowIso(), action: 'saved', presetId: preset.id, name: preset.name });
  return preset;
}

/** 프리셋 → style-guide.md 렌더. 기존 집필 파이프라인이 그대로 소비한다. */
export function renderStyleGuide(preset: StylePreset): string {
  const p = preset.profile;
  const lines = [
    `# 스타일 지침 — ${preset.name}`,
    '',
    `> 문체 프리셋 \`${preset.id}\`에서 적용됨 (${preset.createdAt.slice(0, 10)} 분석 · 원문 ${p.source_lang}).`,
    `> 원문 표현의 복제가 아니라 결의 재현이 목표다.`,
    '',
    '## 전역 분위기',
    p.summary,
    '',
    '## 전역 규칙',
    ...p.global_rules.map((r) => `- ${r}`),
    ''
  ];
  if (p.dialogue_voice.length) {
    lines.push('## 대화 처리', ...p.dialogue_voice.map((r) => `- ${r}`), '');
  }
  if (p.scene_overlays.length) {
    lines.push('## 장면 유형별 특징');
    for (const o of p.scene_overlays) {
      lines.push(`### ${o.scene_type}`);
      lines.push(...o.traits.map((t) => `- ${t}`));
      if (o.quote) lines.push(`- 인용(형태 참고용 — 표현 그대로 복제 금지): "${o.quote}"`);
      lines.push('');
    }
  }
  if (p.forbidden.length) {
    lines.push('## 금지', ...p.forbidden.map((f) => `- ${f}`), '');
  }
  if (p.content_terms.length) {
    lines.push(
      '## 원문 고유명사 — 사용 금지 (문체만 가져오고 내용은 가져오지 않는다)',
      `- ${p.content_terms.join(', ')}`,
      ''
    );
  }
  return lines.join('\n');
}

export async function applyStylePreset(ctx: Ctx, id: string): Promise<StylePreset | null> {
  const preset = await loadPreset(ctx, id);
  if (!preset) return null;
  // 기존 수동 지침을 덮어쓰기 전에 스냅샷 — 되돌리기 가능.
  await snapshotFile(ctx, LAYOUT.style.guide, `문체 프리셋 적용 전 백업 (${preset.name})`);
  await ctx.bridge.writeFile(ctx.root, LAYOUT.style.guide, renderStyleGuide(preset));
  const index = await loadPresetIndex(ctx);
  index.activePresetId = id;
  await savePresetIndex(ctx, index);
  await appendStyleHistory(ctx, { at: nowIso(), action: 'applied', presetId: id, name: preset.name, note: 'style-guide.md 갱신 (이전본 스냅샷 보존)' });
  return preset;
}

/** 프리셋 적용 해제 — style-guide.md는 그대로 두고 활성 연결만 끊는다. */
export async function deactivateStylePreset(ctx: Ctx): Promise<void> {
  const index = await loadPresetIndex(ctx);
  const prev = index.presets.find((p) => p.id === index.activePresetId);
  index.activePresetId = null;
  await savePresetIndex(ctx, index);
  await appendStyleHistory(ctx, {
    at: nowIso(),
    action: 'deactivated',
    presetId: prev?.id,
    name: prev?.name,
    note: 'style-guide.md 내용은 유지됨 — 장면별 오버레이만 중단'
  });
}

export async function deleteStylePreset(ctx: Ctx, id: string): Promise<void> {
  const index = await loadPresetIndex(ctx);
  const target = index.presets.find((p) => p.id === id);
  index.presets = index.presets.filter((p) => p.id !== id);
  if (index.activePresetId === id) index.activePresetId = null;
  await savePresetIndex(ctx, index);
  await ctx.bridge.deleteFile(ctx.root, presetPath(id));
  await appendStyleHistory(ctx, { at: nowIso(), action: 'deleted', presetId: id, name: target?.name });
}

export async function loadActiveStylePreset(ctx: Ctx): Promise<StylePreset | null> {
  const index = await loadPresetIndex(ctx);
  if (!index.activePresetId) return null;
  return loadPreset(ctx, index.activePresetId);
}

// ---------------------------------------------------------------------------
// 이력
// ---------------------------------------------------------------------------

export async function loadStyleHistory(ctx: Ctx): Promise<StyleHistoryEntry[]> {
  try {
    return JSON.parse(await ctx.bridge.readFile(ctx.root, LAYOUT.style.history)) as StyleHistoryEntry[];
  } catch {
    return [];
  }
}

async function appendStyleHistory(ctx: Ctx, entry: StyleHistoryEntry): Promise<void> {
  const history = await loadStyleHistory(ctx);
  history.unshift(entry);
  await ctx.bridge.writeFile(ctx.root, LAYOUT.style.history, JSON.stringify(history.slice(0, 100), null, 2));
}

// ---------------------------------------------------------------------------
// 집필 주입 — "이번 화에 어떤 문체를 어떻게 적용할지"의 단일 결정 지점
// ---------------------------------------------------------------------------

const CAPSULE_MAX_CHARS = 2400;

/** 장면 계획의 각 장면을 프리셋 오버레이 유형으로 근사 매칭한다 (로컬 결정적). */
export function matchSceneOverlay(scene: { purpose: string; conflict: string; characters: string[] }): StyleSceneType {
  const text = `${scene.purpose} ${scene.conflict}`;
  if (/대화|설득|담판|추궁|합의|질문/.test(text) || scene.characters.length >= 2) {
    if (/전투|추격|잠입|충돌|폭발|습격/.test(text)) return 'action';
    return 'dialogue';
  }
  if (/전투|추격|잠입|이동|탈출|작전|습격/.test(text)) return 'action';
  if (/감정|내면|회상|상실|결심|불안/.test(text)) return 'emotion';
  if (/정리|전환|마무리|여운|다음/.test(text)) return 'transition';
  return 'description';
}

/**
 * 활성 프리셋 + 이번 화 장면 계획 → 집필용 문체 캡슐.
 * 전역 분위기는 항상, 장면 오버레이는 이번 화에 실제로 나오는 유형만 골라 넣는다.
 * 활성 프리셋이 없으면 null — 호출부는 기존 style-guide.md로 폴백한다.
 */
export async function buildStyleCapsule(
  ctx: Ctx,
  episode: string,
  scenePlan: ScenePlan | null
): Promise<{ text: string; presetName: string } | null> {
  const preset = await loadActiveStylePreset(ctx);
  if (!preset) return null;
  const p = preset.profile;

  const neededTypes = new Set<string>();
  const sceneLines: string[] = [];
  if (scenePlan?.scenes.length) {
    for (const scene of scenePlan.scenes) {
      const type = matchSceneOverlay(scene);
      neededTypes.add(type);
      sceneLines.push(`- ${scene.id}: ${SCENE_TYPE_LABELS[type]} 결로 쓴다`);
    }
  }

  const overlays = p.scene_overlays.filter(
    (o) => neededTypes.size === 0 || neededTypes.has(o.scene_type)
  );

  const lines = [
    `[문체 프리셋: ${preset.name} — 원문 표현 복제 금지, 결만 재현]`,
    '',
    '## 전역 분위기',
    p.summary,
    '',
    '## 전역 규칙',
    ...p.global_rules.map((r) => `- ${r}`)
  ];
  if (p.dialogue_voice.length && (neededTypes.size === 0 || neededTypes.has('dialogue'))) {
    lines.push('', '## 대화 처리', ...p.dialogue_voice.map((r) => `- ${r}`));
  }
  if (overlays.length) {
    lines.push('', '## 이번 화 장면 유형별 적용');
    for (const o of overlays) {
      lines.push(`### ${o.scene_type}`);
      lines.push(...o.traits.map((t) => `- ${t}`));
      if (o.quote) lines.push(`- 형태 참고 인용(그대로 쓰지 말 것): "${o.quote}"`);
    }
  }
  if (sceneLines.length) {
    lines.push('', '## 장면별 배정', ...sceneLines);
  }
  const forbidden = [
    ...p.forbidden,
    ...(p.content_terms.length ? [`원문 고유명사 사용 금지: ${p.content_terms.join(', ')}`] : [])
  ];
  if (forbidden.length) {
    lines.push('', '## 금지', ...forbidden.map((f) => `- ${f}`));
  }

  const text = clip(lines.join('\n'), CAPSULE_MAX_CHARS);
  // 근거 보기용 기록 — 이번 화에 어떤 문체가 어떻게 적용됐는지 감사 가능.
  try {
    await ctx.bridge.writeFile(ctx.root, artifactPath(episode, 'style-capsule.md'), text);
  } catch {
    /* 기록 실패 무시 */
  }
  return { text, presetName: preset.name };
}
