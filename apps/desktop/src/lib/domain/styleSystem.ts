// Bindery structured style runtime MVP.
// This module keeps the new style system independent from the existing
// analyzer UI so it can be reused by API mocks, CLI parity tests, and SkillPack export.

export type SceneTag = 'OBS' | 'DIA' | 'ACT' | 'INF' | 'CON' | 'MOV' | 'AFT' | 'TRN' | 'INT' | 'REL';
export type CoreSceneTag = Exclude<SceneTag, 'INT' | 'REL'>;
export type SurfaceMode = 'dialogue-heavy' | 'description-heavy' | 'action-heavy' | 'exposition-heavy' | 'internal-heavy' | 'mixed';
export type StyleRegister =
  | 'observation'
  | 'dialogue'
  | 'action'
  | 'exposition'
  | 'conflict'
  | 'movement'
  | 'aftermath'
  | 'quiet_transition'
  | 'internal_overlay'
  | 'relationship_overlay';

export type NarrativeFunction =
  | 'information_reveal'
  | 'relationship_shift'
  | 'tension_escalation'
  | 'conflict_resolution'
  | 'preparation'
  | 'movement'
  | 'aftermath_processing'
  | 'emotional_shift'
  | 'decision'
  | 'hesitation'
  | 'partial_reveal'
  | 'scene_transition';

export type StyleRule = {
  rule_id: string;
  instruction: string;
  axis?: string;
  strength?: number;
  source?: 'global' | 'register' | 'overlay' | 'character' | 'negative' | 'fewshot' | 'manual';
};

export type WeightedStyleRule = StyleRule & {
  weight: number;
  priority: number;
  source_stack_id?: string;
  source_preset_id?: string;
};

export type StyleProfile = {
  profile_id: string;
  project_id?: string;
  source_title?: string;
  language: 'ko' | 'ja' | 'mixed' | 'unknown';
  schema_version: 'bindery.style.profile.v1';
  global_rules: StyleRule[];
  register_rules: Partial<Record<StyleRegister, StyleRule[]>>;
  overlay_rules: Partial<Record<SceneTag, StyleRule[]>>;
  character_rules?: Record<string, StyleRule[]>;
  negative_rules: string[];
  content_terms: string[];
  style_axes?: Record<string, number>;
  metrics_baseline?: StyleMetricsBaseline;
  created_at?: string;
  updated_at?: string;
};

export type StylePreset = {
  preset_id: string;
  project_id?: string;
  name: string;
  description?: string;
  source_profile_id?: string;
  preset_type: 'narration' | 'dialogue' | 'mixed' | 'character' | 'register';
  default_strength: number;
  allowed_scopes: string[];
  style_axes: Record<string, number>;
  register_availability: Partial<Record<StyleRegister, boolean>>;
  compact_instruction: string;
  global_rules: StyleRule[];
  register_rules: Partial<Record<StyleRegister, StyleRule[]>>;
  overlay_rules: Partial<Record<SceneTag, StyleRule[]>>;
  character_rules?: Record<string, StyleRule[]>;
  negative_rules: string[];
  fewshot_refs: string[];
  content_terms?: string[];
  metrics_baseline?: StyleMetricsBaseline;
};

export type StyleStackAdapter = {
  preset_id: string;
  role: 'base' | 'global_overlay' | 'dialogue_overlay' | 'conflict_overlay' | 'register_overlay' | 'character_overlay' | 'scene_overlay';
  weight: number;
  scope: 'global' | StyleRegister | SceneTag | 'dialogue' | 'conflict' | `character:${string}`;
  enabled?: boolean;
  compatible_scene_types?: SceneTag[];
  compatible_registers?: StyleRegister[];
  rule_overrides?: StyleRule[];
};

export type StyleStack = {
  stack_id: string;
  project_id?: string;
  name: string;
  description?: string;
  base_preset_id?: string;
  adapters: StyleStackAdapter[];
  presets?: StylePreset[];
  conflict_policy: 'scope_priority' | 'higher_weight' | 'base_preserve' | 'axis_merge' | 'manual_lock';
  normalization: 'weighted_average' | 'none';
  max_active_rules: number;
  global_rules?: StyleRule[];
  register_rules?: Partial<Record<StyleRegister, StyleRule[]>>;
  overlay_rules?: Partial<Record<SceneTag, StyleRule[]>>;
  character_rules?: Record<string, StyleRule[]>;
  negative_rules?: string[];
  fewshot_refs?: string[];
};

export type SceneClassification = {
  scene_id: string;
  chapter_id?: string;
  primary_type: SceneTag;
  secondary_types: SceneTag[];
  surface_mode: SurfaceMode;
  narrative_functions: NarrativeFunction[];
  style_register: StyleRegister;
  confidence: number;
  scores: Record<SceneTag, number>;
  feature_scores: SceneFeatureScores;
  manual_override: boolean;
};

export type SceneFeatureScores = {
  dialogue_ratio: number;
  observation_density: number;
  action_verb_density: number;
  exposition_marker_density: number;
  conflict_intensity: number;
  movement_marker_density: number;
  aftermath_marker_density: number;
  transition_marker_density: number;
  internal_judgment_density: number;
  relationship_shift_density: number;
};

export type StyleRouteTarget =
  | 'manual_override'
  | 'character_dialogue'
  | 'dialogue'
  | 'scene_id'
  | 'style_register'
  | 'scene_type'
  | 'chapter'
  | 'arc'
  | 'project_default'
  | 'project'
  | 'paragraph_range'
  | 'revision_pass';

export type StyleRouterRule = {
  rule_id: string;
  target_type: StyleRouteTarget;
  target_value: string;
  stack_id: string;
  priority: number;
  enabled: boolean;
  overlay?: boolean;
  compatible_scene_types?: SceneTag[];
  compatible_registers?: StyleRegister[];
};

export type StyleRouter = {
  router_id: string;
  project_id?: string;
  default_stack_id?: string;
  rules: StyleRouterRule[];
};

export type StyleRouteContext = {
  project_id?: string;
  arc_id?: string;
  chapter_id?: string;
  scene_id: string;
  classification: SceneClassification;
  character_id?: string;
  dialogue_speakers?: string[];
  manual_override_stack_id?: string;
  revision_pass?: string;
};

export type ActiveStyleStack = {
  primary_stack_id: string;
  overlay_stack_ids: string[];
  matched_rules: StyleRouterRule[];
  routing_reason: string;
};

export type MergedStyleRules = {
  stack_id: string;
  global_rules: WeightedStyleRule[];
  register_rules: WeightedStyleRule[];
  overlay_rules: WeightedStyleRule[];
  character_rules: WeightedStyleRule[];
  negative_rules: string[];
  diagnostics: string[];
  active_rule_count: number;
};

export type StyleGenerationContext = {
  project_id?: string;
  chapter_id?: string;
  scene_id: string;
  scene_text?: string;
  scene_classification: SceneClassification;
  focus_character?: string;
  stacks: StyleStack[] | Record<string, StyleStack>;
};

export type PromptCapsule = {
  active_stack: string;
  scene_type: SceneTag;
  style_register: StyleRegister;
  secondary_types: SceneTag[];
  global_rules: string[];
  register_rules: string[];
  overlay_rules: string[];
  character_rules: string[];
  negative_rules: string[];
  fewshot_refs: string[];
  self_checklist: string[];
};

export type StyleMetricsBaseline = {
  avg_sentence_len?: number;
  short_sentence_ratio?: number;
  long_sentence_ratio?: number;
  dialogue_ratio?: number;
  paragraph_count?: number;
};

export type StyleMatchReport = {
  report_id: string;
  total_score: number;
  global_fit: number;
  register_fit: number;
  scene_classification_fit: number;
  stack_blend_fit: number;
  rhythm_fit: number;
  discourse_fit: number;
  dialogue_fit: number;
  lexical_fit: number;
  fluency: number;
  leakage_penalty: number;
  register_mismatch_penalty: number;
  overfit_penalty: number;
  diagnostics: string[];
};

export type StyleSkillPackFile = { path: string; content: string };

export type KoreanSurfaceReport = {
  morphology: {
    eojeol_count: number;
    unique_eojeol_ratio: number;
    sentence_count: number;
    ending_counts: Record<string, number>;
    particle_counts: Record<string, number>;
    honorific_counts: Record<string, number>;
  };
  action_verbs: Record<string, number>;
  judgment_markers: Record<string, number>;
  relationship_markers: Record<string, number>;
  emotion_markers: Record<string, number>;
  dialogue: {
    quoted_block_count: number;
    quoted_blocks: string[];
    manual_speaker_correction_first: boolean;
    speaker_candidates: Array<{ speaker: string; count: number; source: string }>;
  };
};

const CORE_SCENE_TAGS: CoreSceneTag[] = ['OBS', 'DIA', 'ACT', 'INF', 'CON', 'MOV', 'AFT', 'TRN'];
const OVERLAY_TAGS: SceneTag[] = ['REL', 'INT'];
const ALL_SCENE_TAGS: SceneTag[] = ['OBS', 'DIA', 'ACT', 'INF', 'CON', 'MOV', 'AFT', 'TRN', 'INT', 'REL'];

export const STYLE_REGISTER_BY_TAG: Record<SceneTag, StyleRegister> = {
  OBS: 'observation',
  DIA: 'dialogue',
  ACT: 'action',
  INF: 'exposition',
  CON: 'conflict',
  MOV: 'movement',
  AFT: 'aftermath',
  TRN: 'quiet_transition',
  INT: 'internal_overlay',
  REL: 'relationship_overlay'
};

const TAG_LABEL: Record<SceneTag, string> = {
  OBS: 'observation',
  DIA: 'dialogue',
  ACT: 'action',
  INF: 'information',
  CON: 'conflict',
  MOV: 'movement',
  AFT: 'aftermath',
  TRN: 'transition',
  INT: 'internal',
  REL: 'relationship'
};

const MARKERS: Record<keyof SceneFeatureScores, string[]> = {
  dialogue_ratio: [],
  observation_density: ['빛', '그림자', '냄새', '소리', '차갑', '뜨겁', '희미', '선명', '어둡', '밝', '벽', '문', '창', '공기', '바닥', '천장'],
  action_verb_density: ['잡', '놓', '들', '밀', '당겼', '돌렸', '움직', '고개', '손', '발', '몸', '열었', '닫았', '내려', '올려'],
  exposition_marker_density: ['이유', '때문', '원래', '과거', '사실', '설명', '의미', '구조', '규칙', '조건', '시스템', '따라서'],
  conflict_intensity: ['위험', '비명', '공격', '충돌', '피', '죽', '위협', '압박', '추궁', '거짓말', '분노', '소리쳤', '무너', '도망'],
  movement_marker_density: ['걸', '뛰', '달려', '다가', '물러', '향했', '들어', '나갔', '올라', '내려', '도착', '떠났', '지나'],
  aftermath_marker_density: ['뒤', '후', '끝나', '남았', '가라앉', '정리', '수습', '잠잠', '확인', '숨을 골랐다', '침묵이 남'],
  transition_marker_density: ['잠시', '그 후', '다음', '이윽고', '문득', '한동안', '곧', '다시', '며칠 뒤', '다음 날'],
  internal_judgment_density: ['생각했다', '알았다', '깨달', '느꼈', '듯했다', '같았다', '아마', '어쩌면', '인지도', '결심', '망설'],
  relationship_shift_density: ['선생', '님', '야', '씨', '믿', '오해', '미안', '고마', '거리', '말투', '호칭', '약속', '배신', '용서', '신뢰']
};

const DEFAULT_NEGATIVE_RULES = [
  '원문 고유명사와 사건 구조를 가져오지 않는다.',
  'primary_type의 register를 secondary overlay가 덮어쓰지 않게 한다.',
  '특정 장면의 사물 나열이나 동선 순서를 전역 문체로 반복하지 않는다.'
];
const ACTION_VERB_MARKERS = [...new Set([...MARKERS.action_verb_density, '건넸', '꺼냈', '밀어', '눌렀', '찢', '접', '펼', '멈췄'])].sort();
const JUDGMENT_MARKERS = [...new Set([...MARKERS.internal_judgment_density, '판단', '확신', '의심', '예상', '결론', '선택'])].sort();
const RELATIONSHIP_MARKERS = [...new Set([...MARKERS.relationship_shift_density, '존댓말', '반말', '사과', '거절', '승낙', '경계'])].sort();
const EMOTION_MARKERS = ['슬픔', '불안', '분노', '후회', '두려', '기쁨', '안도', '망설', '당황', '놀라'];

export const STRUCTURED_OUTPUT_SCHEMAS = {
  scene_classification: {
    name: 'scene_classification_correction',
    guard: 'LLM may correct fields but local classifier remains source of truth until manual acceptance.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['scene_id', 'primary_type', 'secondary_types', 'surface_mode', 'style_register', 'confidence', 'reason'],
      properties: {
        scene_id: { type: 'string' },
        primary_type: { type: 'string', enum: ALL_SCENE_TAGS },
        secondary_types: { type: 'array', items: { type: 'string', enum: ALL_SCENE_TAGS }, maxItems: 4 },
        surface_mode: { type: 'string' },
        style_register: { type: 'string' },
        confidence: { type: 'number', minimum: 0, maximum: 1 },
        reason: { type: 'string' },
        manual_override: { type: 'boolean' }
      }
    }
  },
  paragraph_functions: {
    name: 'paragraph_function_tags',
    guard: 'Paragraph tags are explanatory overlays, not scene boundaries by themselves.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['scene_id', 'paragraphs'],
      properties: {
        scene_id: { type: 'string' },
        paragraphs: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['index', 'function', 'evidence'],
            properties: {
              index: { type: 'integer', minimum: 0 },
              function: { type: 'string' },
              evidence: { type: 'string' }
            }
          }
        }
      }
    }
  },
  scoring_explanation: {
    name: 'style_score_explanation',
    guard: 'local_score_used must be true; LLM must not set total_score.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['report_id', 'explanation', 'local_score_used'],
      properties: {
        report_id: { type: 'string' },
        explanation: { type: 'string' },
        local_score_used: { type: 'boolean', const: true },
        risk_notes: { type: 'array', items: { type: 'string' } }
      }
    }
  },
  suggestion: {
    name: 'style_suggestion',
    guard: 'Suggestions require local evidence and cannot invent leakage verdicts.',
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['suggestions', 'score_guard'],
      properties: {
        suggestions: {
          type: 'array',
          items: {
            type: 'object',
            additionalProperties: false,
            required: ['issue', 'suggestion', 'local_evidence'],
            properties: {
              issue: { type: 'string' },
              suggestion: { type: 'string' },
              local_evidence: { type: 'string' }
            }
          }
        },
        score_guard: { type: 'string', enum: ['llm_must_not_set_total_score'] }
      }
    }
  }
} as const;

function stableId(prefix: string, seed = ''): string {
  const source = seed || `${prefix}-${Date.now()}-${Math.random()}`;
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  return `${prefix}_${hash.toString(36).padStart(6, '0')}`;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, Math.round(n * 10000) / 10000));
}

function countMarkers(text: string, markers: string[]): number {
  return markers.reduce((sum, marker) => sum + (text.split(marker).length - 1), 0);
}

function splitSentencesMvp(text: string): string[] {
  const normalized = text.replace(/\r\n/g, '\n').replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?。！？…])\s+|(?<=[다요죠까냐네음임함됨했였었았])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  return parts.length ? parts : [normalized];
}

function dialogueStats(text: string, sentences = splitSentencesMvp(text)): { ratio: number; lineCount: number; quotedSentenceCount: number } {
  const lineCount = text.split('\n').filter((line) => /^\s*(?:[「『“"]|[-—]\s*)/.test(line)).length;
  const quotedSentenceCount = sentences.filter((sentence) => /[「『“"][^」』”"]+[」』”"]/.test(sentence) || /^[-—]\s*/.test(sentence)).length;
  const quoteCharCount = [...text.matchAll(/[「『“"][^」』”"]+[」』”"]/g)].reduce((sum, m) => sum + m[0].length, 0);
  const charRatio = text.replace(/\s/g, '').length ? quoteCharCount / text.replace(/\s/g, '').length : 0;
  return { ratio: Math.max(quotedSentenceCount / Math.max(sentences.length, 1), charRatio), lineCount, quotedSentenceCount };
}

function densityScore(text: string, markers: string[], divisor = 7): number {
  const sentences = splitSentencesMvp(text).length || 1;
  const count = countMarkers(text, markers);
  return clamp01(count / Math.max(divisor, sentences * 1.6));
}

function markerCounts(text: string, markers: string[]): Record<string, number> {
  return Object.fromEntries(markers.map((marker) => [marker, text.split(marker).length - 1]).filter(([, count]) => Number(count) > 0));
}

function topCounts(items: string[], limit = 12): Record<string, number> {
  const counts = new Map<string, number>();
  for (const item of items) counts.set(item, (counts.get(item) ?? 0) + 1);
  return Object.fromEntries([...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'ko')).slice(0, limit));
}

export function analyzeKoreanSurface(text: string, speaker_aliases: string[] = []): KoreanSurfaceReport {
  const eojeol = text.match(/[가-힣A-Za-z0-9]+/g) ?? [];
  const endings = [...text.matchAll(/(습니다|습니까|세요|했다|였다|었다|았다|한다|된다|이다|다|요|죠|까|냐|네|군)(?:[.!?…"”’」』)]|\s|$)/g)].map((m) => m[1]);
  const particles = [...text.matchAll(/[가-힣]+(은|는|이|가|을|를|에|에서|으로|와|과|도|만)(?:\s|$)/g)].map((m) => m[1]);
  const quoted = [...text.matchAll(/[「『“"]([^」』”"]+)[」』”"]/g)].map((m) => m[1]).slice(0, 8);
  const speakerCandidates = [
    ...speaker_aliases.filter((alias) => alias && text.includes(alias)).map((alias) => ({ speaker: alias, count: text.split(alias).length - 1, source: 'provided_alias' })),
    ...RELATIONSHIP_MARKERS.filter((marker) => text.includes(marker) && !speaker_aliases.includes(marker)).map((marker) => ({
      speaker: marker,
      count: text.split(marker).length - 1,
      source: 'relationship_marker'
    }))
  ].slice(0, 12);
  return {
    morphology: {
      eojeol_count: eojeol.length,
      unique_eojeol_ratio: clamp01(new Set(eojeol).size / Math.max(1, eojeol.length)),
      sentence_count: splitSentencesMvp(text).length,
      ending_counts: topCounts(endings),
      particle_counts: topCounts(particles),
      honorific_counts: markerCounts(text, ['습니다', '습니까', '세요', '셨', '께서', '드립니다'])
    },
    action_verbs: markerCounts(text, ACTION_VERB_MARKERS),
    judgment_markers: markerCounts(text, JUDGMENT_MARKERS),
    relationship_markers: markerCounts(text, RELATIONSHIP_MARKERS),
    emotion_markers: markerCounts(text, EMOTION_MARKERS),
    dialogue: {
      quoted_block_count: quoted.length,
      quoted_blocks: quoted,
      manual_speaker_correction_first: true,
      speaker_candidates: speakerCandidates
    }
  };
}

export function computeSceneFeatureScores(scene_text: string): SceneFeatureScores {
  const sentences = splitSentencesMvp(scene_text);
  const dialogue = dialogueStats(scene_text, sentences);
  return {
    dialogue_ratio: clamp01(dialogue.ratio + (dialogue.lineCount > 0 ? 0.15 : 0) + (dialogue.quotedSentenceCount >= 2 ? 0.15 : 0)),
    observation_density: densityScore(scene_text, MARKERS.observation_density, 7),
    action_verb_density: densityScore(scene_text, ACTION_VERB_MARKERS, 7),
    exposition_marker_density: densityScore(scene_text, MARKERS.exposition_marker_density, 5),
    conflict_intensity: densityScore(scene_text, MARKERS.conflict_intensity, 5),
    movement_marker_density: densityScore(scene_text, MARKERS.movement_marker_density, 5),
    aftermath_marker_density: densityScore(scene_text, MARKERS.aftermath_marker_density, 5),
    transition_marker_density: densityScore(scene_text, MARKERS.transition_marker_density, 5),
    internal_judgment_density: densityScore(scene_text, JUDGMENT_MARKERS, 5),
    relationship_shift_density: densityScore(scene_text, RELATIONSHIP_MARKERS, 5)
  };
}

function scoresFromFeatures(features: SceneFeatureScores): Record<SceneTag, number> {
  return {
    DIA: features.dialogue_ratio,
    OBS: features.observation_density,
    ACT: features.action_verb_density,
    INF: features.exposition_marker_density,
    CON: features.conflict_intensity,
    MOV: features.movement_marker_density,
    AFT: features.aftermath_marker_density,
    TRN: features.transition_marker_density,
    INT: features.internal_judgment_density,
    REL: features.relationship_shift_density
  };
}

function selectPrimary(scores: Record<SceneTag, number>): SceneTag {
  const coreRanked = CORE_SCENE_TAGS.map((tag) => [tag, scores[tag]] as const).sort((a, b) => b[1] - a[1]);
  const [coreTag, coreScore] = coreRanked[0];
  const overlayRanked = OVERLAY_TAGS.map((tag) => [tag, scores[tag]] as const).sort((a, b) => b[1] - a[1]);
  const [overlayTag, overlayScore] = overlayRanked[0];
  if (coreScore >= 0.12) return coreTag;
  if (overlayScore >= 0.45 && overlayScore > coreScore + 0.2) return overlayTag;
  return coreTag;
}

function selectSecondary(primary: SceneTag, scores: Record<SceneTag, number>): SceneTag[] {
  const thresholdFor = (tag: SceneTag) => (tag === 'REL' || tag === 'INT' ? 0.24 : 0.34);
  return ALL_SCENE_TAGS
    .filter((tag) => tag !== primary && scores[tag] >= thresholdFor(tag))
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, 4);
}

function inferSurfaceMode(scores: Record<SceneTag, number>): SurfaceMode {
  if (scores.DIA >= 0.42) return 'dialogue-heavy';
  if (scores.INF >= 0.42) return 'exposition-heavy';
  if (scores.ACT >= 0.4 || scores.MOV >= 0.4 || scores.CON >= 0.45) return 'action-heavy';
  if (scores.INT >= 0.42) return 'internal-heavy';
  if (scores.OBS >= 0.3) return 'description-heavy';
  return 'mixed';
}

function narrativeFunctions(primary: SceneTag, secondary: SceneTag[]): NarrativeFunction[] {
  const tags = new Set<SceneTag>([primary, ...secondary]);
  const out: NarrativeFunction[] = [];
  if (tags.has('INF')) out.push('information_reveal');
  if (tags.has('REL')) out.push('relationship_shift');
  if (tags.has('CON')) out.push('tension_escalation');
  if (tags.has('MOV')) out.push('movement');
  if (tags.has('AFT')) out.push('aftermath_processing');
  if (tags.has('TRN')) out.push('scene_transition');
  if (tags.has('INT')) out.push('emotional_shift');
  if (primary === 'ACT') out.push('preparation');
  if (!out.length && primary === 'DIA') out.push('partial_reveal');
  return Array.from(new Set(out)).slice(0, 4);
}

function confidenceFor(primary: SceneTag, scores: Record<SceneTag, number>): number {
  const ranked = ALL_SCENE_TAGS.map((tag) => scores[tag]).sort((a, b) => b - a);
  const top = scores[primary];
  const second = ranked[1] ?? 0;
  return clamp01(0.48 + top * 0.35 + Math.max(0, top - second) * 0.35);
}

export function classifyScene(scene_text: string, metadata: Record<string, unknown> | null = null): SceneClassification {
  const features = computeSceneFeatureScores(scene_text);
  const scores = scoresFromFeatures(features);
  const primary = selectPrimary(scores);
  const secondary = selectSecondary(primary, scores);
  return {
    scene_id: String(metadata?.scene_id ?? metadata?.sceneId ?? 'S001'),
    chapter_id: metadata?.chapter_id || metadata?.chapterId ? String(metadata?.chapter_id ?? metadata?.chapterId) : undefined,
    primary_type: primary,
    secondary_types: secondary,
    surface_mode: inferSurfaceMode(scores),
    narrative_functions: narrativeFunctions(primary, secondary),
    style_register: STYLE_REGISTER_BY_TAG[primary],
    confidence: confidenceFor(primary, scores),
    scores,
    feature_scores: features,
    manual_override: Boolean(metadata?.manual_override ?? metadata?.manualOverride ?? false)
  };
}

export const classify_scene = classifyScene;

const SCOPE_PRIORITY: Record<StyleRouteTarget, number> = {
  manual_override: 1000,
  character_dialogue: 900,
  dialogue: 800,
  scene_id: 700,
  style_register: 650,
  scene_type: 600,
  chapter: 500,
  arc: 400,
  project_default: 300,
  project: 300,
  paragraph_range: 250,
  revision_pass: 200
};

function normalizeCharacter(value: string): string {
  return value.replace(/^character[_:-]/, '').trim();
}

function ruleMatchesContext(rule: StyleRouterRule, context: StyleRouteContext): boolean {
  if (!rule.enabled) return false;
  const value = rule.target_value;
  const classification = context.classification;
  switch (rule.target_type) {
    case 'manual_override':
      return Boolean(context.manual_override_stack_id) && (value === '*' || value === context.manual_override_stack_id || rule.stack_id === context.manual_override_stack_id);
    case 'character_dialogue': {
      if (classification.style_register !== 'dialogue' && classification.primary_type !== 'DIA') return false;
      const target = normalizeCharacter(value);
      return context.character_id === target || (context.dialogue_speakers ?? []).map(normalizeCharacter).includes(target);
    }
    case 'dialogue':
      return classification.primary_type === 'DIA' || classification.style_register === 'dialogue';
    case 'scene_id':
      return value === context.scene_id;
    case 'style_register':
      return value === classification.style_register;
    case 'scene_type':
      return value === classification.primary_type || classification.secondary_types.includes(value as SceneTag);
    case 'chapter':
      return Boolean(context.chapter_id) && value === context.chapter_id;
    case 'arc':
      return Boolean(context.arc_id) && value === context.arc_id;
    case 'project_default':
    case 'project':
      return value === '*' || !context.project_id || value === context.project_id;
    case 'revision_pass':
      return Boolean(context.revision_pass) && value === context.revision_pass;
    case 'paragraph_range':
      return false;
    default:
      return false;
  }
}

function routeSort(a: StyleRouterRule, b: StyleRouterRule): number {
  const scopeDelta = SCOPE_PRIORITY[b.target_type] - SCOPE_PRIORITY[a.target_type];
  if (scopeDelta !== 0) return scopeDelta;
  return b.priority - a.priority;
}

function compatibleOverlay(rule: StyleRouterRule, primary: StyleRouterRule, context: StyleRouteContext): boolean {
  if (rule.stack_id === primary.stack_id) return false;
  if (rule.overlay === false) return false;
  const classification = context.classification;
  if (rule.compatible_scene_types?.length) {
    const sceneTags = [classification.primary_type, ...classification.secondary_types];
    if (!rule.compatible_scene_types.some((tag) => sceneTags.includes(tag))) return false;
  }
  if (rule.compatible_registers?.length && !rule.compatible_registers.includes(classification.style_register)) return false;
  return true;
}

export function resolveActiveStyleStack(context: StyleRouteContext, router: StyleRouter): ActiveStyleStack {
  if (context.manual_override_stack_id) {
    const manualRule: StyleRouterRule = {
      rule_id: 'manual_override_runtime',
      target_type: 'manual_override',
      target_value: context.manual_override_stack_id,
      stack_id: context.manual_override_stack_id,
      priority: SCOPE_PRIORITY.manual_override,
      enabled: true,
      overlay: false
    };
    return {
      primary_stack_id: context.manual_override_stack_id,
      overlay_stack_ids: [],
      matched_rules: [manualRule],
      routing_reason: 'manual_override matched first'
    };
  }

  const matched = router.rules.filter((rule) => ruleMatchesContext(rule, context)).sort(routeSort);
  const primary = matched[0];
  const defaultStack = router.default_stack_id ?? 'stack_default';
  if (!primary) {
    return {
      primary_stack_id: defaultStack,
      overlay_stack_ids: [],
      matched_rules: [],
      routing_reason: 'no rule matched; default stack applied'
    };
  }
  const overlays = matched.slice(1).filter((rule) => compatibleOverlay(rule, primary, context));
  const overlayIds = Array.from(new Set(overlays.map((rule) => rule.stack_id)));
  return {
    primary_stack_id: primary.stack_id,
    overlay_stack_ids: overlayIds,
    matched_rules: [primary, ...overlays],
    routing_reason: `${primary.target_type} matched first${overlayIds.length ? '; compatible overlays applied' : ''}`
  };
}

export const resolve_active_style_stack = resolveActiveStyleStack;

function stackPresets(stack: StyleStack): Record<string, StylePreset> {
  return Object.fromEntries((stack.presets ?? []).map((preset) => [preset.preset_id, preset]));
}

function weightPriority(weight: number, source: StyleRule['source']): number {
  const sourceBoost = source === 'character' ? 40 : source === 'register' ? 30 : source === 'overlay' ? 20 : source === 'global' ? 10 : 0;
  return Math.round(weight * 100) + sourceBoost;
}

function toWeighted(rule: StyleRule, weight: number, source: StyleRule['source'], stack_id: string, preset_id?: string): WeightedStyleRule {
  return {
    ...rule,
    source,
    weight: clamp01(weight),
    priority: weightPriority(weight, source),
    source_stack_id: stack_id,
    source_preset_id: preset_id
  };
}

function pushRules(target: WeightedStyleRule[], rules: StyleRule[] | undefined, weight: number, source: StyleRule['source'], stack: StyleStack, presetId?: string) {
  for (const rule of rules ?? []) target.push(toWeighted(rule, weight, source, stack.stack_id, presetId));
}

function adapterApplies(adapter: StyleStackAdapter, classification: SceneClassification, character_id?: string): boolean {
  if (adapter.enabled === false) return false;
  if (adapter.compatible_scene_types?.length) {
    const sceneTags = [classification.primary_type, ...classification.secondary_types];
    if (!adapter.compatible_scene_types.some((tag) => sceneTags.includes(tag))) return false;
  }
  if (adapter.compatible_registers?.length && !adapter.compatible_registers.includes(classification.style_register)) return false;
  if (adapter.scope.startsWith('character:')) return Boolean(character_id) && adapter.scope === `character:${character_id}`;
  if (adapter.scope === 'global') return true;
  if (adapter.scope === classification.style_register) return true;
  if (adapter.scope === classification.primary_type) return true;
  if (classification.secondary_types.includes(adapter.scope as SceneTag)) return true;
  if (adapter.scope === 'dialogue') return classification.style_register === 'dialogue' || classification.primary_type === 'DIA';
  if (adapter.scope === 'conflict') return classification.primary_type === 'CON' || classification.secondary_types.includes('CON');
  return false;
}

function uniqueByInstruction(rules: WeightedStyleRule[], policy: StyleStack['conflict_policy']): WeightedStyleRule[] {
  const map = new Map<string, WeightedStyleRule>();
  for (const rule of rules) {
    const key = rule.instruction.trim();
    const prev = map.get(key);
    if (!prev) {
      map.set(key, rule);
      continue;
    }
    if (policy === 'higher_weight') {
      if (rule.weight > prev.weight) map.set(key, rule);
    } else if (rule.priority > prev.priority) {
      map.set(key, rule);
    }
  }
  return [...map.values()].sort((a, b) => b.priority - a.priority);
}

function limitRules(buckets: Array<WeightedStyleRule[]>, max: number) {
  let total = buckets.reduce((sum, bucket) => sum + bucket.length, 0);
  while (total > max) {
    const sortedBuckets = buckets.map((bucket, idx) => ({ idx, len: bucket.length })).sort((a, b) => b.len - a.len);
    const target = sortedBuckets.find((item) => item.len > 0);
    if (!target) return;
    buckets[target.idx].pop();
    total--;
  }
}

export function mergeStyleStack(
  stack: StyleStack,
  scene_classification: SceneClassification,
  character_id: string | null = null,
  token_budget = 1200
): MergedStyleRules {
  const diagnostics: string[] = [];
  const global_rules: WeightedStyleRule[] = [];
  const register_rules: WeightedStyleRule[] = [];
  const overlay_rules: WeightedStyleRule[] = [];
  const character_rules: WeightedStyleRule[] = [];
  const negativeSet = new Set<string>([...DEFAULT_NEGATIVE_RULES, ...(stack.negative_rules ?? [])]);
  const presets = stackPresets(stack);

  pushRules(global_rules, stack.global_rules, 1, 'global', stack);
  pushRules(register_rules, stack.register_rules?.[scene_classification.style_register], 1, 'register', stack);
  for (const tag of scene_classification.secondary_types) pushRules(overlay_rules, stack.overlay_rules?.[tag], 0.8, 'overlay', stack);
  if (character_id) pushRules(character_rules, stack.character_rules?.[character_id], 1, 'character', stack);

  for (const adapter of stack.adapters) {
    if (!adapterApplies(adapter, scene_classification, character_id ?? undefined)) continue;
    const preset = presets[adapter.preset_id];
    const weight = adapter.weight;
    if (adapter.scope === 'global' || adapter.role === 'base') pushRules(global_rules, preset?.global_rules, weight, 'global', stack, adapter.preset_id);
    pushRules(register_rules, preset?.register_rules?.[scene_classification.style_register], weight, 'register', stack, adapter.preset_id);
    for (const tag of scene_classification.secondary_types) pushRules(overlay_rules, preset?.overlay_rules?.[tag], weight * 0.9, 'overlay', stack, adapter.preset_id);
    if (character_id) pushRules(character_rules, preset?.character_rules?.[character_id], weight, 'character', stack, adapter.preset_id);
    pushRules(overlay_rules, adapter.rule_overrides, weight, 'overlay', stack, adapter.preset_id);
    for (const rule of preset?.negative_rules ?? []) negativeSet.add(rule);
  }

  const resolvedGlobal = uniqueByInstruction(global_rules, stack.conflict_policy);
  const resolvedRegister = uniqueByInstruction(register_rules, stack.conflict_policy);
  const resolvedOverlay = uniqueByInstruction(overlay_rules, stack.conflict_policy);
  const resolvedCharacter = uniqueByInstruction(character_rules, stack.conflict_policy);
  const maxByBudget = Math.max(4, Math.min(stack.max_active_rules, Math.floor(token_budget / 45)));
  limitRules([resolvedCharacter, resolvedRegister, resolvedOverlay, resolvedGlobal], maxByBudget);

  if (scene_classification.secondary_types.length) diagnostics.push('secondary_types applied as overlays only');
  if (stack.conflict_policy) diagnostics.push(`conflict_policy=${stack.conflict_policy}`);

  return {
    stack_id: stack.stack_id,
    global_rules: resolvedGlobal,
    register_rules: resolvedRegister,
    overlay_rules: resolvedOverlay,
    character_rules: resolvedCharacter,
    negative_rules: [...negativeSet],
    diagnostics,
    active_rule_count: resolvedGlobal.length + resolvedRegister.length + resolvedOverlay.length + resolvedCharacter.length
  };
}

export const merge_style_stack = mergeStyleStack;

function stacksById(stacks: StyleGenerationContext['stacks']): Record<string, StyleStack> {
  return Array.isArray(stacks) ? Object.fromEntries(stacks.map((stack) => [stack.stack_id, stack])) : stacks;
}

function instructions(rules: WeightedStyleRule[], limit: number): string[] {
  return rules
    .sort((a, b) => b.priority - a.priority)
    .slice(0, limit)
    .map((rule) => rule.instruction);
}

export function buildPromptCapsule(
  context: StyleGenerationContext,
  active_stack: ActiveStyleStack,
  max_rules = 18,
  token_budget = 1200
): PromptCapsule {
  const map = stacksById(context.stacks);
  const stackIds = [active_stack.primary_stack_id, ...active_stack.overlay_stack_ids];
  const merged = stackIds
    .map((id) => map[id])
    .filter(Boolean)
    .map((stack) => mergeStyleStack(stack, context.scene_classification, context.focus_character ?? null, token_budget));

  const global = merged.flatMap((m) => m.global_rules);
  const register = merged.flatMap((m) => m.register_rules);
  const overlay = merged.flatMap((m) => m.overlay_rules);
  const character = merged.flatMap((m) => m.character_rules);
  const negatives = [...new Set(merged.flatMap((m) => m.negative_rules).concat(DEFAULT_NEGATIVE_RULES))];
  const fewshots = [...new Set(stackIds.flatMap((id) => map[id]?.fewshot_refs ?? []))].slice(0, 2);

  const characterBudget = Math.min(4, max_rules);
  const registerBudget = Math.min(6, Math.max(0, max_rules - characterBudget));
  const overlayBudget = Math.min(4, Math.max(0, max_rules - characterBudget - registerBudget));
  const globalBudget = Math.max(0, max_rules - characterBudget - registerBudget - overlayBudget);

  return {
    active_stack: active_stack.primary_stack_id,
    scene_type: context.scene_classification.primary_type,
    style_register: context.scene_classification.style_register,
    secondary_types: context.scene_classification.secondary_types,
    global_rules: instructions(global, globalBudget || 5),
    register_rules: instructions(register, registerBudget),
    overlay_rules: instructions(overlay, overlayBudget),
    character_rules: instructions(character, characterBudget),
    negative_rules: negatives.slice(0, 8),
    fewshot_refs: fewshots,
    self_checklist: [
      'primary_type의 style_register가 유지됐는가?',
      'secondary_types는 overlay로만 반영됐는가?',
      '원문 고유명사·사건 구조·특정 장면 사물이 누수되지 않았는가?',
      '문체 규칙 때문에 새 장면의 내용이 훼손되지 않았는가?'
    ]
  };
}

export const build_prompt_capsule = buildPromptCapsule;

function textMetrics(text: string): Required<StyleMetricsBaseline> & { sentence_count: number; comma_per_sentence: number } {
  const sentences = splitSentencesMvp(text);
  const lens = sentences.map((s) => s.replace(/\s/g, '').length);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const short = lens.filter((l) => l <= 20).length;
  const long = lens.filter((l) => l >= 60).length;
  const dialogue = dialogueStats(text, sentences);
  return {
    avg_sentence_len: Math.round(avg * 10) / 10,
    short_sentence_ratio: sentences.length ? short / sentences.length : 0,
    long_sentence_ratio: sentences.length ? long / sentences.length : 0,
    dialogue_ratio: dialogue.ratio,
    paragraph_count: text.split(/\n\s*\n/).filter((p) => p.trim()).length,
    sentence_count: sentences.length,
    comma_per_sentence: (text.match(/[,、，]/g) ?? []).length / Math.max(1, sentences.length)
  };
}

function profileRules(style_profile: StyleProfile | StylePreset | StyleStack): {
  global: StyleRule[];
  register: Partial<Record<StyleRegister, StyleRule[]>>;
  negative: string[];
  contentTerms: string[];
  baseline?: StyleMetricsBaseline;
} {
  if ('profile_id' in style_profile) {
    return {
      global: style_profile.global_rules,
      register: style_profile.register_rules,
      negative: style_profile.negative_rules,
      contentTerms: style_profile.content_terms,
      baseline: style_profile.metrics_baseline
    };
  }
  if ('preset_id' in style_profile) {
    return {
      global: style_profile.global_rules,
      register: style_profile.register_rules,
      negative: style_profile.negative_rules,
      contentTerms: style_profile.content_terms ?? [],
      baseline: style_profile.metrics_baseline
    };
  }
  return {
    global: style_profile.global_rules ?? [],
    register: style_profile.register_rules ?? {},
    negative: style_profile.negative_rules ?? [],
    contentTerms: style_profile.presets?.flatMap((preset) => preset.content_terms ?? []) ?? [],
    baseline: style_profile.presets?.find((preset) => preset.metrics_baseline)?.metrics_baseline
  };
}

function roughInstructionFit(text: string, rules: StyleRule[]): number {
  if (!rules.length) return 0.72;
  const hitWords = new Set<string>();
  const textWords = new Set((text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).map((w) => w.toLowerCase()));
  for (const rule of rules) {
    for (const word of rule.instruction.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []) {
      if (textWords.has(word.toLowerCase())) hitWords.add(word.toLowerCase());
    }
  }
  return clamp01(0.55 + Math.min(0.35, hitWords.size * 0.035));
}

function rhythmFit(text: string, baseline?: StyleMetricsBaseline): number {
  if (!baseline) return 0.72;
  const m = textMetrics(text);
  const diffs: number[] = [];
  if (baseline.avg_sentence_len) diffs.push(Math.min(1, Math.abs(m.avg_sentence_len - baseline.avg_sentence_len) / Math.max(10, baseline.avg_sentence_len)));
  if (baseline.short_sentence_ratio !== undefined) diffs.push(Math.min(1, Math.abs(m.short_sentence_ratio - baseline.short_sentence_ratio)));
  if (baseline.long_sentence_ratio !== undefined) diffs.push(Math.min(1, Math.abs(m.long_sentence_ratio - baseline.long_sentence_ratio)));
  if (!diffs.length) return 0.72;
  return clamp01(1 - diffs.reduce((a, b) => a + b, 0) / diffs.length);
}

function discourseFit(expected: SceneClassification | null, inferred: SceneClassification): number {
  if (!expected) return 0.7;
  const expectedFunctions = new Set(expected.narrative_functions);
  const inferredFunctions = new Set(inferred.narrative_functions);
  const covered = [...expectedFunctions].filter((fn) => inferredFunctions.has(fn)).length / Math.max(1, expectedFunctions.size);
  let featureAlignment = 0;
  if (expectedFunctions.has('information_reveal')) featureAlignment += inferred.feature_scores.exposition_marker_density * 0.35;
  if (expectedFunctions.has('movement')) featureAlignment += inferred.feature_scores.movement_marker_density * 0.35;
  if (expectedFunctions.has('tension_escalation')) featureAlignment += inferred.feature_scores.conflict_intensity * 0.35;
  if (expectedFunctions.has('relationship_shift')) featureAlignment += inferred.feature_scores.relationship_shift_density * 0.35;
  if (expectedFunctions.has('emotional_shift')) featureAlignment += inferred.feature_scores.internal_judgment_density * 0.25;
  if (expectedFunctions.has('scene_transition')) featureAlignment += inferred.feature_scores.transition_marker_density * 0.3;
  return clamp01(0.48 + covered * 0.32 + Math.min(0.2, featureAlignment));
}

function dialogueFit(inferred: SceneClassification, expected: SceneClassification | null, baseline?: StyleMetricsBaseline): number {
  if (expected?.style_register === 'dialogue') return clamp01(0.45 + inferred.scores.DIA * 0.55);
  if (baseline?.dialogue_ratio !== undefined) return clamp01(1 - Math.min(1, Math.abs(inferred.scores.DIA - baseline.dialogue_ratio)));
  return clamp01(0.82 - Math.max(0, inferred.scores.DIA - 0.35) * 0.45);
}

function leakageHits(text: string, terms: string[]): string[] {
  return [...new Set(terms.filter((term) => term && text.includes(term)))].sort();
}

function leakagePenaltyForHits(hits: string[]): number {
  return clamp01(Math.min(0.35, hits.length * 0.05));
}

function repeatedNgramRatio(text: string, n = 3): number {
  const words = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  const grams = Array.from({ length: Math.max(0, words.length - n + 1) }, (_, i) => words.slice(i, i + n).join(' '));
  if (!grams.length) return 0;
  const counts = topCounts(grams, grams.length);
  const repeated = Object.values(counts).reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return repeated / grams.length;
}

function lexicalFit(text: string, rules: StyleRule[], contentTerms: string[]): number {
  const words = text.match(/[가-힣A-Za-z0-9]{2,}/g) ?? [];
  if (!words.length) return 0.2;
  const uniqueRatio = new Set(words).size / words.length;
  const ruleWords = new Set(rules.flatMap((rule) => rule.instruction.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).map((word) => word.toLowerCase()));
  const textWords = new Set(words.map((word) => word.toLowerCase()));
  const contact = [...ruleWords].filter((word) => textWords.has(word)).length / Math.max(1, Math.min(ruleWords.size, 12));
  const leakCount = leakageHits(text, contentTerms).length;
  return clamp01(0.42 + Math.min(0.3, uniqueRatio * 0.35) + Math.min(0.2, contact * 0.2) - Math.min(0.22, leakCount * 0.04));
}

function fluencyScore(text: string): number {
  if (!text.trim()) return 0.2;
  const m = textMetrics(text);
  const punctuationNoise = (text.match(/[!?]{3,}|…{4,}/g) ?? []).length;
  let score = 1;
  if (m.avg_sentence_len < 6 || m.avg_sentence_len > 95) score -= 0.25;
  if (m.comma_per_sentence > 4) score -= 0.15;
  score -= Math.min(0.25, punctuationNoise * 0.05);
  score -= Math.min(0.3, repeatedNgramRatio(text, 2) * 0.9);
  return clamp01(score);
}

function overfitPenalty(text: string, hits: string[]): number {
  const sentences = splitSentencesMvp(text).map((sentence) => sentence.replace(/\s+/g, ''));
  const repeatedSentences = sentences.length - new Set(sentences).size;
  const repeatedLeakage = hits.reduce((sum, term) => sum + Math.max(0, text.split(term).length - 2), 0);
  return clamp01(Math.min(0.28, repeatedNgramRatio(text, 3) * 0.6 + repeatedSentences * 0.05 + repeatedLeakage * 0.025));
}

function registerMismatchPenalty(text: string, expected?: SceneClassification): number {
  if (!expected) return 0;
  const actual = classifyScene(text, { scene_id: expected.scene_id, chapter_id: expected.chapter_id });
  if (actual.primary_type === expected.primary_type) return 0;
  if (actual.style_register === expected.style_register) return 0.04;
  return 0.12;
}

export function scoreStyleMatch(
  text: string,
  style_profile: StyleProfile | StylePreset | StyleStack,
  scene_classification: SceneClassification | null = null
): StyleMatchReport {
  const profile = profileRules(style_profile);
  const inferred = classifyScene(text, scene_classification ? { scene_id: scene_classification.scene_id } : null);
  const registerRules = scene_classification ? profile.register[scene_classification.style_register] ?? [] : [];
  const global_fit = roughInstructionFit(text, profile.global);
  const register_fit = scene_classification ? roughInstructionFit(text, registerRules) : 0.7;
  const scene_classification_fit = scene_classification
    ? clamp01(inferred.primary_type === scene_classification.primary_type ? 1 : inferred.style_register === scene_classification.style_register ? 0.78 : 0.55)
    : 0.7;
  const rhythm = rhythmFit(text, profile.baseline);
  const dialogue_fit = dialogueFit(inferred, scene_classification, profile.baseline);
  const hits = leakageHits(text, profile.contentTerms);
  const leakage = leakagePenaltyForHits(hits);
  const registerPenalty = registerMismatchPenalty(text, scene_classification ?? undefined);
  const overfit = overfitPenalty(text, hits);
  const stack_blend_fit = 'stack_id' in style_profile ? clamp01(0.62 + Math.min(0.28, (style_profile.adapters ?? []).filter((adapter) => adapter.enabled !== false).length * 0.06)) : 0.7;
  const discourse_fit = discourseFit(scene_classification, inferred);
  const lexical_fit = lexicalFit(text, [...profile.global, ...registerRules], profile.contentTerms);
  const fluency = fluencyScore(text);
  const total = clamp01(
    global_fit * 0.2 +
      register_fit * 0.2 +
      scene_classification_fit * 0.1 +
      stack_blend_fit * 0.1 +
      rhythm * 0.12 +
      discourse_fit * 0.13 +
      dialogue_fit * 0.08 +
      lexical_fit * 0.05 +
      fluency * 0.07 -
      leakage -
      registerPenalty -
      overfit
  );
  const diagnostics = [
    `inferred_primary=${inferred.primary_type}`,
    `expected_primary=${scene_classification?.primary_type ?? 'not_provided'}`,
    `leakage_hits=${hits.length}`,
    `register_mismatch_penalty=${registerPenalty}`,
    `discourse_fit=${discourse_fit}`,
    `lexical_fit=${lexical_fit}`,
    `fluency=${fluency}`,
    `overfit_penalty=${overfit}`
  ];
  return {
    report_id: stableId('style_report', `${text.slice(0, 120)}:${Date.now()}`),
    total_score: total,
    global_fit,
    register_fit,
    scene_classification_fit,
    stack_blend_fit,
    rhythm_fit: rhythm,
    discourse_fit,
    dialogue_fit,
    lexical_fit,
    fluency,
    leakage_penalty: leakage,
    register_mismatch_penalty: registerPenalty,
    overfit_penalty: overfit,
    diagnostics
  };
}

export const score_style_match = scoreStyleMatch;

function mdList(items: string[]): string {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- (none)';
}

function presetMarkdown(preset: StylePreset): string {
  return [
    `# ${preset.name}`,
    '',
    `- preset_id: ${preset.preset_id}`,
    `- type: ${preset.preset_type}`,
    `- default_strength: ${preset.default_strength}`,
    '',
    '## Compact instruction',
    preset.compact_instruction || '(none)',
    '',
    '## Global rules',
    mdList(preset.global_rules.map((r) => r.instruction)),
    '',
    '## Register rules',
    ...Object.entries(preset.register_rules).flatMap(([register, rules]) => [`### ${register}`, mdList((rules ?? []).map((r) => r.instruction)), '']),
    '## Negative rules',
    mdList(preset.negative_rules)
  ].join('\n');
}

function stackMarkdown(stack: StyleStack): string {
  return [
    `# ${stack.name}`,
    '',
    `- stack_id: ${stack.stack_id}`,
    `- conflict_policy: ${stack.conflict_policy}`,
    `- max_active_rules: ${stack.max_active_rules}`,
    '',
    '## Adapters',
    stack.adapters.map((a) => `- ${a.preset_id}: role=${a.role}, scope=${a.scope}, weight=${a.weight}`).join('\n') || '- (none)',
    '',
    '## Negative rules',
    mdList(stack.negative_rules ?? [])
  ].join('\n');
}

function routerMarkdown(router: StyleRouter): string {
  return [
    '# Style Router',
    '',
    `- router_id: ${router.router_id}`,
    `- default_stack_id: ${router.default_stack_id ?? 'stack_default'}`,
    '',
    '## Priority',
    'manual_override > character_dialogue > dialogue > scene_id > style_register > scene_type > chapter > arc > project_default',
    '',
    '## Rules',
    router.rules
      .filter((rule) => rule.enabled)
      .sort(routeSort)
      .map((rule) => `- ${rule.rule_id}: ${rule.target_type}=${rule.target_value} -> ${rule.stack_id} (priority ${rule.priority})`)
      .join('\n') || '- (none)'
  ].join('\n');
}

function referencePolicyMarkdown(): string {
  return [
    '# Reference Loading Policy',
    '',
    '- Load preset and stack markdown only for the active route.',
    '- Load at most two few-shot references per prompt capsule.',
    '- Do not load more than 12 few-shot files across a single task.',
    '- Keep total few-shot bytes under 120000.',
    '- Treat source names, proper nouns, object lists, choreography, and event order as content, not style.',
    '- LLM output may explain or suggest changes, but it must not set the authoritative StyleMatchScore.'
  ].join('\n');
}

function regressionFixture(project_id: string, presets: StylePreset[], stacks: StyleStack[], router: StyleRouter): string {
  return JSON.stringify(
    {
      schema_version: 'bindery.style.skillpack.regression.v1',
      project_id,
      checks: [
        {
          name: 'dialogue_relationship_overlay',
          scene_text: '“선생님, 이 자료를 믿어도 됩니까?”\n“아직은요. 그래도 당신 말은 확인하겠습니다.”\n그 호칭은 조금 가까워져 있었다.',
          expected_primary_type: 'DIA',
          expected_secondary_type: 'REL',
          score_guard: 'local_runtime_authoritative'
        },
        {
          name: 'sentence_blocks_grouped',
          scene_text: '에이라는 말없이 자료를 넘겼다.\n\n그 시선은 서류 아래쪽에서 멈췄다.\n\n주인공은 고개를 끄덕였다.\n\n잠시 뒤 방 안의 공기가 낮게 가라앉았다.',
          expected_note: 'Sentence-separated samples are not one sentence per scene.'
        }
      ],
      preset_count: presets.length,
      stack_count: stacks.length,
      router_rule_count: router.rules.length
    },
    null,
    2
  );
}

export function buildStyleSkillPackFiles(project_id: string, presets: StylePreset[], stacks: StyleStack[], router: StyleRouter): StyleSkillPackFile[] {
  const files: StyleSkillPackFile[] = [];
  files.push({
    path: 'SKILL.md',
    content: [
      '---',
      'name: bindery-style-runtime',
      'description: apply bindery style presets, style stacks, scene classification, style routing, prompt capsules, scoring, and leakage checks for Korean fiction drafting.',
      '---',
      '',
      '# Bindery Style Runtime',
      '',
      'Use saved style presets as reusable writing adapters. Apply abstract style rules only; do not imitate source text directly.',
      '',
      '## Workflow',
      '1. Load `references/preset-index.md`.',
      '2. Classify the scene with `references/scene-classification.md` when no scene type is given.',
      '3. Resolve the active stack with `references/style-router.md`.',
      '4. Build a compact Style Capsule from active stack, scene register, overlays, character rules, negative rules, and at most two few-shot references.',
      '5. Run leakage, register, and scene-classification checks before final output.'
    ].join('\n')
  });
  files.push({ path: 'agents/openai.yaml', content: 'name: bindery-style-runtime\nversion: 1\n' });
  files.push({
    path: 'references/preset-index.md',
    content: ['# Preset Index', '', `Project: ${project_id}`, '', ...presets.map((preset) => `- ${preset.preset_id}: ${preset.name} (${preset.preset_type})`)].join('\n')
  });
  files.push({
    path: 'references/scene-classification.md',
    content: [
      '# Scene Classification',
      '',
      'Tags: OBS observation, DIA dialogue, ACT action, INF information, CON conflict, MOV movement, AFT aftermath, TRN transition, INT internal overlay, REL relationship overlay.',
      '',
      'Primary type chooses the main style_register. Secondary types are overlays only and must not overwrite the primary register.',
      '',
      'Feature scores: dialogue_ratio, observation_density, action_verb_density, exposition_marker_density, conflict_intensity, movement_marker_density, aftermath_marker_density, transition_marker_density, internal_judgment_density, relationship_shift_density.'
    ].join('\n')
  });
  files.push({ path: 'references/style-router.md', content: routerMarkdown(router) });
  files.push({
    path: 'references/writing-workflow.md',
    content: '# Writing Workflow\n\nBuild PromptCapsule, draft or rewrite, then check leakage and register mismatch. Preserve new user content unless rewrite strength is strong.'
  });
  files.push({
    path: 'references/scoring-rubric.md',
    content: '# Scoring Rubric\n\nStyleMatchScore = GlobalFit*0.20 + RegisterFit*0.20 + SceneClassificationFit*0.10 + StackBlendFit*0.10 + RhythmFit*0.12 + DiscourseFit*0.13 + DialogueFit*0.08 + LexicalFit*0.05 + Fluency*0.07 - ContentLeakagePenalty - RegisterMismatchPenalty - OverfitPenalty.'
  });
  files.push({
    path: 'references/leakage-rules.md',
    content: ['# Leakage Rules', '', ...DEFAULT_NEGATIVE_RULES.map((rule) => `- ${rule}`)].join('\n')
  });
  files.push({ path: 'references/reference-policy.md', content: referencePolicyMarkdown() });
  files.push({ path: 'references/regression-fixture.json', content: regressionFixture(project_id, presets, stacks, router) });
  files.push({ path: 'references/structured-output-schemas.json', content: JSON.stringify(STRUCTURED_OUTPUT_SCHEMAS, null, 2) });
  files.push({
    path: 'references/korean-nlp-markers.json',
    content: JSON.stringify(
      {
        action_verbs: ACTION_VERB_MARKERS,
        judgment_markers: JUDGMENT_MARKERS,
        relationship_markers: RELATIONSHIP_MARKERS,
        emotion_markers: EMOTION_MARKERS,
        speaker_policy: 'speaker_candidates_are_not_authoritative_manual_correction_first'
      },
      null,
      2
    )
  });
  files.push({
    path: 'scripts/validate_skill_pack.py',
    content: [
      '#!/usr/bin/env python3',
      'from pathlib import Path',
      'import json, sys',
      "REQUIRED = ['SKILL.md','agents/openai.yaml','references/reference-policy.md','references/regression-fixture.json','references/structured-output-schemas.json','references/korean-nlp-markers.json']",
      'root = Path(sys.argv[1] if len(sys.argv) > 1 else ".")',
      "errors = [f'missing {rel}' for rel in REQUIRED if not (root / rel).exists()]",
      "fixture = root / 'references/regression-fixture.json'",
      'if fixture.exists():',
      '    try: json.loads(fixture.read_text(encoding="utf-8"))',
      "    except json.JSONDecodeError as exc: errors.append(f'invalid regression fixture: {exc}')",
      "print(json.dumps({'ok': not errors, 'errors': errors}, ensure_ascii=False, indent=2))",
      'raise SystemExit(0 if not errors else 1)'
    ].join('\n')
  });
  for (const preset of presets) files.push({ path: `references/presets/${preset.preset_id}.md`, content: presetMarkdown(preset) });
  for (const stack of stacks) files.push({ path: `references/stacks/${stack.stack_id}.md`, content: stackMarkdown(stack) });
  return files;
}
