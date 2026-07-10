// AI 산출물 품질 회귀 테스트 — 제품에 새면 안 되는 흔적을 결정적으로 잡는다.
import { describe, expect, it } from 'vitest';
import { scoreDraftQuality } from '../src/lib/harness/quality';

const goodDraft = [
  '# 1화',
  '',
  '미도리는 젖은 계단 앞에서 멈춰 섰다. 유리문 너머의 불빛은 오래된 약속처럼 흔들렸고, 손바닥에 남은 메모의 잉크는 비에 번져 이름 하나만 남겼다.',
  '',
  '가게 안쪽에서 점장이 고개를 들었다. 그는 놀라지 않았고, 그래서 미도리는 더 불안해졌다. 오늘 밤 이곳에 오면 모든 답을 들을 수 있다고 했지만, 정작 문턱을 넘는 순간 질문이 달라졌다.',
  '',
  '“들어와도 돼.”',
  '',
  '그 한마디가 허락인지 경고인지 알 수 없었다. 미도리는 숨을 고르고 문을 열었다. 방울 소리가 울리는 동안, 벽시계의 초침은 정확히 한 칸 뒤로 물러났다.'
].join('\n');

describe('초안 품질 게이트', () => {
  it('충분한 본문과 필수 요소가 있으면 통과한다', () => {
    const report = scoreDraftQuality(goodDraft, { minChars: 120, mustInclude: ['미도리', '점장'] });
    expect(report.status).toBe('pass');
    expect(report.issues).toEqual([]);
  });

  it('fallback과 placeholder 누출은 실패로 잡는다', () => {
    const report = scoreDraftQuality('# ep001\n\n> AI 실행기가 연결되지 않아 초안을 생성하지 못했습니다.\n\n(TODO)', { minChars: 10 });
    expect(report.status).toBe('fail');
    expect(report.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['fallback-leak', 'placeholder']));
  });

  it('필수 요소 누락과 반복 문단은 warn으로 남긴다', () => {
    const repeated = ['첫 문단은 충분히 길어서 품질 계산 대상이 됩니다.'].join('\n\n');
    const report = scoreDraftQuality(`${repeated}\n\n${repeated}\n\n${repeated}`, {
      minChars: 20,
      mustInclude: ['열쇠'],
      maxRepeatedParagraphRatio: 0.1
    });
    expect(report.status).toBe('warn');
    expect(report.issues.map((i) => i.code)).toEqual(expect.arrayContaining(['missing-required', 'repetition']));
  });
});
