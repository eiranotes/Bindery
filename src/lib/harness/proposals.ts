// Proposal 레지스트리 — AI 제안(세계관 확장·정사 변경)의 저장·결정·반영.
// 규칙: AI는 여기까지만 온다. canon 파일 쓰기는 항상 사람의 승인(decide→apply)을 거친다.
// 반영 전에는 대상 파일 스냅샷을 만든다.
import { LAYOUT, proposalPath, proposalIndexPath } from '$lib/core/layout';
import { nowIso, stamp, slugify } from '$lib/core/text';
import { snapshotFile } from './snapshots';
import type { Ctx } from './types';
import type { WorldExpansionProposal, WorldAsset, CanonDeltaProposal, CanonChange, WorldAssetKind } from '$lib/schemas/contracts';

export type ProposalStatus = 'pending' | 'applied' | 'partial' | 'rejected';
export type ItemDecision = 'pending' | 'approved' | 'rejected';

export type WorldExpansionRecord = {
  id: string;
  type: 'world-expansion';
  status: ProposalStatus;
  createdAt: string;
  decidedAt?: string;
  source: string;
  payload: WorldExpansionProposal;
  decisions: ItemDecision[];
  appliedPaths: string[];
};

export type CanonDeltaRecord = {
  id: string;
  type: 'canon-delta';
  episode: string;
  status: ProposalStatus;
  createdAt: string;
  decidedAt?: string;
  source: string;
  payload: CanonDeltaProposal;
  decisions: ItemDecision[];
  appliedPaths: string[];
};

export type Proposal = WorldExpansionRecord | CanonDeltaRecord;

export type ProposalIndexEntry = {
  id: string;
  type: Proposal['type'];
  status: ProposalStatus;
  createdAt: string;
  title: string;
  itemCount: number;
};

function itemCount(p: Proposal): number {
  return p.type === 'world-expansion' ? p.payload.assets.length : p.payload.changes.length;
}

function title(p: Proposal): string {
  return p.type === 'world-expansion'
    ? `세계관 확장 · 자산 ${p.payload.assets.length}건`
    : `정사 변경 · ${p.episode} · 변경 ${p.payload.changes.length}건`;
}

export async function saveProposal(ctx: Ctx, proposal: Proposal): Promise<void> {
  await ctx.bridge.writeFile(ctx.root, proposalPath(proposal.id), JSON.stringify(proposal, null, 2));
  let index: ProposalIndexEntry[] = [];
  try {
    index = JSON.parse(await ctx.bridge.readFile(ctx.root, proposalIndexPath())) as ProposalIndexEntry[];
  } catch {
    /* 첫 proposal */
  }
  const entry: ProposalIndexEntry = {
    id: proposal.id,
    type: proposal.type,
    status: proposal.status,
    createdAt: proposal.createdAt,
    title: title(proposal),
    itemCount: itemCount(proposal)
  };
  index = [entry, ...index.filter((e) => e.id !== proposal.id)];
  await ctx.bridge.writeFile(ctx.root, proposalIndexPath(), JSON.stringify(index.slice(0, 200), null, 2));
}

export async function loadProposals(ctx: Ctx): Promise<Proposal[]> {
  let index: ProposalIndexEntry[] = [];
  try {
    index = JSON.parse(await ctx.bridge.readFile(ctx.root, proposalIndexPath())) as ProposalIndexEntry[];
  } catch {
    return [];
  }
  const out: Proposal[] = [];
  for (const entry of index) {
    try {
      out.push(JSON.parse(await ctx.bridge.readFile(ctx.root, proposalPath(entry.id))) as Proposal);
    } catch {
      /* 지워진 proposal */
    }
  }
  return out;
}

export function registerWorldExpansion(payload: WorldExpansionProposal, source: string): WorldExpansionRecord {
  return {
    id: `wx-${stamp()}`,
    type: 'world-expansion',
    status: 'pending',
    createdAt: nowIso(),
    source,
    payload,
    decisions: payload.assets.map(() => 'pending' as ItemDecision),
    appliedPaths: []
  };
}

export function registerCanonDelta(payload: CanonDeltaProposal, source: string): CanonDeltaRecord {
  return {
    id: `cd-${stamp()}`,
    type: 'canon-delta',
    episode: payload.episode,
    status: 'pending',
    createdAt: nowIso(),
    source,
    payload,
    decisions: payload.changes.map(() => 'pending' as ItemDecision),
    appliedPaths: []
  };
}

export function decideItem<T extends Proposal>(proposal: T, index: number, decision: ItemDecision): T {
  const decisions = [...proposal.decisions];
  decisions[index] = decision;
  return { ...proposal, decisions };
}

// ---------------------------------------------------------------------------
// 반영 (apply) — 승인 항목만 실제 파일이 된다
// ---------------------------------------------------------------------------

const ASSET_DIR: Record<WorldAssetKind, string> = {
  character: LAYOUT.characters,
  location: LAYOUT.world.locations,
  institution: LAYOUT.world.institutions,
  system: LAYOUT.world.systems,
  rule: 'world/rules',
  term: 'world/terms',
  relationship: LAYOUT.relationships,
  conflict: 'plot/conflicts'
};

export function assetTargetPath(asset: WorldAsset): string {
  return `${ASSET_DIR[asset.kind]}/${slugify(asset.name)}.md`;
}

export function renderAssetFile(asset: WorldAsset, proposalId: string): string {
  return [
    '---',
    `schema: bindery.world_asset.v1`,
    `kind: ${asset.kind}`,
    `name: ${asset.name}`,
    `status: canon`,
    `needed_by: ${asset.needed_by}`,
    `approved_from: ${proposalId}`,
    '---',
    '',
    `# ${asset.name}`,
    '',
    `> 기능: ${asset.one_line_function}`,
    '',
    asset.detail_md.trim(),
    '',
    ...(asset.risk ? ['## 주의 (제안 시점 리스크)', `- ${asset.risk}`, ''] : [])
  ].join('\n');
}

/** 승인된 항목을 반영한다. 반환: 갱신된 proposal. */
export async function applyProposal(ctx: Ctx, proposal: Proposal): Promise<Proposal> {
  const appliedPaths: string[] = [...proposal.appliedPaths];

  if (proposal.type === 'world-expansion') {
    for (let i = 0; i < proposal.payload.assets.length; i++) {
      if (proposal.decisions[i] !== 'approved') continue;
      const asset = proposal.payload.assets[i];
      const target = assetTargetPath(asset);
      if (appliedPaths.includes(target)) continue;
      await snapshotFile(ctx, target, `세계관 자산 반영 전 (${proposal.id})`);
      await ctx.bridge.writeFile(ctx.root, target, renderAssetFile(asset, proposal.id));
      appliedPaths.push(target);
    }
  } else {
    for (let i = 0; i < proposal.payload.changes.length; i++) {
      if (proposal.decisions[i] !== 'approved') continue;
      const change = proposal.payload.changes[i];
      if (appliedPaths.includes(`${change.target_path}#${i}`)) continue;
      await applyCanonChange(ctx, change, proposal.id, proposal.episode);
      appliedPaths.push(`${change.target_path}#${i}`);
    }
  }

  const allDecided = proposal.decisions.every((d) => d !== 'pending');
  const anyApproved = proposal.decisions.some((d) => d === 'approved');
  const anyRejected = proposal.decisions.some((d) => d === 'rejected');
  const status: ProposalStatus = !anyApproved && allDecided ? 'rejected' : anyRejected || !allDecided ? 'partial' : 'applied';
  const next: Proposal = { ...proposal, appliedPaths, status, decidedAt: nowIso() } as Proposal;
  await saveProposal(ctx, next);
  return next;
}

/** canon 변경 적용 — 파괴적 수정 대신 "회차 표식이 있는 append"를 쓴다.
 *  사람이 나중에 파일을 정리하는 것을 전제로 한 안전한 병합 방식이다. */
async function applyCanonChange(ctx: Ctx, change: CanonChange, proposalId: string, episode: string): Promise<void> {
  const marker = `<!-- bindery canon-delta · ${proposalId} · ${episode} · ${change.change_type} -->`;
  let existing = '';
  try {
    existing = await ctx.bridge.readFile(ctx.root, change.target_path);
  } catch {
    /* create 케이스 */
  }
  if (existing) {
    await snapshotFile(ctx, change.target_path, `정사 변경 반영 전 (${proposalId})`, episode);
    if (existing.includes(marker)) return; // 같은 proposal 재적용 방지
    const appended = `${existing.trimEnd()}\n\n${marker}\n${change.patch.trim()}\n`;
    await ctx.bridge.writeFile(ctx.root, change.target_path, appended);
  } else {
    await ctx.bridge.writeFile(ctx.root, change.target_path, `${marker}\n${change.patch.trim()}\n`);
  }
}

export function pendingCount(proposals: Proposal[]): number {
  return proposals.filter((p) => p.status === 'pending' || p.status === 'partial').length;
}
