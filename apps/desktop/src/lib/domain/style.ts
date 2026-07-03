// 문체 재현 도메인. 로컬 MVP 분석 절차를 먼저 실행하고,
// AI는 로컬 regex로 판단하기 어려운 감성, 거리감, 묘사의 결을 보강한다.
import {
  analyzeStyleLocally,
  paragraphCandidates,
  renderCapsuleMarkdown,
  renderEvidenceMarkdown,
  renderLocalAnalysisMarkdown,
  renderLocalProcedureMarkdown,
  renderSurfaceProfileMarkdown,
  sceneText,
  splitSentences,
  type SceneRecord,
  type SceneType,
  type StyleAnalysisBundle
} from './styleAnalyzer';

export {
  STYLE_ANALYSIS_PROCEDURE,
  renderCapsuleMarkdown,
  renderEvidenceMarkdown,
  renderLocalAnalysisMarkdown,
  renderLocalProcedureMarkdown,
  renderSurfaceProfileMarkdown
} from './styleAnalyzer';
export type {
  AnalysisProcedureStep,
  EvidenceLevel,
  InputProfile,
  LanguageSurfaceProfile,
  PromptCapsuleV3,
  SceneRecord,
  SceneType,
  StyleAnalysisBundle,
  StyleEvidenceRecord,
  SurfaceFeatureSet
} from './styleAnalyzer';

type QuantStats = {
  chars: number;
  sentenceCount: number;
  avgSentenceLen: number;
  shortRatio: number; // 20자 이하 문장 비율
  longRatio: number; // 60자 이상 문장 비율
  dialogueRatio: number; // 대사 문장 비율 또는 전체 fallback 대화 글자 비중
  dialogueSentenceRatio: number;
  emotionDensity: number; // 1000자당 감정어 수
  emotionWords: string[];
  endings: Array<{ form: string; count: number }>;
  inversionRatio: number; // 평서형 종결이 아닌 문장 비율
  commaPerSentence: number;
  topAdverbs: string[];
};

export type SceneStats = QuantStats & {
  index: number;
  sceneId: string;
  title: string;
  text: string;
  sceneTypes: SceneType[];
  sceneFunction: string;
  boundaryReason: string[];
  closingDevice: SceneRecord['transition']['closingDevice'];
  pacingDuration: SceneRecord['pacing']['durationType'];
  emotionDistance: SceneRecord['narrationDistance']['emotionDistance'];
  localFeatureSummary: string;
};

export type StyleAnalysis = {
  scenes: SceneStats[];
  overall: QuantStats;
  bundle: StyleAnalysisBundle;
};

const EMOTION_STEMS = [
  '두려', '떨리', '떨렸', '울', '웃', '눈물', '분노', '슬픔', '슬프', '기쁨', '기쁘',
  '설레', '불안', '초조', '그리움', '그리워', '씁쓸', '아득', '먹먹', '시리', '아프',
  '아팠', '저릿', '뜨겁', '뜨거', '차갑', '차가', '두근', '숨이', '가슴', '심장',
  '외로', '허전', '벅차', '조마', '섬뜩', '오싹', '애틋', '서러', '부끄'
];

const PLAIN_ENDING = /(다|까|요|죠|지|네|군|라|니|오|가)[.!?…"”』」\s]*$/;

function dialogueChars(text: string): number {
  let sum = 0;
  for (const m of text.matchAll(/[「『“"]([^」』”"]*)[」』”"]/g)) sum += m[1].length;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('\u2014') || t.startsWith('-')) sum += t.replace(/^[-\u2014]\s*/, '').length;
  }
  return sum;
}

function endingForm(sentence: string): string {
  const cleaned = sentence.replace(/[.!?…"”』」\s]+$/, '');
  return cleaned.slice(-2) || cleaned;
}

function localFeatureSummary(record?: SceneRecord): string {
  if (!record) return '전체 샘플 통계';
  return [
    record.sceneTypes.join(', '),
    record.pacing.durationType,
    record.transition.closingDevice,
    record.narrationDistance.emotionDistance
  ].join(' / ');
}

export function splitScenes(sample: string): string[] {
  return paragraphCandidates(sample);
}

function analyzeChunk(text: string, record?: SceneRecord): QuantStats {
  const sentences = splitSentences(text);
  const chars = text.replace(/\s/g, '').length;
  const lens = sentences.map((s) => s.replace(/\s/g, '').length);
  const avg = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
  const short = lens.filter((l) => l <= 20).length;
  const long = lens.filter((l) => l >= 60).length;

  const emotionHits: string[] = [];
  for (const stem of EMOTION_STEMS) {
    const count = text.split(stem).length - 1;
    for (let i = 0; i < count; i++) emotionHits.push(stem);
  }

  const endingCounts = new Map<string, number>();
  let inverted = 0;
  let commas = 0;
  for (const s of sentences) {
    const form = endingForm(s);
    endingCounts.set(form, (endingCounts.get(form) ?? 0) + 1);
    if (!PLAIN_ENDING.test(s)) inverted++;
    commas += (s.match(/,|、|，/g) ?? []).length;
  }

  const adverbCounts = new Map<string, number>();
  for (const m of text.matchAll(/([가-힣]{1,4}(?:게|히|껏|씩|듯))\s/g)) {
    adverbCounts.set(m[1], (adverbCounts.get(m[1]) ?? 0) + 1);
  }
  const topAdverbs = [...adverbCounts.entries()]
    .filter(([, c]) => c >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([w]) => w);

  const dialogueSentenceRatio = record ? Math.round(record.dialogue.dialogueSentenceRatio * 100) : 0;
  const fallbackDialogueRatio = chars ? Math.min(100, Math.round((dialogueChars(text) / chars) * 100)) : 0;

  return {
    chars,
    sentenceCount: sentences.length,
    avgSentenceLen: Math.round(avg * 10) / 10,
    shortRatio: sentences.length ? Math.round((short / sentences.length) * 100) : 0,
    longRatio: sentences.length ? Math.round((long / sentences.length) * 100) : 0,
    dialogueRatio: record ? dialogueSentenceRatio : fallbackDialogueRatio,
    dialogueSentenceRatio,
    emotionDensity: chars ? Math.round((emotionHits.length / chars) * 10000) / 10 : 0,
    emotionWords: [...new Set(emotionHits)].slice(0, 8),
    endings: [...endingCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([form, count]) => ({ form, count })),
    inversionRatio: sentences.length ? Math.round((inverted / sentences.length) * 100) : 0,
    commaPerSentence: sentences.length ? Math.round((commas / sentences.length) * 10) / 10 : 0,
    topAdverbs
  };
}

export function analyzeStyle(sample: string): StyleAnalysis {
  const bundle = analyzeStyleLocally(sample);
  const scenes = bundle.sceneRecords.map((record, i) => {
    const text = sceneText(sample, record);
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 24);
    return {
      index: i + 1,
      sceneId: record.sceneId,
      title: firstLine || `장면 ${i + 1}`,
      text,
      sceneTypes: record.sceneTypes,
      sceneFunction: record.sceneFunction,
      boundaryReason: record.boundaryReason,
      closingDevice: record.transition.closingDevice,
      pacingDuration: record.pacing.durationType,
      emotionDistance: record.narrationDistance.emotionDistance,
      localFeatureSummary: localFeatureSummary(record),
      ...analyzeChunk(text, record)
    };
  });
  return { scenes, overall: analyzeChunk(sample), bundle };
}

export function statsMarkdown(a: StyleAnalysis): string {
  const row = (s: SceneStats) =>
    `| ${s.sceneId} | ${s.sceneTypes.join(', ')} | ${s.sentenceCount} | ${s.avgSentenceLen} | ${s.shortRatio}% | ${s.dialogueRatio}% | ${s.pacingDuration} | ${s.closingDevice} | ${s.emotionDistance} | ${s.endings.map((e) => `${e.form}(${e.count})`).join(' ')} |`;
  return [
    '| 장면 | 유형 | 문장 수 | 평균 길이 | 단문 | 대사문장 | 박자 | 마감 | 감정거리 | 주요 어미 |',
    '|---|---|---:|---:|---:|---:|---|---|---|---|',
    ...a.scenes.map(row)
  ].join('\n');
}

const COMMON_RULES = `규칙:
- 정량 수치와 로컬 evidence는 참고 근거다. 수치를 맞추는 것이 아니라 읽었을 때의 느낌을 재현하는 것이 목표다.
- 원문 문장을 그대로 복사하거나 어절만 바꿔 재사용하는 것을 금지한다.
- 고유명사, 사건 구조, 서명 표현, 특정 장면 안무는 문체가 아니므로 전이하지 않는다.
- 한국어로만 답한다. 마크다운 형식을 지킨다.`;

export function buildExtractPrompt(sample: string, analysis: StyleAnalysis): string {
  return `너는 소설 문체 분석가다. 아래 샘플 텍스트의 문체를 분석하라.

${COMMON_RULES}

이미 완료된 로컬 절차:
1. raw_text 정규화
2. paragraph 기반 scene 후보 분할
3. scene별 pacing, transition, dialogue, surface feature 코딩
4. 반복 feature에서 F_RULE evidence 생성
5. globality 판정과 PromptCapsule 작성

AI가 맡을 범위:
1. 로컬 수치만으로는 어려운 호흡과 리듬의 체감 설명.
2. 감정이 어디에 얹히는지, 직접 명명인지 감각 우회인지의 미묘한 차이.
3. 서술자의 시선과 거리감, 관찰자인지 동승자인지.
4. 묘사의 결, 대화의 기능, 생략과 여백의 방식.
5. 로컬 evidence가 과장되었거나 장면 한정으로 보이면 그렇게 표시.

각 장면에 대해 다음을 마크다운으로 정리하라:
1. **호흡과 리듬**: 문장이 흐르는 속도감, 끊는 지점, 리듬의 완급.
2. **감정 처리 방식**: 감정을 직접 말하는가, 사물, 행동, 풍경에 얹는가.
3. **시선과 거리감**: 서술자가 인물과 얼마나 가까운가.
4. **묘사의 결**: 어떤 감각을 편애하는가, 묘사가 장식인가 서사인가.
5. **대화의 기능**: 정보 전달인가 침묵의 연장인가, 태그 처리 방식은 어떤가.
6. **로컬 evidence 검토**: 전역 규칙으로 써도 되는 것과 장면 한정으로 둘 것을 나눠라.
마지막에 "## 전체 문체 인상"으로 이 작가의 문체를 한 문단으로 요약하라.

## 로컬 분석 번들
${renderLocalAnalysisMarkdown(analysis.bundle)}

## 정량 참고치
${statsMarkdown(analysis)}

## 샘플 텍스트
${sample.slice(0, 6000)}`;
}

export function buildGuidePrompt(sample: string, analysis: StyleAnalysis, extract: string): string {
  return `너는 소설 문체 코치다. 로컬 분석 번들과 AI 문체 분석을 함께 사용해, 다른 작가 또는 AI가 이 문체로 새 장면을 쓸 때 따라야 할 실행 지침을 작성하라.

${COMMON_RULES}
- 지침은 무엇을 하라는 동사형 문장으로 쓴다. 추상적 형용사 나열을 금지한다.
- PromptCapsule의 전역 규칙은 우선 반영하되, uncertain 또는 local evidence는 장면 한정 주의점으로만 써라.

다음 구조로 작성하라:
## 장면 유형별 작성 지침
장면 유형별로 4~6개의 구체 지침.
## Evidence 기반 전역 규칙
F_RULE id를 함께 적고, 왜 전역 또는 장면 한정인지 설명.
## 금지어
이 문체를 깨뜨리는 단어와 표현 목록. AI 클리셰를 반드시 점검.
## 금지 묘사
이 문체와 어울리지 않는 묘사 습관 목록.
## 리듬 규칙
문장 길이 완급, 단락 전환, 종결어미 운용에 대한 참고치 기반 규칙. 수치는 범위로.

## AI 문체 분석
${extract.slice(0, 4000)}

## 로컬 PromptCapsule
${renderCapsuleMarkdown(analysis.bundle)}

## Evidence
${renderEvidenceMarkdown(analysis.bundle)}

## 정량 참고치
${statsMarkdown(analysis)}

## 샘플 발췌
${sample.slice(0, 2500)}`;
}

export function buildProofPrompt(guide: string, extract: string, sample: string): string {
  return `너는 소설가다. 아래 문체 지침을 따라, 원문에 존재하지 않는 완전히 새로운 장면을 한국어로 400~700자 작성하라.

${COMMON_RULES}
- 원문의 인물, 소재, 고유명사를 쓰지 말고 새로운 상황을 스스로 정하라.
- 지침의 금지어와 금지 묘사를 절대 사용하지 마라.
- 장면 끝에 "### 자가 점검"으로 지침을 어떻게 지켰는지 3줄로 적어라.

## 문체 지침
${guide.slice(0, 3500)}

## 문체 인상 요약
${extract.slice(0, 1500)}

## 원문 발췌(느낌 참고용, 문장 재사용 금지)
${sample.slice(0, 1500)}`;
}

export function buildGuidelinePrompt(extract: string, guide: string, proof: string, analysis: StyleAnalysis): string {
  return `너는 소설 문체 편집자다. 아래 재료를 통합해 이 작가의 최종 문체 지침서를 작성하라. 이 지침서는 AI가 매 회차 집필 때 프롬프트에 그대로 들어간다. 2000자 이내로 밀도 있게 쓰라.

${COMMON_RULES}
- 규칙은 절대값이 아니라 범위와 원칙으로 서술하라. 각 규칙에 예외 조건을 짧게 붙여 지침이 문장을 경직시키지 않게 하라.
- 금지 목록만은 예외 없이 명확하게 쓰라.
- 로컬 evidence가 uncertain이면 전역 규칙처럼 쓰지 말고 주의점으로만 남겨라.

구조:
# 문체 지침서
## 1. 문체 정체성
## 2. Evidence 기반 핵심 규칙
## 3. 호흡과 리듬 규칙
## 4. 감정 표현 원칙
## 5. 묘사와 대화 운용
## 6. 장면 유형별 핵심 지침
## 7. 금지 목록 (금지어 / 금지 묘사 표)
## 8. 집필 전 체크리스트

## 재료 1: 로컬 분석 절차
${renderLocalProcedureMarkdown(analysis.bundle)}

## 재료 2: PromptCapsule
${renderCapsuleMarkdown(analysis.bundle)}

## 재료 3: 문체 분석
${extract.slice(0, 3000)}

## 재료 4: 작성 지침과 금지 목록
${guide.slice(0, 3000)}

## 재료 5: 재현 테스트 결과
${proof.slice(0, 1500)}

## 재료 6: 표층 프로필
${renderSurfaceProfileMarkdown(analysis.bundle)}`;
}

export function extractBannedTerms(guideline: string): string[] {
  const terms: string[] = [];
  const lines = guideline.split('\n');
  let inBanned = false;
  for (const line of lines) {
    const t = line.trim();
    if (/^#{1,3}\s/.test(t)) inBanned = /금지/.test(t);
    if (!inBanned) continue;
    const cell = /^\|\s*([^|]+?)\s*\|/.exec(t);
    if (cell) {
      const head = cell[1].trim();
      if (['표현', '구분', '항목', '금지어', '금지 묘사', '---'].includes(head) || head.startsWith('-')) {
        const second = /^\|[^|]+\|\s*([^|]+?)\s*\|/.exec(t)?.[1] ?? '';
        for (const part of second.split(/[·,]/)) {
          const v = part.trim().replace(/\(.*?\)/g, '').trim();
          if (v.length >= 2 && !/금지|항목/.test(v)) terms.push(v);
        }
        continue;
      }
      const v = head.replace(/\(.*?\)/g, '').trim();
      if (v.length >= 2) terms.push(v);
    }
    const bullet = /^-\s+\*{0,2}([^:*]+?)\*{0,2}\s*[:\-]/.exec(t);
    if (bullet) {
      const v = bullet[1].trim();
      if (v.length >= 2 && v.length <= 20) terms.push(v);
    }
  }
  return [...new Set(terms)].slice(0, 40);
}

export type ComplianceHit = { term: string; count: number; line: number };

export function checkStyleCompliance(content: string, guideline: string): ComplianceHit[] {
  const banned = extractBannedTerms(guideline);
  const hits: ComplianceHit[] = [];
  for (const term of banned) {
    let idx = content.indexOf(term);
    if (idx === -1) continue;
    let count = 0;
    let firstLine = 0;
    while (idx !== -1) {
      if (count === 0) firstLine = content.slice(0, idx).split('\n').length;
      count++;
      idx = content.indexOf(term, idx + term.length);
    }
    hits.push({ term, count, line: firstLine });
  }
  return hits;
}

function tone(a: StyleAnalysis): { pace: string; emotion: string; dialogue: string } {
  const o = a.overall;
  return {
    pace: o.avgSentenceLen <= 25 ? '짧게 끊어치는 속도형' : o.avgSentenceLen >= 45 ? '길게 감아 도는 호흡형' : '중간 호흡의 균형형',
    emotion: o.emotionDensity >= 8 ? '감정어를 정면에 두는' : o.emotionDensity >= 3 ? '감정을 행동에 얹는' : '감정을 바닥에 깔고 절제하는',
    dialogue: o.dialogueRatio >= 40 ? '대화가 서사를 끄는' : o.dialogueRatio >= 15 ? '대화와 묘사가 교대하는' : '묘사가 지배하는'
  };
}

export function mockExtract(a: StyleAnalysis): string {
  const t = tone(a);
  const scenes = a.scenes
    .map(
      (s) => `### ${s.sceneId}: ${s.title}
- 로컬 feature: ${s.localFeatureSummary}.
- 호흡: 평균 ${s.avgSentenceLen}자, 단문 ${s.shortRatio}%. ${s.avgSentenceLen <= 25 ? '끊어치는 리듬' : '이어 감는 리듬'}.
- 감정 처리: ${s.emotionDistance}, 감정어 밀도 ${s.emotionDensity}/1k${s.emotionWords.length ? ` (${s.emotionWords.slice(0, 4).join(', ')})` : ''}.
- 대사 문장 비율: ${s.dialogueRatio}%. ${s.dialogueRatio >= 30 ? '대화가 장면을 민다' : '서술이 장면을 민다'}.
- 문단 마감: ${s.closingDevice}, 박자: ${s.pacingDuration}.
- 주요 어미: ${s.endings.map((e) => e.form).join(', ') || '-'}.`
    )
    .join('\n\n');
  return `> 오프라인 기본 분석입니다. AI 실행기를 연결하면 감성 분석이 더 깊어집니다.

${scenes}

${renderEvidenceMarkdown(a.bundle)}

## 전체 문체 인상
${t.pace} 문장에 ${t.emotion} 감정 처리, ${t.dialogue} 구성. 쉼표 ${a.overall.commaPerSentence}/문장, 자주 쓰는 부사(${a.overall.topAdverbs.join(', ') || '두드러진 것 없음'}).`;
}

export function mockGuide(a: StyleAnalysis): string {
  const t = tone(a);
  const o = a.overall;
  const capsule = renderCapsuleMarkdown(a.bundle);
  return `> 오프라인 기본 지침입니다. AI 실행기를 연결하면 장면별 지침이 정교해집니다.

## 장면 유형별 작성 지침
- **대화 장면**: 대사 사이에 짧은 행동 한 줄을 끼워 리듬을 만든다. 대사 태그는 최소화한다.
- **내면 장면**: 감정을 이름 붙이지 말고 사물과 감각으로 우회한다 (${t.emotion} 방식 유지).
- **긴장 장면**: 문장을 평균(${o.avgSentenceLen}자)보다 짧게 끊고, 단락도 짧게 자른다.
- **전환부**: 시간과 장소 이동은 한 문장으로 처리하고 설명을 늘어놓지 않는다.

## Evidence 기반 전역 규칙
${a.bundle.evidenceRecords.length ? a.bundle.evidenceRecords.map((e) => `- ${e.featureId} (${e.globalityDecision}): ${e.candidateRule}`).join('\n') : '- 아직 충분한 반복 evidence가 없습니다.'}

## 금지어
| 표현 | 이유 |
|---|---|
| 왠지 모르게 | 감정 우회 원칙을 깨는 안이한 연결 |
| 심장이 쿵 (내려앉았다) | AI 클리셰, 이 문체의 절제와 충돌 |
| ~할 수밖에 없었다 | 수동적 서술로 리듬이 늘어짐 |
| 형용사 3연속 나열 | 묘사의 결이 장식으로 변질 |

## 금지 묘사
- 감정을 직접 명명하는 요약 문장("슬펐다", "화가 났다" 단독 사용).
- 시선, 고개, 침묵 반응 묘사의 연속 반복.
- 날씨로 감정을 대변하는 상투 도입.

## 리듬 규칙
- 문장 길이 참고 범위: ${Math.max(10, o.avgSentenceLen - 12)}~${o.avgSentenceLen + 15}자, 단문 비율 ${Math.max(10, o.shortRatio - 10)}~${o.shortRatio + 10}%.
- 대사 문장 비율 참고 범위: ${Math.max(0, o.dialogueRatio - 10)}~${o.dialogueRatio + 10}%.
- 종결어미는 ${o.endings.map((e) => e.form).slice(0, 3).join(', ')} 중심, 변칙 종결은 ${o.inversionRatio}% 내외로 절제.

## 로컬 PromptCapsule
${capsule}`;
}

export function mockProof(): string {
  return `> 오프라인 샘플입니다. AI 실행기를 연결하면 지침 기반 창작 샘플이 생성됩니다.

버스 정류장의 불빛이 한 번 깜빡였다. 여자는 우산을 반쯤 접은 채로 서 있었다. 물이 어깨선을 타고 내려와 손등에서 멈췄다.

"안 올 거야."

말은 그렇게 했지만, 여자는 도로 끝에서 눈을 떼지 않았다. 신호가 두 번 바뀌었다. 세 번째 신호에서, 우산이 완전히 접혔다.

### 자가 점검
- 감정을 직접 말하지 않고 우산과 물의 움직임에 얹었다.
- 대사 태그 없이 짧은 대사 한 줄로 리듬을 끊었다.
- 금지어(왠지 모르게, 심장이 쿵)를 사용하지 않았다.`;
}

export function mockGuideline(a: StyleAnalysis): string {
  const t = tone(a);
  const o = a.overall;
  return `# 문체 지침서

> 오프라인 기본 지침서입니다. AI 실행기를 연결해 다시 생성하면 감성 분석이 반영됩니다.

## 1. 문체 정체성
${t.pace} 문장 위에 ${t.emotion} 감정 처리를 얹고, ${t.dialogue} 방식으로 장면을 민다. 설명보다 행동과 감각을 앞세운다.

## 2. Evidence 기반 핵심 규칙
${a.bundle.evidenceRecords.length ? a.bundle.evidenceRecords.map((e) => `- ${e.featureId} (${e.globalityDecision}): ${e.candidateRule}`).join('\n') : '- 확정 evidence 부족. 샘플을 늘려 재분석한다.'}

## 3. 호흡과 리듬 규칙
- 기본 문장은 ${Math.max(10, o.avgSentenceLen - 12)}~${o.avgSentenceLen + 15}자. 긴장 장면에서는 짧게 끊는다.
- 단락은 3~5문장. 전환은 한 문장으로 처리한다.

## 4. 감정 표현 원칙
- 감정을 이름 붙이지 않는다. 사물, 행동, 감각에 얹는다.
- 감정어 밀도 참고치 ${o.emotionDensity}/1000자. 넘치면 절제부터 검토한다.

## 5. 묘사와 대화 운용
- 대사 문장 비율 ${Math.max(0, o.dialogueRatio - 10)}~${o.dialogueRatio + 10}%. 대사 태그는 최소화.
- 묘사는 장면을 미는 도구다. 장식 묘사는 삭제한다.

## 6. 장면 유형별 핵심 지침
- 대화: 대사 사이 행동 한 줄.
- 내면: 감각 우회.
- 긴장: 단문 연타.
- 전환: 한 문장.

## 7. 금지 목록
| 구분 | 항목 |
|---|---|
| 금지어 | 왠지 모르게 · 심장이 쿵 · ~할 수밖에 없었다 |
| 금지 묘사 | 감정 직접 명명 · 시선/고개/침묵 반복 · 날씨 감정 대변 |

## 8. 집필 전 체크리스트
1. 감정을 직접 말한 문장이 있는가? 있으면 사물에 얹어라.
2. 같은 반응 묘사가 두 번 나오는가? 있으면 행동으로 바꿔라.
3. 문장 길이에 완급이 있는가?
4. 대사 태그를 지울 수 있는가?
5. 원문 샘플의 문장을 복사하지 않았는가?`;
}

// Structured style system MVP exports: scene classification, style routing,
// style stack merge, PromptCapsule, scoring, and SkillPack file generation.
export * from './styleSystem';
