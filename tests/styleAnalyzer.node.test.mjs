import assert from 'node:assert/strict';

import { analyzeStyleLocally, paragraphCandidates, splitSentences } from '../apps/desktop/src/lib/domain/styleAnalyzer.ts';

const sentenceSeparatedSample = [
  '에이라는 말없이 자료를 넘겼다.',
  '그 시선은 서류 아래쪽에서 멈췄다.',
  '주인공은 고개를 끄덕였다.',
  '하지만 그 침묵은 오래 가지 않았다.',
  '시선이 다시 표의 끝으로 향했다.',
  '“숫자만 보면 통과예요.”',
  '에이라의 시선은 각주 위에서 다시 멈췄다.',
  '주인공은 또 고개를 끄덕였다.',
  '“하지만 이 부상 이력은 그냥 넘기면 안 됩니다.”',
  '잠시 뒤, 방 안의 공기가 낮게 가라앉았다.',
  '그는 서류를 덮고 창밖을 보았다.',
  '말은 없었지만 결정은 이미 끝나 있었다.'
].join('\n\n');

const sentenceCount = splitSentences(sentenceSeparatedSample).length;
const candidates = paragraphCandidates(sentenceSeparatedSample);
const bundle = analyzeStyleLocally(sentenceSeparatedSample);

assert.ok(sentenceCount >= 10, 'fixture should contain many sentence-like blocks');
assert.ok(candidates.length < sentenceCount / 2, `expected grouped scene candidates, got ${candidates.length} for ${sentenceCount} sentences`);
assert.equal(bundle.sceneRecords.length, candidates.length);
assert.ok(bundle.sceneRecords.every((scene) => scene.pacing.sentenceCount > 1), 'scene records should not be single-sentence records');

const explicitSplitSample = [
  '첫 장면은 자료와 침묵으로 시작했다. 그는 고개를 숙였다. 에이라는 답하지 않았다. 방 안의 빛이 낮았다.',
  '***',
  '두 번째 장면은 복도에서 이어졌다. 누군가 달려왔다. 문이 열리고 비명이 짧게 끊겼다. 그는 뒤돌아섰다.'
].join('\n');

assert.equal(paragraphCandidates(explicitSplitSample).length, 2, 'explicit separators should remain hard scene boundaries');

console.log('styleAnalyzer scene grouping smoke test ok');
