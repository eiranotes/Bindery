// 문체 재현 도메인 — 샘플 텍스트를 장면 단위로 쪼개 정량 분석하고,
// AI에게 보낼 감성 분석/지침/재현 프롬프트를 조립한다.
// 정량값은 "참고치"로만 쓰고, 최종 목표는 읽었을 때의 느낌 재현이다.

export type SceneStats = {
  index: number;
  title: string;
  text: string;
  chars: number;
  sentenceCount: number;
  avgSentenceLen: number;
  shortRatio: number; // 20자 이하 문장 비율
  longRatio: number; // 60자 이상 문장 비율
  dialogueRatio: number; // 대화 글자 비중
  emotionDensity: number; // 1000자당 감정어 수
  emotionWords: string[];
  endings: Array<{ form: string; count: number }>;
  inversionRatio: number; // 평서형 종결(-다/-까/-요 등)이 아닌 문장 비율
  commaPerSentence: number;
  topAdverbs: string[];
};

export type StyleAnalysis = {
  scenes: SceneStats[];
  overall: Omit<SceneStats, 'index' | 'title' | 'text'>;
};

const EMOTION_STEMS = [
  '두려', '떨리', '떨렸', '울', '웃', '눈물', '분노', '슬픔', '슬프', '기쁨', '기쁘',
  '설레', '불안', '초조', '그리움', '그리워', '씁쓸', '아득', '먹먹', '시리', '아프',
  '아팠', '저릿', '뜨겁', '뜨거', '차갑', '차가', '두근', '숨이', '가슴', '심장',
  '외로', '허전', '벅차', '조마', '섬뜩', '오싹', '애틋', '서러', '부끄'
];

const PLAIN_ENDING = /(다|까|요|죠|지|네|군|라|니|오|가)[.!?…"”』」\s]*$/;

function splitSentences(text: string): string[] {
  return text
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?…])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

function dialogueChars(text: string): number {
  let sum = 0;
  for (const m of text.matchAll(/[“"]([^”"]*)[”"]/g)) sum += m[1].length;
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (t.startsWith('—') || t.startsWith('-') === false) continue;
  }
  return sum;
}

function endingForm(sentence: string): string {
  const cleaned = sentence.replace(/[.!?…"”』」\s]+$/, '');
  return cleaned.slice(-2) || cleaned;
}

/** 장면 나누기 — 구분자(***, ---, #) 우선, 없으면 문단 묶음으로 나눈다. */
export function splitScenes(sample: string): string[] {
  const trimmed = sample.trim();
  if (!trimmed) return [];
  const byMarker = trimmed
    .split(/\n\s*(?:\*\s*\*\s*\*|---+|#{1,3}\s[^\n]*)\s*\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (byMarker.length > 1) return byMarker.slice(0, 10);

  const paragraphs = trimmed.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length <= 6) return [trimmed];
  const per = Math.ceil(paragraphs.length / Math.min(6, Math.ceil(paragraphs.length / 6)));
  const scenes: string[] = [];
  for (let i = 0; i < paragraphs.length; i += per) {
    scenes.push(paragraphs.slice(i, i + per).join('\n\n'));
  }
  return scenes.slice(0, 10);
}

function analyzeChunk(text: string): Omit<SceneStats, 'index' | 'title' | 'text'> {
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

  return {
    chars,
    sentenceCount: sentences.length,
    avgSentenceLen: Math.round(avg * 10) / 10,
    shortRatio: sentences.length ? Math.round((short / sentences.length) * 100) : 0,
    longRatio: sentences.length ? Math.round((long / sentences.length) * 100) : 0,
    dialogueRatio: chars ? Math.min(100, Math.round((dialogueChars(text) / chars) * 100)) : 0,
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
  const sceneTexts = splitScenes(sample);
  const scenes = sceneTexts.map((text, i) => {
    const firstLine = text.split('\n')[0].replace(/^#+\s*/, '').slice(0, 24);
    return { index: i + 1, title: firstLine || `장면 ${i + 1}`, text, ...analyzeChunk(text) };
  });
  return { scenes, overall: analyzeChunk(sample) };
}

// ---------------------------------------------------------------------------
// 정량 분석 요약(프롬프트/표시용)
// ---------------------------------------------------------------------------

export function statsMarkdown(a: StyleAnalysis): string {
  const row = (s: SceneStats) =>
    `| ${s.index} | ${s.title} | ${s.sentenceCount} | ${s.avgSentenceLen} | ${s.shortRatio}% | ${s.dialogueRatio}% | ${s.emotionDensity} | ${s.inversionRatio}% | ${s.endings.map((e) => `${e.form}(${e.count})`).join(' ')} |`;
  return [
    '| 장면 | 도입부 | 문장 수 | 평균 길이 | 단문 비율 | 대화 비중 | 감정어/1k | 변칙 종결 | 주요 어미 |',
    '|---|---|---|---|---|---|---|---|---|',
    ...a.scenes.map(row)
  ].join('\n');
}

// ---------------------------------------------------------------------------
// AI 프롬프트 조립 — 정량값을 복사 지시가 아닌 "참고치"로 못박고,
// 감성적 인상(호흡, 온도, 거리감)을 끌어내는 데 집중시킨다.
// ---------------------------------------------------------------------------

const COMMON_RULES = `규칙:
- 정량 수치는 참고치일 뿐이다. 수치를 맞추는 것이 아니라 "읽었을 때의 느낌"을 재현하는 것이 목표다.
- 원문 문장을 그대로 복사하거나 어절만 바꿔 재사용하는 것을 금지한다.
- 한국어로만 답한다. 마크다운 형식을 지킨다.`;

export function buildExtractPrompt(sample: string, analysis: StyleAnalysis): string {
  return `너는 소설 문체 분석가다. 아래 샘플 텍스트의 문체를 장면별로 분석하라.

${COMMON_RULES}

각 장면에 대해 다음을 마크다운으로 정리하라:
1. **호흡과 리듬** — 문장이 흐르는 속도감, 끊는 지점, 리듬의 완급.
2. **감정 처리 방식** — 감정을 직접 말하는가, 사물/행동/풍경에 얹는가. 감정 언어의 온도.
3. **시선과 거리감** — 서술자가 인물과 얼마나 가까운가, 관찰자인가 동승자인가.
4. **묘사의 결** — 어떤 감각(시각/청각/촉각)을 편애하는가, 묘사가 장식인가 서사인가.
5. **대화의 기능** — 대화가 정보 전달인가 침묵의 연장인가, 대사 태그 처리 방식.
6. **서술 도치·변칙** — 어순을 비트는 순간과 그 효과.
마지막에 "## 전체 문체 인상"으로 이 작가의 문체를 한 문단으로 요약하라.

## 정량 참고치
${statsMarkdown(analysis)}

## 샘플 텍스트
${sample.slice(0, 6000)}`;
}

export function buildGuidePrompt(sample: string, analysis: StyleAnalysis, extract: string): string {
  return `너는 소설 문체 코치다. 아래 문체 분석을 바탕으로, 다른 작가(또는 AI)가 이 문체로 새 장면을 쓸 때 따라야 할 실행 지침을 작성하라.

${COMMON_RULES}
- 지침은 "무엇을 하라"는 동사형 문장으로 쓴다. 추상적 형용사 나열을 금지한다.

다음 구조로 작성하라:
## 장면 유형별 작성 지침
장면 유형(예: 대화 중심, 내면 묘사, 행동/긴장, 전환부)별로 4~6개의 구체 지침.
## 금지어
이 문체를 깨뜨리는 단어·표현 목록(각각 이유 한 줄). AI 클리셰(예: "왠지 모르게", "심장이 쿵", 과잉 감탄)를 반드시 점검하라.
## 금지 묘사
이 문체와 어울리지 않는 묘사 습관 목록(각각 이유 한 줄).
## 리듬 규칙
문장 길이 완급, 단락 전환, 종결어미 운용에 대한 참고치 기반 규칙(수치는 범위로).

## 문체 분석
${extract.slice(0, 4000)}

## 정량 참고치
${statsMarkdown(analysis)}

## 샘플 발췌
${sample.slice(0, 2500)}`;
}

export function buildProofPrompt(guide: string, extract: string, sample: string): string {
  return `너는 소설가다. 아래 문체 지침을 따라, **원문에 존재하지 않는 완전히 새로운 장면**을 한국어로 400~700자 작성하라.

${COMMON_RULES}
- 원문의 인물·소재를 쓰지 말고, 새로운 상황(예: 낯선 도시의 밤, 오래된 약속을 확인하는 두 사람 등)을 스스로 정하라.
- 지침의 금지어/금지 묘사를 절대 사용하지 마라.
- 장면 끝에 "### 자가 점검"으로 지침을 어떻게 지켰는지 3줄로 적어라.

## 문체 지침
${guide.slice(0, 3500)}

## 문체 인상 요약
${extract.slice(0, 1500)}

## 원문 발췌(느낌 참고용 — 문장 재사용 금지)
${sample.slice(0, 1500)}`;
}

export function buildGuidelinePrompt(extract: string, guide: string, proof: string, analysis: StyleAnalysis): string {
  return `너는 소설 문체 편집자다. 아래 재료를 통합해 이 작가의 **최종 문체 지침서**를 작성하라. 이 지침서는 AI가 매 회차 집필 때 프롬프트에 그대로 들어간다. 2000자 이내로 밀도 있게 쓰라.

${COMMON_RULES}

구조:
# 문체 지침서
## 1. 문체 정체성 (한 문단 — 이 문체를 처음 접하는 사람에게 설명하듯)
## 2. 호흡과 리듬 규칙
## 3. 감정 표현 원칙 (직접 진술 대신 무엇에 감정을 얹는가)
## 4. 묘사와 대화 운용
## 5. 장면 유형별 핵심 지침 (유형당 2~3줄)
## 6. 금지 목록 (금지어 / 금지 묘사 — 표)
## 7. 집필 전 체크리스트 (5문항)

## 재료 1 — 문체 분석
${extract.slice(0, 3000)}

## 재료 2 — 작성 지침·금지 목록
${guide.slice(0, 3000)}

## 재료 3 — 재현 테스트 결과
${proof.slice(0, 1500)}

## 재료 4 — 정량 참고치
${statsMarkdown(analysis)}`;
}

// ---------------------------------------------------------------------------
// 오프라인(데모/CLI 미연결) 생성기 — 정량 분석에서 파생한 기본 문서.
// AI 산출물이 아님을 문서 안에 명시한다.
// ---------------------------------------------------------------------------

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
      (s) => `### 장면 ${s.index} — ${s.title}
- 호흡: 평균 ${s.avgSentenceLen}자, 단문 ${s.shortRatio}% — ${s.avgSentenceLen <= 25 ? '끊어치는 리듬' : '이어 감는 리듬'}.
- 감정 처리: 감정어 밀도 ${s.emotionDensity}/1k${s.emotionWords.length ? ` (${s.emotionWords.slice(0, 4).join(', ')})` : ''}.
- 대화 비중: ${s.dialogueRatio}% — ${s.dialogueRatio >= 30 ? '대화가 장면을 민다' : '서술이 장면을 민다'}.
- 변칙 종결: ${s.inversionRatio}% — ${s.inversionRatio >= 25 ? '어순·종결을 자주 비튼다' : '정격 종결이 기본'}.
- 주요 어미: ${s.endings.map((e) => e.form).join(', ') || '-'}.`
    )
    .join('\n\n');
  return `> ⚠ 오프라인 기본 분석입니다. AI 실행기를 연결하면 감성 분석이 더 깊어집니다.

${scenes}

## 전체 문체 인상
${t.pace} 문장에 ${t.emotion} 감정 처리, ${t.dialogue} 구성. 쉼표 ${a.overall.commaPerSentence}/문장, 자주 쓰는 부사(${a.overall.topAdverbs.join(', ') || '두드러진 것 없음'}).`;
}

export function mockGuide(a: StyleAnalysis): string {
  const t = tone(a);
  const o = a.overall;
  return `> ⚠ 오프라인 기본 지침입니다. AI 실행기를 연결하면 장면별 지침이 정교해집니다.

## 장면 유형별 작성 지침
- **대화 장면**: 대사 사이에 짧은 행동 한 줄을 끼워 리듬을 만든다. 대사 태그는 최소화한다.
- **내면 장면**: 감정을 이름 붙이지 말고 사물·감각으로 우회한다 (${t.emotion} 방식 유지).
- **긴장 장면**: 문장을 평균(${o.avgSentenceLen}자)보다 짧게 끊고, 단락도 짧게 자른다.
- **전환부**: 시간·장소 이동은 한 문장으로 처리하고 설명을 늘어놓지 않는다.

## 금지어
| 표현 | 이유 |
|---|---|
| 왠지 모르게 | 감정 우회 원칙을 깨는 안이한 연결 |
| 심장이 쿵 (내려앉았다) | AI 클리셰, 이 문체의 절제와 충돌 |
| ~할 수밖에 없었다 | 수동적 서술로 리듬이 늘어짐 |
| 형용사 3연속 나열 | 묘사의 결이 장식으로 변질 |

## 금지 묘사
- 감정을 직접 명명하는 요약 문장("슬펐다", "화가 났다" 단독 사용).
- 시선·고개·침묵 반응 묘사의 연속 반복.
- 날씨로 감정을 대변하는 상투 도입.

## 리듬 규칙
- 문장 길이 참고 범위: ${Math.max(10, o.avgSentenceLen - 12)}~${o.avgSentenceLen + 15}자, 단문 비율 ${Math.max(10, o.shortRatio - 10)}~${o.shortRatio + 10}%.
- 대화 비중 참고 범위: ${Math.max(0, o.dialogueRatio - 10)}~${o.dialogueRatio + 10}%.
- 종결어미는 ${o.endings.map((e) => e.form).slice(0, 3).join(', ')} 중심, 변칙 종결은 ${o.inversionRatio}% 내외로 절제.`;
}

export function mockProof(): string {
  return `> ⚠ 오프라인 샘플입니다. AI 실행기를 연결하면 지침 기반 창작 샘플이 생성됩니다.

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

> ⚠ 오프라인 기본 지침서입니다. AI 실행기를 연결해 다시 생성하면 감성 분석이 반영됩니다.

## 1. 문체 정체성
${t.pace} 문장 위에 ${t.emotion} 감정 처리를 얹고, ${t.dialogue} 방식으로 장면을 민다. 설명보다 행동과 감각을 앞세운다.

## 2. 호흡과 리듬 규칙
- 기본 문장은 ${Math.max(10, o.avgSentenceLen - 12)}~${o.avgSentenceLen + 15}자. 긴장 장면에서는 짧게 끊는다.
- 단락은 3~5문장. 전환은 한 문장으로 처리한다.

## 3. 감정 표현 원칙
- 감정을 이름 붙이지 않는다. 사물·행동·감각에 얹는다.
- 감정어 밀도 참고치 ${o.emotionDensity}/1000자 — 넘치면 절제부터.

## 4. 묘사와 대화 운용
- 대화 비중 ${Math.max(0, o.dialogueRatio - 10)}~${o.dialogueRatio + 10}%. 대사 태그는 최소화.
- 묘사는 장면을 미는 도구다. 장식 묘사는 삭제한다.

## 5. 장면 유형별 핵심 지침
- 대화: 대사 사이 행동 한 줄. / 내면: 감각 우회. / 긴장: 단문 연타. / 전환: 한 문장.

## 6. 금지 목록
| 구분 | 항목 |
|---|---|
| 금지어 | 왠지 모르게 · 심장이 쿵 · ~할 수밖에 없었다 |
| 금지 묘사 | 감정 직접 명명 · 시선/고개/침묵 반복 · 날씨 감정 대변 |

## 7. 집필 전 체크리스트
1. 감정을 직접 말한 문장이 있는가? → 사물에 얹어라.
2. 같은 반응 묘사가 두 번 나오는가? → 행동으로 바꿔라.
3. 문장 길이에 완급이 있는가?
4. 대사 태그를 지울 수 있는가?
5. 원문(샘플)의 문장을 복사하지 않았는가?`;
}
