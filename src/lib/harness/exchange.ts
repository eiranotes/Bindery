// 웹 AI 교환 — CLI 대신 웹 AI(ChatGPT/Claude/Gemini)로 단계를 실행하는 우회로.
// export: 단계 프롬프트를 packet 파일로 저장 → 사용자가 웹 AI에 붙여넣기
// import: 웹 AI 응답을 붙여넣으면 같은 파서로 검증해 정식 산출물/제안으로 등록.
import { BLUEPRINTS } from '$lib/prompts';
import { renderBlueprint } from '$lib/core/blueprint';
import { exchangeDir } from '$lib/core/layout';
import { nowIso, stamp } from '$lib/core/text';
import type { Ctx } from './types';

export type ExchangeStage = 'idea-discovery' | 'world-expansion' | 'plot-plan' | 'episode-brief' | 'scene-plan' | 'draft-candidate' | 'canon-delta';

const EXPECTED: Record<ExchangeStage, string> = {
  'idea-discovery': 'bindery.idea_seed_batch.v1 JSON object',
  'world-expansion': 'bindery.world_expansion_proposal.v1 JSON object',
  'plot-plan': 'bindery.plot_plan.v1 JSON object',
  'episode-brief': 'bindery.episode_brief.v1 JSON object',
  'scene-plan': 'bindery.scene_plan.v1 JSON object',
  'draft-candidate': 'bindery.draft_candidate.v1 JSON object',
  'canon-delta': 'bindery.canon_delta_proposal.v1 JSON object'
};

export type ExchangePacket = {
  exchangeId: string;
  stage: ExchangeStage;
  packetPath: string;
  manifestPath: string;
  packet: string;
};

/** 단계 프롬프트를 packet으로 포장해 파일로 남긴다. */
export async function exportPacket(ctx: Ctx, stage: ExchangeStage, prompt: string): Promise<ExchangePacket> {
  const exchangeId = `xg-${stamp()}`;
  const dir = exchangeDir(exchangeId);
  const packet = renderBlueprint(BLUEPRINTS.webExchangePacket, {
    exchangeId,
    stage,
    createdAt: nowIso(),
    prompt,
    expectedOutput: EXPECTED[stage]
  });
  const packetPath = `${dir}/packet.md`;
  const manifestPath = `${dir}/manifest.json`;
  await ctx.bridge.writeFile(ctx.root, packetPath, packet);
  await ctx.bridge.writeFile(ctx.root, manifestPath, JSON.stringify({
    schema_version: 'bindery.web_exchange_manifest.v1',
    exchange_id: exchangeId,
    stage,
    created_at: nowIso(),
    expected_output: EXPECTED[stage],
    status: 'exported'
  }, null, 2));
  return { exchangeId, stage, packetPath, manifestPath, packet };
}

/** import 시 manifest 상태를 갱신하고 응답 원문을 보존한다. 파싱/등록은 호출부(각 단계 파서)가 한다. */
export async function recordImport(ctx: Ctx, exchangeId: string, responseText: string, accepted: boolean, reason?: string): Promise<void> {
  const dir = exchangeDir(exchangeId);
  await ctx.bridge.writeFile(ctx.root, `${dir}/response.md`, responseText);
  try {
    const manifest = JSON.parse(await ctx.bridge.readFile(ctx.root, `${dir}/manifest.json`)) as Record<string, unknown>;
    manifest.status = accepted ? 'imported' : 'rejected';
    manifest.imported_at = nowIso();
    if (reason) manifest.reject_reason = reason;
    await ctx.bridge.writeFile(ctx.root, `${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
  } catch {
    /* manifest 없이 붙여넣기만 한 경우 */
  }
}
