export type SceneType =
  | 'observation'
  | 'dialogue'
  | 'exposition'
  | 'movement'
  | 'conflict'
  | 'aftermath'
  | 'quiet_transition';

export type EvidenceLevel =
  | 'local'
  | 'register_specific'
  | 'global_medium'
  | 'global_strong'
  | 'uncertain'
  | 'prohibited';

export type AnalysisProcedureStep = {
  id: 'normalize' | 'segment' | 'code' | 'evidence' | 'globality' | 'surface' | 'capsule' | 'semantic_ai';
  label: string;
  owner: 'local' | 'ai';
  output: string;
};

export const STYLE_ANALYSIS_PROCEDURE: AnalysisProcedureStep[] = [
  { id: 'normalize', label: '입력 정규화', owner: 'local', output: '언어, 문단, 대사 신호' },
  { id: 'segment', label: '장면 후보 분할', owner: 'local', output: '문단 기반 scene 후보' },
  { id: 'code', label: '장면 feature 코딩', owner: 'local', output: '박자, 마감, 대사, 표층' },
  { id: 'evidence', label: '규칙 후보 생성', owner: 'local', output: '반복 feature 기반 F_RULE' },
  { id: 'globality', label: '전역성 판정', owner: 'local', output: 'global, register, local 분리' },
  { id: 'surface', label: '표층 프로필 집계', owner: 'local', output: '어미, 조사, 인용부호, 대사태그' },
  { id: 'capsule', label: '프롬프트 캡슐', owner: 'local', output: '전이 가능 규칙과 금지 전이' },
  { id: 'semantic_ai', label: '감성 해석', owner: 'ai', output: '호흡, 온도, 거리감, 묘사의 결' }
];

export type Span = {
  startParagraph: number;
  endParagraph: number;
};

export type InputProfile = {
  inputId: string;
  title?: string;
  mainLanguage: 'ko' | 'ja' | 'mixed' | 'unknown';
  insertedLanguages: Array<'ko' | 'ja' | 'mixed' | 'unknown'>;
  paragraphCount: number;
  estimatedSceneCount: number;
  hasDialogue: boolean;
  hasJapaneseInsertions: boolean;
  normalizationNotes: string[];
};

export type SceneRecord = {
  sceneId: string;
  span: Span;
  sceneTypes: SceneType[];
  languageMix: Record<string, string>;
  boundaryReason: string[];
  sceneFunction: string;
  narrationDistance: {
    emotionDistance: 'direct_naming' | 'indirect_or_deferred' | 'neutral_or_unmarked';
    directEmotionMarkers: string[];
    judgmentDelayMarkers: string[];
    emotionIndirectSignalCount: number;
  };
  informationDistribution: {
    immediate: string[];
    delayed: string[];
  };
  pacing: {
    sentenceCount: number;
    avgSentenceChars: number;
    shortSentenceRatio: number;
    longSentenceRatio: number;
    durationType: 'short_burst' | 'medium_controlled' | 'compressed_long_sentence';
  };
  transition: {
    closingDevice: 'action' | 'sensory' | 'dialogue' | 'judgment_delay' | 'question' | 'emphasis' | 'statement' | 'unknown';
    lastSentence: string;
    transitionMarkers: string[];
  };
  dialogue: {
    hasDialogue: boolean;
    quoteMarkCount: number;
    quoteMarks: Record<string, number>;
    dialogueLineCount: number;
    dialogueSentenceCount: number;
    dialogueSentenceRatio: number;
    dialogueTagCounts: Record<string, number>;
  };
  surfaceFeatures: {
    sentenceEndings: Record<string, number>;
    ellipsisCount: number;
    questionCount: number;
    exclamationCount: number;
    particleCounts: Record<string, number>;
  };
  notes: string;
};

export type StyleEvidenceRecord = {
  featureId: string;
  candidateRule: string;
  axis: string;
  supportingScenes: string[];
  supportingSceneTypes: SceneType[];
  counterexamples: string[];
  contentIndependence: number;
  languageDependence: Record<string, string>;
  leakageRisk: 'low' | 'medium' | 'high';
  globalityDecision: EvidenceLevel;
  confidence: number;
};

export type SurfaceFeatureSet = {
  sentenceEndings: Record<string, number>;
  particles: Record<string, number>;
  honorificMarkers: Record<string, number>;
  addressTerms: Record<string, number>;
  quotationMarkers: Record<string, number>;
  ellipsisMarkers: number;
  dialogueTagCounts: Record<string, number>;
  paragraphClosingDevices: Record<string, number>;
};

export type LanguageSurfaceProfile = {
  profileId: string;
  sourceInputId: string;
  ko: SurfaceFeatureSet;
  ja: SurfaceFeatureSet;
  functionalEquivalence: Array<{ surface: string; function: string }>;
  notes: string[];
};

export type PromptCapsuleV3 = {
  capsuleId: string;
  activeSceneTypes: SceneType[];
  evidenceBackedGlobalRules: string[];
  registerRules: Record<string, string[]>;
  languageSurfaceRules: Record<string, string[]>;
  doNotTransfer: string[];
  selfCheck: string[];
  maxTokensHint: number;
};

export type StyleAnalysisBundle = {
  schemaVersion: 'bindery.style.analysis.v3';
  inputProfile: InputProfile;
  sceneRecords: SceneRecord[];
  evidenceRecords: StyleEvidenceRecord[];
  languageSurfaceProfile: LanguageSurfaceProfile;
  promptCapsules: PromptCapsuleV3[];
};

const JA_RE = /[\u3040-\u30ff]/u;
const JA_QUOTED_CJK_RE = /[「『][^」』]*[\u4e00-\u9fff][^」』]*[」』]/u;
const DIALOGUE_RE = /[「『“"]|[”"』」]/u;
const DIALOGUE_LINE_RE = /^\s*[「『“"].+[」』”"]?/gmu;
const KO_ENDING_RE =
  /(뿐이었다|모양이었다|듯했다|했습니다|합니다|이었다|했다|였다|었다|았다|한다|된다|이다|다|요|죠|까|냐|네|군)[.!?…"'”’」』)]*$/u;

const CONFLICT_MARKERS = ['갑자기', '그때', '위험', '비명', '피', '죽', '공격', '충돌', '무너', '도망', '쫓'];
const MOVEMENT_MARKERS = ['걸', '뛰', '달려', '다가', '물러', '돌아', '올라', '내려', '나갔', '들어', '향했'];
const EXPOSITION_MARKERS = ['이유', '때문', '원래', '과거', '사실', '설명', '의미', '구조', '규칙', '시스템'];
const AFTERMATH_MARKERS = ['뒤', '후', '끝나', '남았', '가라앉', '정리', '침묵', '잠잠', '숨을 골랐다'];
const TRANSITION_MARKERS = ['잠시', '그 후', '다음', '이윽고', '문득', '한동안', '곧', '다시'];
const ACTION_MARKERS = ['봤', '보았다', '돌렸', '잡았', '놓았', '들었', '내렸', '움직', '고개', '손', '발', '몸'];
const SENSORY_MARKERS = ['차갑', '뜨겁', '희미', '어둡', '밝', '조용', '소리', '냄새', '빛', '그림자', '무겁', '선명'];
const DIRECT_EMOTION_MARKERS = ['슬펐', '기뻤', '화가', '두려', '무서', '불안', '외로', '행복', '짜증', '분노', '후회'];
const JUDGMENT_DELAY_MARKERS = ['듯했다', '듯싶', '모양', '같았', '아마', '어쩌면', '인지도', '뿐이었다'];
const DIALOGUE_TAG_MARKERS = ['말했다', '물었다', '대답했다', '중얼거렸다', '웃었다', '속삭였다', '외쳤다', '덧붙였다'];
const PARTICLE_MARKERS = ['은', '는', '이', '가', '을', '를', '에', '에서', '으로', '와', '과', '도', '만'];
const HONORIFIC_MARKERS = ['습니다', '습니까', '세요', '셨', '께서', '드렸', '드립니다'];
const ADDRESS_TERMS = ['선생', '님', '형', '누나', '오빠', '언니', '야', '씨', '각하', '대장'];

function id(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}

export function paragraphCandidates(rawText: string): string[] {
  return rawText
    .replace(/\r\n/g, '\n')
    .replace(/\n\s*(?:\*\s*\*\s*\*|---+|#{1,3}\s+[^\n]*)\s*\n/g, '\n\n')
    .trim()
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export function splitSentences(text: string): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return [];
  const parts = normalized
    .split(/(?<=[.!?。！？…])\s+|(?<=[다요죠까냐네음임함됨했였었았])\s+/u)
    .map((part) => part.trim())
    .filter((part) => part.length > 1);
  if (parts.length <= 1) return text.split(/\n+/).map((part) => part.trim()).filter((part) => part.length > 1);
  return parts;
}

function countContains(text: string, markers: string[]): number {
  return markers.reduce((sum, marker) => sum + (text.split(marker).length - 1), 0);
}

function ratio(count: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((count / total) * 10000) / 10000;
}

function markersPresent(text: string, markers: string[]): string[] {
  return markers.filter((marker) => text.includes(marker));
}

function markerCounts(text: string, markers: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const marker of markers) {
    const count = text.split(marker).length - 1;
    if (count > 0) counts[marker] = count;
  }
  return counts;
}

function mergeCounts(target: Record<string, number>, source: Record<string, number>) {
  for (const [key, value] of Object.entries(source)) target[key] = (target[key] ?? 0) + value;
}

export function extractSentenceEndings(sentences: string[]): Record<string, number> {
  const endings: Record<string, number> = {};
  for (const sentence of sentences) {
    const stripped = sentence.trim();
    const match = KO_ENDING_RE.exec(stripped);
    const ending = match?.[1] ?? stripped.slice(-1);
    if (ending) endings[ending] = (endings[ending] ?? 0) + 1;
  }
  return endings;
}

export function extractDialogueStats(text: string, sentences = splitSentences(text)): SceneRecord['dialogue'] {
  const quoteMarks: Record<string, number> = {};
  for (const ch of text) {
    if ('「」『』“”"'.includes(ch)) quoteMarks[ch] = (quoteMarks[ch] ?? 0) + 1;
  }
  const dialogueLines = text.match(DIALOGUE_LINE_RE) ?? [];
  const dialogueSentences = sentences.filter((sentence) => DIALOGUE_RE.test(sentence));
  return {
    hasDialogue: dialogueSentences.length > 0 || dialogueLines.length > 0,
    quoteMarkCount: Object.values(quoteMarks).reduce((sum, value) => sum + value, 0),
    quoteMarks,
    dialogueLineCount: dialogueLines.length,
    dialogueSentenceCount: dialogueSentences.length,
    dialogueSentenceRatio: ratio(dialogueSentences.length, sentences.length),
    dialogueTagCounts: markerCounts(text, DIALOGUE_TAG_MARKERS)
  };
}

function extractParagraphClosingDevice(paragraph: string): SceneRecord['transition']['closingDevice'] {
  const sentences = splitSentences(paragraph);
  if (!sentences.length) return 'unknown';
  const last = sentences[sentences.length - 1];
  if (DIALOGUE_RE.test(last)) return 'dialogue';
  if (JUDGMENT_DELAY_MARKERS.some((marker) => last.includes(marker))) return 'judgment_delay';
  if (SENSORY_MARKERS.some((marker) => last.includes(marker))) return 'sensory';
  if ([...ACTION_MARKERS, ...MOVEMENT_MARKERS].some((marker) => last.includes(marker))) return 'action';
  if (last.endsWith('?') || last.endsWith('까') || last.endsWith('냐')) return 'question';
  if (last.endsWith('!') || last.endsWith('다!')) return 'emphasis';
  return 'statement';
}

function extractEmotionHandling(paragraph: string): {
  mode: SceneRecord['narrationDistance']['emotionDistance'];
  direct: string[];
  delayed: string[];
  actionCount: number;
  sensoryCount: number;
} {
  const direct = markersPresent(paragraph, DIRECT_EMOTION_MARKERS);
  const delayed = markersPresent(paragraph, JUDGMENT_DELAY_MARKERS);
  const actionCount = countContains(paragraph, ACTION_MARKERS);
  const sensoryCount = countContains(paragraph, SENSORY_MARKERS);
  const mode = direct.length
    ? 'direct_naming'
    : delayed.length || actionCount || sensoryCount
      ? 'indirect_or_deferred'
      : 'neutral_or_unmarked';
  return { mode, direct, delayed, actionCount, sensoryCount };
}

function extractPacingStats(paragraph: string): SceneRecord['pacing'] {
  const sentences = splitSentences(paragraph);
  const lengths = sentences.map((sentence) => sentence.replace(/\s/g, '').length);
  const shortCount = lengths.filter((length) => length <= 18).length;
  const longCount = lengths.filter((length) => length >= 55).length;
  const avgSentenceChars = lengths.length ? Math.round((lengths.reduce((a, b) => a + b, 0) / lengths.length) * 100) / 100 : 0;
  const durationType =
    avgSentenceChars <= 20 && sentences.length >= 2
      ? 'short_burst'
      : avgSentenceChars >= 45
        ? 'compressed_long_sentence'
        : 'medium_controlled';
  return {
    sentenceCount: sentences.length,
    avgSentenceChars,
    shortSentenceRatio: ratio(shortCount, sentences.length),
    longSentenceRatio: ratio(longCount, sentences.length),
    durationType
  };
}

function sceneTypeScores(paragraph: string, idx: number): Record<SceneType, number> {
  const sentences = splitSentences(paragraph);
  const dialogue = extractDialogueStats(paragraph, sentences);
  return {
    dialogue: dialogue.dialogueSentenceRatio * 4 + (dialogue.hasDialogue ? 1 : 0),
    conflict: countContains(paragraph, CONFLICT_MARKERS),
    movement: countContains(paragraph, MOVEMENT_MARKERS),
    exposition: countContains(paragraph, EXPOSITION_MARKERS),
    aftermath: countContains(paragraph, AFTERMATH_MARKERS),
    quiet_transition: countContains(paragraph, TRANSITION_MARKERS),
    observation: countContains(paragraph, SENSORY_MARKERS) + (idx === 0 ? 1 : 0)
  };
}

function classifySceneType(paragraph: string, idx: number): SceneType[] {
  const ranked = Object.entries(sceneTypeScores(paragraph, idx))
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([sceneType]) => sceneType as SceneType);
  if (!ranked.length) return [idx === 0 ? 'observation' : 'quiet_transition'];
  return ranked.slice(0, 2);
}

function sceneFunctionLabel(sceneTypes: SceneType[]): string {
  const labels: Record<SceneType, string> = {
    observation: '대상과 공간을 관찰하며 분위기와 시선을 세팅',
    dialogue: '발화와 반응으로 관계 또는 정보를 진행',
    exposition: '설정, 사실, 규칙을 설명하거나 정리',
    movement: '인물의 동선과 신체 행동으로 장면을 진행',
    conflict: '긴장, 위험, 대립 신호로 사건 압력을 생성',
    aftermath: '사건 뒤 반응과 잔여 감각을 정리',
    quiet_transition: '시간, 상태, 시선 전환을 낮은 압력으로 연결'
  };
  return labels[sceneTypes[0]];
}

function normalizeInput(rawText: string, title?: string): InputProfile {
  const paragraphs = paragraphCandidates(rawText);
  const hasJapaneseInsertions = JA_RE.test(rawText) || JA_QUOTED_CJK_RE.test(rawText);
  return {
    inputId: id('input'),
    title,
    mainLanguage: hasJapaneseInsertions ? 'mixed' : 'ko',
    insertedLanguages: hasJapaneseInsertions ? ['ja'] : [],
    paragraphCount: paragraphs.length,
    estimatedSceneCount: Math.max(1, Math.min(paragraphs.length, 12)),
    hasDialogue: DIALOGUE_RE.test(rawText),
    hasJapaneseInsertions,
    normalizationNotes: ['MVP regex analyzer. Tokenizer and model-backed coding can be added later.']
  };
}

function segmentScenes(rawText: string, inputProfile: InputProfile): SceneRecord[] {
  const paragraphs = paragraphCandidates(rawText);
  return paragraphs.map((paragraph, idx) => {
    const sceneTypes = classifySceneType(paragraph, idx);
    const boundaryReason = ['paragraph_boundary'];
    if (idx > 0) {
      if (TRANSITION_MARKERS.some((marker) => paragraph.includes(marker))) boundaryReason.push('transition_marker');
      if (CONFLICT_MARKERS.some((marker) => paragraph.includes(marker))) boundaryReason.push('tension_shift_marker');
      if (DIALOGUE_RE.test(paragraph)) boundaryReason.push('dialogue_entry');
    }
    return {
      sceneId: `S${String(idx + 1).padStart(3, '0')}`,
      span: { startParagraph: idx, endParagraph: idx },
      sceneTypes,
      languageMix: { main: inputProfile.mainLanguage },
      boundaryReason,
      sceneFunction: sceneFunctionLabel(sceneTypes),
      narrationDistance: {
        emotionDistance: 'neutral_or_unmarked',
        directEmotionMarkers: [],
        judgmentDelayMarkers: [],
        emotionIndirectSignalCount: 0
      },
      informationDistribution: { immediate: [], delayed: [] },
      pacing: {
        sentenceCount: 0,
        avgSentenceChars: 0,
        shortSentenceRatio: 0,
        longSentenceRatio: 0,
        durationType: 'medium_controlled'
      },
      transition: { closingDevice: 'unknown', lastSentence: '', transitionMarkers: [] },
      dialogue: {
        hasDialogue: false,
        quoteMarkCount: 0,
        quoteMarks: {},
        dialogueLineCount: 0,
        dialogueSentenceCount: 0,
        dialogueSentenceRatio: 0,
        dialogueTagCounts: {}
      },
      surfaceFeatures: {
        sentenceEndings: {},
        ellipsisCount: 0,
        questionCount: 0,
        exclamationCount: 0,
        particleCounts: {}
      },
      notes: ''
    };
  });
}

function codeSceneFeatures(sceneRecords: SceneRecord[], rawText: string): SceneRecord[] {
  const paragraphs = paragraphCandidates(rawText);
  return sceneRecords.map((scene) => {
    const paragraph = paragraphs.slice(scene.span.startParagraph, scene.span.endParagraph + 1).join('\n\n');
    const sentences = splitSentences(paragraph);
    const pacing = extractPacingStats(paragraph);
    const dialogue = extractDialogueStats(paragraph, sentences);
    const emotion = extractEmotionHandling(paragraph);
    const closingDevice = extractParagraphClosingDevice(paragraph);
    return {
      ...scene,
      narrationDistance: {
        emotionDistance: emotion.mode,
        directEmotionMarkers: emotion.direct,
        judgmentDelayMarkers: emotion.delayed,
        emotionIndirectSignalCount: emotion.actionCount + emotion.sensoryCount
      },
      informationDistribution: {
        immediate: markersPresent(paragraph, EXPOSITION_MARKERS),
        delayed: markersPresent(paragraph, [...JUDGMENT_DELAY_MARKERS, ...TRANSITION_MARKERS])
      },
      pacing,
      transition: {
        closingDevice,
        lastSentence: sentences[sentences.length - 1] ?? '',
        transitionMarkers: markersPresent(paragraph, TRANSITION_MARKERS)
      },
      dialogue,
      surfaceFeatures: {
        sentenceEndings: extractSentenceEndings(sentences),
        ellipsisCount: (paragraph.match(/…|\.\.\./g) ?? []).length,
        questionCount: (paragraph.match(/\?/g) ?? []).length + (paragraph.match(/까/g) ?? []).length,
        exclamationCount: (paragraph.match(/!/g) ?? []).length,
        particleCounts: markerCounts(paragraph, PARTICLE_MARKERS)
      }
    };
  });
}

function sceneTypesFor(scenes: SceneRecord[]): SceneType[] {
  const ordered: SceneType[] = [];
  for (const scene of scenes) {
    for (const sceneType of scene.sceneTypes) if (!ordered.includes(sceneType)) ordered.push(sceneType);
  }
  return ordered;
}

function counterexamplesFor(sceneRecords: SceneRecord[], supportedIds: Set<string>): string[] {
  return sceneRecords.filter((scene) => !supportedIds.has(scene.sceneId)).map((scene) => scene.sceneId);
}

function baseEvidence(args: {
  candidateRule: string;
  axis: string;
  supported: SceneRecord[];
  allScenes: SceneRecord[];
  contentIndependence: number;
  confidence: number;
  leakageRisk?: 'low' | 'medium' | 'high';
}): StyleEvidenceRecord {
  const supportedIds = new Set(args.supported.map((scene) => scene.sceneId));
  return {
    featureId: 'pending',
    candidateRule: args.candidateRule,
    axis: args.axis,
    supportingScenes: args.supported.map((scene) => scene.sceneId),
    supportingSceneTypes: sceneTypesFor(args.supported),
    counterexamples: counterexamplesFor(args.allScenes, supportedIds),
    contentIndependence: args.contentIndependence,
    languageDependence: { ko: 'regex-surface-mvp' },
    leakageRisk: args.leakageRisk ?? 'low',
    globalityDecision: 'uncertain',
    confidence: args.confidence
  };
}

function evidenceForClosingDevices(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  const groups = new Map<string, SceneRecord[]>();
  for (const scene of sceneRecords) {
    const device = scene.transition.closingDevice;
    if (device !== 'unknown') groups.set(device, [...(groups.get(device) ?? []), scene]);
  }
  const [device, supported] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!device || supported.length < 2) return [];
  const labels: Record<string, string> = {
    action: '문단 끝을 행동으로 닫아 감정 설명보다 장면 진행을 우선한다.',
    sensory: '문단 끝을 감각 인상으로 닫아 판단을 직접 확정하지 않는다.',
    dialogue: '문단 끝을 발화로 닫아 설명보다 반응의 여백을 남긴다.',
    judgment_delay: '문단 끝에 판단 유예 표현을 두어 의미 확정을 지연한다.',
    statement: '문단 끝을 평서형 종결로 정리해 장면 단위를 명확히 끊는다.',
    question: '문단 끝을 질문형으로 닫아 다음 반응을 요구하는 압력을 만든다.',
    emphasis: '문단 끝에 강조 종결을 사용해 장면 압력을 높인다.'
  };
  return [
    baseEvidence({
      candidateRule: labels[device] ?? `문단 끝에서 ${device} 방식의 마감이 반복된다.`,
      axis: 'surface_closure',
      supported,
      allScenes: sceneRecords,
      contentIndependence: ['action', 'sensory', 'judgment_delay'].includes(device) ? 0.82 : 0.76,
      confidence: Math.min(0.9, 0.5 + supported.length * 0.1)
    })
  ];
}

function evidenceForPacing(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  const groups = new Map<string, SceneRecord[]>();
  for (const scene of sceneRecords) {
    const durationType = scene.pacing.durationType;
    groups.set(durationType, [...(groups.get(durationType) ?? []), scene]);
  }
  const [durationType, supported] = [...groups.entries()].sort((a, b) => b[1].length - a[1].length)[0] ?? [];
  if (!durationType || supported.length < 2) return [];
  const labels: Record<string, string> = {
    short_burst: '짧은 문장을 연속 배치해 장면의 박자를 빠르게 끊는다.',
    medium_controlled: '중간 길이 문장 위주로 관찰, 행동, 정보를 균일하게 배치한다.',
    compressed_long_sentence: '긴 문장으로 정보와 감각을 압축해 한 호흡 안에서 장면을 밀어낸다.'
  };
  return [
    baseEvidence({
      candidateRule: labels[durationType] ?? '문장 길이 운용 패턴이 여러 장면에서 반복된다.',
      axis: 'pacing',
      supported,
      allScenes: sceneRecords,
      contentIndependence: 0.78,
      confidence: Math.min(0.88, 0.48 + supported.length * 0.1)
    })
  ];
}

function evidenceForEmotionHandling(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  const supported = sceneRecords.filter((scene) => scene.narrationDistance.emotionDistance === 'indirect_or_deferred');
  if (supported.length < 2) return [];
  return [
    baseEvidence({
      candidateRule: '감정은 직접 명명하기보다 행동, 감각, 판단 유예 표지로 우회해 처리한다.',
      axis: 'emotion_handling',
      supported,
      allScenes: sceneRecords,
      contentIndependence: 0.86,
      confidence: Math.min(0.9, 0.52 + supported.length * 0.1)
    })
  ];
}

function evidenceForDialogue(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  const dialogueScenes = sceneRecords.filter((scene) => scene.dialogue.hasDialogue);
  if (!dialogueScenes.length) return [];
  const tagLight = dialogueScenes.filter(
    (scene) => Object.keys(scene.dialogue.dialogueTagCounts).length === 0 && scene.dialogue.dialogueSentenceRatio > 0
  );
  if (!tagLight.length) return [];
  return [
    baseEvidence({
      candidateRule: '대사 구간은 발화 태그를 과하게 붙이지 않고 발화 자체와 전후 반응으로 흐름을 만든다.',
      axis: 'dialogue_rhythm',
      supported: tagLight,
      allScenes: sceneRecords,
      contentIndependence: 0.74,
      confidence: Math.min(0.82, 0.55 + tagLight.length * 0.1)
    })
  ];
}

function evidenceForInformationDelay(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  const supported = sceneRecords.filter((scene) => scene.informationDistribution.delayed.length > 0);
  if (supported.length < 2) return [];
  return [
    baseEvidence({
      candidateRule: '전환과 판단 유예 표지를 사용해 정보를 즉시 확정하지 않고 다음 문장이나 장면으로 넘긴다.',
      axis: 'information_distribution',
      supported,
      allScenes: sceneRecords,
      contentIndependence: 0.8,
      confidence: Math.min(0.86, 0.5 + supported.length * 0.1)
    })
  ];
}

function evaluateGlobality(record: StyleEvidenceRecord): EvidenceLevel {
  const sceneCount = new Set(record.supportingScenes).size;
  const sceneTypeCount = new Set(record.supportingSceneTypes).size;
  const counterexampleCount = new Set(record.counterexamples).size;
  const counterexampleRatio = counterexampleCount / Math.max(sceneCount, 1);
  if (record.leakageRisk === 'high') return 'prohibited';
  if (record.contentIndependence < 0.7) return 'uncertain';
  if (counterexampleRatio > 0.5) return 'uncertain';
  if (sceneCount >= 5 && sceneTypeCount >= 3) return 'global_strong';
  if (sceneCount >= 3 && sceneTypeCount >= 2) return 'global_medium';
  if (sceneCount >= 3) return 'register_specific';
  if (sceneCount <= 1) return 'local';
  return 'uncertain';
}

function extractStyleEvidence(sceneRecords: SceneRecord[]): StyleEvidenceRecord[] {
  if (sceneRecords.length < 2) return [];
  const records = [
    ...evidenceForClosingDevices(sceneRecords),
    ...evidenceForPacing(sceneRecords),
    ...evidenceForEmotionHandling(sceneRecords),
    ...evidenceForDialogue(sceneRecords),
    ...evidenceForInformationDelay(sceneRecords)
  ];
  return records.map((record, idx) => {
    const withId = { ...record, featureId: `F_RULE_${String(idx + 1).padStart(3, '0')}` };
    return { ...withId, globalityDecision: evaluateGlobality(withId) };
  });
}

function emptySurfaceFeatureSet(): SurfaceFeatureSet {
  return {
    sentenceEndings: {},
    particles: {},
    honorificMarkers: {},
    addressTerms: {},
    quotationMarkers: {},
    ellipsisMarkers: 0,
    dialogueTagCounts: {},
    paragraphClosingDevices: {}
  };
}

function buildLanguageSurfaceProfile(inputProfile: InputProfile, sceneRecords: SceneRecord[]): LanguageSurfaceProfile {
  const ko = emptySurfaceFeatureSet();
  for (const scene of sceneRecords) {
    mergeCounts(ko.sentenceEndings, scene.surfaceFeatures.sentenceEndings);
    mergeCounts(ko.quotationMarkers, scene.dialogue.quoteMarks);
    mergeCounts(ko.dialogueTagCounts, scene.dialogue.dialogueTagCounts);
    mergeCounts(ko.particles, scene.surfaceFeatures.particleCounts);
    ko.ellipsisMarkers += scene.surfaceFeatures.ellipsisCount;
    const closing = scene.transition.closingDevice;
    if (closing) ko.paragraphClosingDevices[closing] = (ko.paragraphClosingDevices[closing] ?? 0) + 1;
    const last = scene.transition.lastSentence;
    for (const marker of HONORIFIC_MARKERS) if (last.includes(marker)) ko.honorificMarkers[marker] = (ko.honorificMarkers[marker] ?? 0) + 1;
    for (const marker of ADDRESS_TERMS) if (last.includes(marker)) ko.addressTerms[marker] = (ko.addressTerms[marker] ?? 0) + 1;
  }
  return {
    profileId: `LSP-${inputProfile.inputId}`,
    sourceInputId: inputProfile.inputId,
    ko,
    ja: emptySurfaceFeatureSet(),
    functionalEquivalence: [
      { surface: 'paragraph_closing_devices', function: '문단 말미에서 판단 확정, 유예, 행동 전환 방식을 추적한다.' },
      { surface: 'sentence_endings', function: '종결 습관으로 문장 리듬과 서술 거리의 기본값을 잡는다.' }
    ],
    notes: ['MVP regex extraction. External tokenizer is not required for the local baseline.']
  };
}

export function buildPromptCapsule(
  evidenceRecords: StyleEvidenceRecord[],
  sceneTypeHint: SceneType[] = ['observation'],
  maxTokensHint = 1600
): PromptCapsuleV3 {
  const globalRules = evidenceRecords
    .filter((evidence) => evidence.globalityDecision === 'global_medium' || evidence.globalityDecision === 'global_strong')
    .map((evidence) => evidence.candidateRule);
  const registerRules: Record<string, string[]> = {};
  for (const evidence of evidenceRecords) {
    if (evidence.globalityDecision === 'register_specific') {
      registerRules[evidence.axis] = [...(registerRules[evidence.axis] ?? []), evidence.candidateRule];
    }
  }
  const localObservations = evidenceRecords.filter((evidence) => evidence.globalityDecision === 'local').map((evidence) => evidence.candidateRule);
  if (localObservations.length) registerRules.local_observations = localObservations;
  const languageSurfaceRules: Record<string, string[]> = {};
  for (const evidence of evidenceRecords) {
    if (evidence.axis === 'surface_closure' || evidence.axis === 'pacing') {
      languageSurfaceRules[evidence.axis] = [...(languageSurfaceRules[evidence.axis] ?? []), evidence.candidateRule];
    }
  }
  return {
    capsuleId: id('CAP'),
    activeSceneTypes: sceneTypeHint.length ? sceneTypeHint : ['observation'],
    evidenceBackedGlobalRules: globalRules,
    registerRules,
    languageSurfaceRules,
    doNotTransfer: ['원문 고유명사', '원문 사건 구조', '원문 서명 표현', '특정 장면의 시선 이동 순서'],
    selfCheck: ['기능 규칙만 전이했는가?', '원문 표현이나 사건 배열이 남지 않았는가?', '전역 규칙과 장면 한정 관찰을 구분했는가?'],
    maxTokensHint
  };
}

export function analyzeStyleLocally(rawText: string, title?: string): StyleAnalysisBundle {
  const inputProfile = normalizeInput(rawText, title);
  const sceneRecords = codeSceneFeatures(segmentScenes(rawText, inputProfile), rawText);
  const evidenceRecords = extractStyleEvidence(sceneRecords);
  const languageSurfaceProfile = buildLanguageSurfaceProfile(inputProfile, sceneRecords);
  const promptCapsules = [
    buildPromptCapsule(evidenceRecords, sceneRecords[0]?.sceneTypes ?? ['observation'])
  ];
  return {
    schemaVersion: 'bindery.style.analysis.v3',
    inputProfile,
    sceneRecords,
    evidenceRecords,
    languageSurfaceProfile,
    promptCapsules
  };
}

export function sceneText(rawText: string, scene: SceneRecord): string {
  const paragraphs = paragraphCandidates(rawText);
  return paragraphs.slice(scene.span.startParagraph, scene.span.endParagraph + 1).join('\n\n');
}

function topEntries(record: Record<string, number>, limit = 6): string {
  const entries = Object.entries(record)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key, value]) => `${key}(${value})`);
  return entries.join(', ') || '없음';
}

export function renderLocalProcedureMarkdown(bundle: StyleAnalysisBundle): string {
  const globalCount = bundle.evidenceRecords.filter((e) => e.globalityDecision === 'global_medium' || e.globalityDecision === 'global_strong').length;
  return [
    '## 분석 절차',
    ...STYLE_ANALYSIS_PROCEDURE.map((step) => {
      const status = step.owner === 'local' ? '완료' : 'AI 보강 필요';
      return `- ${step.label}: ${status}. 산출물: ${step.output}`;
    }),
    '',
    `로컬 결과: scene ${bundle.sceneRecords.length}개, evidence ${bundle.evidenceRecords.length}개, 전역 규칙 ${globalCount}개.`
  ].join('\n');
}

export function renderEvidenceMarkdown(bundle: StyleAnalysisBundle): string {
  if (!bundle.evidenceRecords.length) return '## Evidence records\n- 반복 feature가 아직 충분히 잡히지 않았습니다.';
  return [
    '## Evidence records',
    '| id | axis | decision | support | rule |',
    '|---|---|---|---:|---|',
    ...bundle.evidenceRecords.map(
      (evidence) =>
        `| ${evidence.featureId} | ${evidence.axis} | ${evidence.globalityDecision} | ${evidence.supportingScenes.length} | ${evidence.candidateRule} |`
    )
  ].join('\n');
}

export function renderSurfaceProfileMarkdown(bundle: StyleAnalysisBundle): string {
  const ko = bundle.languageSurfaceProfile.ko;
  return [
    '## Language surface profile',
    `- 종결 어미: ${topEntries(ko.sentenceEndings)}`,
    `- 문단 마감: ${topEntries(ko.paragraphClosingDevices)}`,
    `- 인용부호: ${topEntries(ko.quotationMarkers)}`,
    `- 대사 태그: ${topEntries(ko.dialogueTagCounts)}`,
    `- 조사: ${topEntries(ko.particles, 8)}`,
    `- 말줄임표: ${ko.ellipsisMarkers}`
  ].join('\n');
}

export function renderCapsuleMarkdown(bundle: StyleAnalysisBundle): string {
  const capsule = bundle.promptCapsules[0] ?? buildPromptCapsule(bundle.evidenceRecords);
  const registerLines = Object.entries(capsule.registerRules).flatMap(([axis, rules]) => [`### ${axis}`, ...rules.map((rule) => `- ${rule}`)]);
  const surfaceLines = Object.entries(capsule.languageSurfaceRules).flatMap(([axis, rules]) => [`### ${axis}`, ...rules.map((rule) => `- ${rule}`)]);
  return [
    '# Style Capsule',
    '',
    '## Active scene types',
    ...capsule.activeSceneTypes.map((sceneType) => `- ${sceneType}`),
    '',
    '## Confirmed global rules',
    ...(capsule.evidenceBackedGlobalRules.length ? capsule.evidenceBackedGlobalRules.map((rule) => `- ${rule}`) : ['- 확정 전역 규칙 없음. evidence 판정 확인 필요.']),
    '',
    '## Register-specific rules',
    ...(registerLines.length ? registerLines : ['- 없음']),
    '',
    '## Surface rules',
    ...(surfaceLines.length ? surfaceLines : ['- 없음']),
    '',
    '## Do not transfer',
    ...capsule.doNotTransfer.map((item) => `- ${item}`),
    '',
    '## Self check',
    ...capsule.selfCheck.map((item) => `- ${item}`)
  ].join('\n');
}

export function renderLocalAnalysisMarkdown(bundle: StyleAnalysisBundle): string {
  return [
    renderLocalProcedureMarkdown(bundle),
    '',
    '## Scene index',
    '| scene | span | type | closing | pacing | emotion | function |',
    '|---|---:|---|---|---|---|---|',
    ...bundle.sceneRecords.map(
      (scene) =>
        `| ${scene.sceneId} | ${scene.span.startParagraph + 1} | ${scene.sceneTypes.join(', ')} | ${scene.transition.closingDevice} | ${scene.pacing.durationType} | ${scene.narrationDistance.emotionDistance} | ${scene.sceneFunction} |`
    ),
    '',
    renderEvidenceMarkdown(bundle),
    '',
    renderSurfaceProfileMarkdown(bundle),
    '',
    renderCapsuleMarkdown(bundle)
  ].join('\n');
}
