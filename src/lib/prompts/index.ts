// 블루프린트 레지스트리 — prompts/*.prompt.md 원본을 ?raw로 읽는다.
// 프롬프트 문자열을 코드에 내장하지 않는 것이 규칙이다 (Prompt transparency).
import type { Blueprint } from '$lib/core/blueprint';
import ideaDiscovery from '$prompts/idea_discovery.prompt.md?raw';
import ideaTriage from '$prompts/idea_triage.prompt.md?raw';
import worldExpansion from '$prompts/world_expansion.prompt.md?raw';
import bibleAssembly from '$prompts/bible_assembly.prompt.md?raw';
import plotPlan from '$prompts/plot_plan.prompt.md?raw';
import episodeBrief from '$prompts/episode_brief.prompt.md?raw';
import scenePlan from '$prompts/scene_plan.prompt.md?raw';
import draftCandidate from '$prompts/draft_candidate.prompt.md?raw';
import contextDistill from '$prompts/context_distill.prompt.md?raw';
import styleAnalysis from '$prompts/style_analysis.prompt.md?raw';
import qaStyle from '$prompts/qa_style.prompt.md?raw';
import qaContinuity from '$prompts/qa_continuity.prompt.md?raw';
import qaCanon from '$prompts/qa_canon.prompt.md?raw';
import revisionPlan from '$prompts/revision_plan.prompt.md?raw';
import revisionCandidate from '$prompts/revision_candidate.prompt.md?raw';
import summary from '$prompts/summary.prompt.md?raw';
import canonDelta from '$prompts/canon_delta.prompt.md?raw';
import webExchangePacket from '$prompts/web_exchange_packet.prompt.md?raw';

function bp(id: string, file: string, template: string): Blueprint {
  return { id, file, template };
}

export const BLUEPRINTS = {
  ideaDiscovery: bp('idea-discovery', 'prompts/idea_discovery.prompt.md', ideaDiscovery),
  ideaTriage: bp('idea-triage', 'prompts/idea_triage.prompt.md', ideaTriage),
  worldExpansion: bp('world-expansion', 'prompts/world_expansion.prompt.md', worldExpansion),
  bibleAssembly: bp('bible-assembly', 'prompts/bible_assembly.prompt.md', bibleAssembly),
  plotPlan: bp('plot-plan', 'prompts/plot_plan.prompt.md', plotPlan),
  episodeBrief: bp('episode-brief', 'prompts/episode_brief.prompt.md', episodeBrief),
  scenePlan: bp('scene-plan', 'prompts/scene_plan.prompt.md', scenePlan),
  draftCandidate: bp('draft-candidate', 'prompts/draft_candidate.prompt.md', draftCandidate),
  contextDistill: bp('context-distill', 'prompts/context_distill.prompt.md', contextDistill),
  styleAnalysis: bp('style-analysis', 'prompts/style_analysis.prompt.md', styleAnalysis),
  qaStyle: bp('qa-style', 'prompts/qa_style.prompt.md', qaStyle),
  qaContinuity: bp('qa-continuity', 'prompts/qa_continuity.prompt.md', qaContinuity),
  qaCanon: bp('qa-canon', 'prompts/qa_canon.prompt.md', qaCanon),
  revisionPlan: bp('revision-plan', 'prompts/revision_plan.prompt.md', revisionPlan),
  revisionCandidate: bp('revision-candidate', 'prompts/revision_candidate.prompt.md', revisionCandidate),
  summary: bp('summary', 'prompts/summary.prompt.md', summary),
  canonDelta: bp('canon-delta', 'prompts/canon_delta.prompt.md', canonDelta),
  webExchangePacket: bp('web-exchange-packet', 'prompts/web_exchange_packet.prompt.md', webExchangePacket)
} as const;

export type BlueprintKey = keyof typeof BLUEPRINTS;
