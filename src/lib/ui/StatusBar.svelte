<script lang="ts">
  import {
    activeRun, busy, cancelActiveRun, mode, pendingProposals, runDockOpen, runlog, settings, snapshots, stageLabel, uiMode
  } from '$lib/stores/app';

  const latestSnapshot = $derived($snapshots[0] ?? null);
  const agentLabel = $derived(
    $settings.offline ? '오프라인' : $settings.command ? $settings.command : '실행기 미설정'
  );
  const runLine = $derived($activeRun?.lines[$activeRun.lines.length - 1] ?? '');
  const advanced = $derived($uiMode === 'advanced');
</script>

<footer class="statusbar">
  <div class="primary">
    {#if $activeRun}
      <span class="chip info">{advanced ? $activeRun.stage : stageLabel($activeRun.stage)} · {$activeRun.scope}</span>
      <span class="mono line">{runLine || '실행 중'}</span>
      <button class="quiet cancel" onclick={cancelActiveRun} disabled={$activeRun.status === 'cancelling'}>
        {$activeRun.status === 'cancelling' ? '취소 중' : '취소'}
      </button>
    {:else if $busy}
      <span class="chip info">{$busy}</span>
      <span class="line">작업 정리 중</span>
    {:else}
      <span class="chip muted">대기</span>
      <span class="line">파일 기반 상태 최신</span>
    {/if}
  </div>

  <div class="meta">
    <button class="quiet" onclick={() => mode.set(advanced ? 'canon' : 'pending')}>보류 {$pendingProposals}</button>
    {#if advanced}
      <span class="sep"></span>
      <span title={latestSnapshot?.targetPath ?? ''}>스냅샷 {latestSnapshot ? latestSnapshot.targetPath : '없음'}</span>
      <span class="sep"></span>
      <button class="quiet" onclick={() => runDockOpen.update((v) => !v)}>run {$runlog.length}</button>
    {/if}
    <span class="sep"></span>
    <button class="quiet agent" class:warn={$settings.offline || !$settings.command} onclick={() => mode.set('settings')}>{agentLabel}</button>
  </div>
</footer>

<style>
  .statusbar {
    grid-area: status;
    min-width: 0;
    height: 28px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    padding: 3px 10px;
    border-top: 1px solid var(--line-strong);
    background: var(--bg-1);
    color: var(--muted);
    font-size: 11.5px;
  }
  .primary, .meta { min-width: 0; display: flex; align-items: center; gap: 6px; }
  .line {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .meta { white-space: nowrap; }
  .meta span { overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
  .sep { width: 1px; height: 14px; background: var(--line); }
  .cancel { color: var(--warn); }
  .agent { font-family: var(--mono); font-size: 11px; }
  .agent.warn { color: var(--warn); }
  @media (max-width: 860px) {
    .statusbar { grid-template-columns: minmax(0, 1fr); height: auto; min-height: 28px; }
    .meta { display: none; }
  }
</style>
