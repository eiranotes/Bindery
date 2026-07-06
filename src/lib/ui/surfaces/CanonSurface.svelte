<script lang="ts">
  // 제안·정사 화면 - 모든 proposal(세계관 확장·정사 변경)의 승인/거부, 반영.
  // 여기는 "AI가 제안, 사람이 확정"의 관문이다.
  import { ctx, proposals, withBusy, toast } from '$lib/stores/app';
  import { decideItem, applyProposal, assetTargetPath, type Proposal, type ItemDecision } from '$lib/harness/proposals';

  let showDone = $state(false);

  const visible = $derived(
    $proposals.filter((p) => showDone || p.status === 'pending' || p.status === 'partial')
  );

  function decisionOf(p: Proposal, i: number): ItemDecision {
    return p.decisions[i] ?? 'pending';
  }

  async function decide(p: Proposal, i: number, d: ItemDecision) {
    const next = decideItem(p, i, d);
    proposals.update((list) => list.map((x) => (x.id === p.id ? next : x)));
  }

  function decideAll(p: Proposal, d: ItemDecision) {
    const next = { ...p, decisions: p.decisions.map(() => d) } as Proposal;
    proposals.update((list) => list.map((x) => (x.id === p.id ? next : x)));
  }

  async function apply(p: Proposal) {
    const approved = p.decisions.filter((d) => d === 'approved').length;
    if (approved === 0 && p.decisions.some((d) => d === 'pending')) {
      toast('먼저 각 항목을 승인 또는 거부로 결정하세요', 'warn');
      return;
    }
    await withBusy('proposal 반영', async () => {
      const result = await applyProposal(ctx(), p);
      toast(
        approved > 0
          ? `${approved}건 반영됨 (대상 파일은 스냅샷 후 갱신) · 상태: ${result.status}`
          : '모든 항목이 거부 처리되었습니다',
        approved > 0 ? 'ok' : 'info'
      );
    });
  }

  const riskLabel: Record<string, string> = { low: '낮음', medium: '중간', high: '높음' };
  const statusLabel: Record<string, string> = { pending: '대기', partial: '일부 결정', applied: '반영됨', rejected: '거부됨' };
</script>

<div class="surface">
  <header class="head">
    <h1>제안 · 정사</h1>
    <p class="dim">AI 제안은 여기서 멈춥니다. 승인한 항목만 canon 파일이 되며, 반영 전 대상 파일은 스냅샷으로 보존됩니다.</p>
    <label class="inline"><input type="checkbox" bind:checked={showDone} /> 처리 완료 포함</label>
  </header>

  {#if visible.length === 0}
    <p class="empty">표시할 proposal이 없습니다. 세계관 확장이나 회차 요약 후 정사 변경 제안이 여기 옵니다.</p>
  {/if}

  {#each visible as p (p.id)}
    <section class="proposal">
      <header class="prow">
        <span class="chip {p.type === 'canon-delta' ? 'warn' : 'info'}">{p.type === 'canon-delta' ? '정사 변경' : '세계관 확장'}</span>
        <b>{p.type === 'canon-delta' ? `${p.episode} · 변경 ${p.payload.changes.length}건` : `자산 ${p.payload.assets.length}건`}</b>
        <span class="dim mono">{p.id} · {new Date(p.createdAt).toLocaleString()}</span>
        <span class="chip {p.status === 'applied' ? 'ok' : p.status === 'rejected' ? 'bad' : 'muted'}">{statusLabel[p.status]}</span>
        <span class="spacer"></span>
        {#if p.status === 'pending' || p.status === 'partial'}
          <button class="quiet" onclick={() => decideAll(p, 'approved')}>전체 승인</button>
          <button class="quiet" onclick={() => decideAll(p, 'rejected')}>전체 거부</button>
          <button class="primary" onclick={() => apply(p)}>결정 반영</button>
        {/if}
      </header>

      {#if p.type === 'world-expansion'}
        {#if p.payload.premise}<p class="dim">전제: {p.payload.premise}</p>{/if}
        <table class="grid">
          <thead><tr><th>자산</th><th>종류</th><th>기능</th><th>생성될 파일</th><th>리스크</th><th>결정</th></tr></thead>
          <tbody>
            {#each p.payload.assets as asset, i}
              <tr class:approved={decisionOf(p, i) === 'approved'} class:rejected={decisionOf(p, i) === 'rejected'}>
                <td><b>{asset.name}</b><details><summary class="dim">상세</summary><pre class="pre">{asset.detail_md}</pre></details></td>
                <td class="mono">{asset.kind}</td>
                <td>{asset.one_line_function}</td>
                <td class="mono dim">{assetTargetPath(asset)}</td>
                <td class="dim">{asset.risk || '-'}</td>
                <td class="acts">
                  {#if p.status === 'pending' || p.status === 'partial'}
                    <button class="quiet" class:on={decisionOf(p, i) === 'approved'} onclick={() => decide(p, i, 'approved')}>승인</button>
                    <button class="quiet" class:on={decisionOf(p, i) === 'rejected'} onclick={() => decide(p, i, 'rejected')}>거부</button>
                  {:else}
                    <span class="chip {decisionOf(p, i) === 'approved' ? 'ok' : 'bad'}">{decisionOf(p, i) === 'approved' ? '승인' : '거부'}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if p.payload.story_license_notes.length}
          <p class="dim">열어둔 것: {p.payload.story_license_notes.join(' · ')}</p>
        {/if}
      {:else}
        <table class="grid">
          <thead><tr><th>대상 파일</th><th>변경</th><th>요약</th><th>patch 미리보기</th><th>위험</th><th>결정</th></tr></thead>
          <tbody>
            {#each p.payload.changes as change, i}
              <tr class:approved={decisionOf(p, i) === 'approved'} class:rejected={decisionOf(p, i) === 'rejected'}>
                <td class="mono">{change.target_path}</td>
                <td class="mono">{change.change_type}</td>
                <td>{change.summary}</td>
                <td><details><summary class="dim">보기</summary><pre class="pre">{change.patch}</pre></details></td>
                <td><span class="chip {change.risk === 'high' ? 'bad' : change.risk === 'medium' ? 'warn' : 'ok'}">{riskLabel[change.risk]}</span></td>
                <td class="acts">
                  {#if p.status === 'pending' || p.status === 'partial'}
                    <button class="quiet" class:on={decisionOf(p, i) === 'approved'} onclick={() => decide(p, i, 'approved')}>승인</button>
                    <button class="quiet" class:on={decisionOf(p, i) === 'rejected'} onclick={() => decide(p, i, 'rejected')}>거부</button>
                  {:else}
                    <span class="chip {decisionOf(p, i) === 'approved' ? 'ok' : 'bad'}">{decisionOf(p, i) === 'approved' ? '승인' : '거부'}</span>
                  {/if}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      {/if}
      {#if p.appliedPaths.length}
        <p class="dim">반영된 파일: {p.appliedPaths.map((x) => x.split('#')[0]).join(', ')}</p>
      {/if}
    </section>
  {/each}
</div>

<style>
  .surface { padding: 20px 28px; display: grid; gap: 18px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .head p { margin: 2px 0 4px; }
  .inline { display: flex; gap: 5px; align-items: center; font-size: 12px; color: var(--muted); }
  .proposal { display: grid; gap: 8px; border-top: 1px solid var(--line-strong); padding-top: 10px; }
  .prow { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .spacer { flex: 1; }
  tr.approved { background: var(--ok-soft); }
  tr.rejected { opacity: 0.5; }
  .acts { white-space: nowrap; }
  .acts button.on { border-color: var(--accent); color: var(--text); background: var(--accent-soft); }
  details summary { cursor: pointer; }
  details .pre { max-height: 200px; overflow: auto; padding: 6px; background: var(--bg-1); border: 1px solid var(--line); border-radius: 4px; margin-top: 4px; font-size: 11px; }
</style>
