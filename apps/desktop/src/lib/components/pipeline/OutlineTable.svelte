<script lang="ts">
  import { outlineStore } from '$lib/stores/outlineStore';
  import { runOutlineAction, approveOutlineAction, updateOutlineRowAction } from '$lib/actions/pipeline';
  import { settingsStore } from '$lib/stores/settingsStore';

  let episodeCount = 8;
  $: outline = $outlineStore.outline;
  $: approvedCount = outline ? outline.rows.filter((row) => row.status === 'approved').length : 0;

  async function generate() {
    await runOutlineAction(episodeCount);
  }
  async function approveAll() {
    if (!outline) return;
    await approveOutlineAction();
  }
  async function toggleApprove(episode: string, current: 'draft' | 'approved') {
    if (current === 'approved') {
      // 승인 해제 — 파일에만 반영하고 플롯 보드는 건드리지 않는다.
      await updateOutlineRowAction(episode, { status: 'draft' });
    } else {
      await approveOutlineAction([episode]);
    }
  }
  function updateField(episode: string, key: 'title' | 'logline' | 'risk', event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    void updateOutlineRowAction(episode, { [key]: target.value });
  }
  function updateList(episode: string, key: 'beats' | 'threads', event: Event) {
    const target = event.currentTarget as HTMLInputElement;
    const list = target.value.split(/\s*[,;/]\s*/).filter(Boolean);
    void updateOutlineRowAction(episode, { [key]: list });
  }
</script>

<div class="outline">
  <div class="head">
    <div class="head-left">
      <b>작품 아웃라인</b>
      <span class="hint">바이블/원천 자료에서 회별 계획을 만들고, 승인한 회차만 플롯 보드로 내려갑니다.</span>
    </div>
    <div class="head-right">
      <label class="ep-count">
        회차 수
        <input type="number" min="1" max="60" bind:value={episodeCount} />
      </label>
      <button class="primary" on:click={generate} disabled={$outlineStore.generating}>{$outlineStore.generating ? '생성 중…' : outline ? '다시 제안' : 'AI 아웃라인 제안'}</button>
      {#if outline}
        <button class="ghost" on:click={approveAll}>전체 승인 · 플롯 반영</button>
      {/if}
    </div>
  </div>

  {#if $settingsStore.mockMode}
    <p class="mode-note">데모 모드입니다. AI 실행기 대신 로컬 뼈대 아웃라인이 생성됩니다.</p>
  {/if}

  {#if !outline}
    <p class="empty">아직 아웃라인이 없습니다. 「AI 아웃라인 제안」을 실행하세요. AI 미연결 상태에서는 뼈대 아웃라인이 만들어집니다.</p>
  {:else}
    <div class="meta">
      <span>{outline.rows.length}화 · 승인 {approvedCount}</span>
      <span>·</span>
      <span class="src">{outline.source === 'agent' ? 'AI 제안' : '로컬 뼈대'}</span>
      <span>·</span>
      <span class="mono">{outline.updatedAt.slice(0, 16).replace('T', ' ')}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:64px">회차</th>
          <th style="width:180px">제목</th>
          <th>로그라인</th>
          <th style="width:180px">필수 beat</th>
          <th style="width:140px">떡밥</th>
          <th style="width:160px">리스크</th>
          <th style="width:88px">승인</th>
        </tr>
      </thead>
      <tbody>
        {#each outline.rows as row (row.episode)}
          <tr class:approved={row.status === 'approved'}>
            <td class="mono">{row.episode}</td>
            <td><input value={row.title} on:change={(e) => updateField(row.episode, 'title', e)} /></td>
            <td><input value={row.logline} on:change={(e) => updateField(row.episode, 'logline', e)} /></td>
            <td><input value={row.beats.join(' / ')} on:change={(e) => updateList(row.episode, 'beats', e)} placeholder="구분자: , ; /" /></td>
            <td><input value={row.threads.join(', ')} on:change={(e) => updateList(row.episode, 'threads', e)} /></td>
            <td><input value={row.risk} on:change={(e) => updateField(row.episode, 'risk', e)} /></td>
            <td class="approve-cell">
              <button
                class="approve-btn {row.status}"
                on:click={() => toggleApprove(row.episode, row.status)}
                title={row.status === 'approved' ? '승인 해제' : '이 회차 승인 · 플롯 보드 반영'}
              >{row.status === 'approved' ? '승인' : '검토'}</button>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .outline { display: grid; gap: 10px; align-content: start; }
  .head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); flex-wrap: wrap; }
  .head-left { display: grid; gap: 3px; }
  .head-left b { font-size: 14.5px; }
  .hint { color: var(--muted); font-size: 12px; line-height: 1.5; }
  .head-right { display: flex; align-items: center; gap: 8px; }
  .ep-count { display: flex; align-items: center; gap: 6px; color: var(--muted); font-size: 12px; }
  .ep-count input { width: 60px; }
  .mode-note { margin: 0; color: var(--warn); font-size: 11.5px; }
  .empty { margin: 6px 0; color: var(--muted); font-size: 12.5px; line-height: 1.6; }
  .meta { display: flex; gap: 6px; align-items: center; color: var(--faint); font-size: 11.5px; }
  .meta .src { color: var(--accent); }
  .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; }
  th, td { text-align: left; padding: 6px 6px; border-bottom: 1px solid var(--line); vertical-align: middle; }
  th { color: var(--faint); font-size: 10px; text-transform: uppercase; letter-spacing: .07em; font-weight: 800; }
  input { width: 100%; background: transparent; border: 1px solid transparent; border-radius: 3px; padding: 3px 6px; color: var(--text); font-size: 12.5px; }
  input:focus { border-color: var(--line-strong); background: var(--bg-2); outline: none; }
  tr.approved { background: color-mix(in srgb, var(--ok) 4%, transparent); }
  .approve-cell { text-align: center; }
  .approve-btn { border: 1px solid var(--line-strong); background: var(--bg-2); border-radius: 4px; padding: 3px 10px; font-size: 11.5px; color: var(--muted); font-weight: 650; }
  .approve-btn.approved { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 50%, transparent); background: var(--ok-soft); }
</style>
