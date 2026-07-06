<script lang="ts">
  // 하단 run 로그 도크 - 실행 trace 목록. 프롬프트 원문은 .bindery/trace/ 파일로 남는다.
  import { runlog, selectedRun, runDockOpen } from '$lib/stores/app';

  function fmtMs(ms: number): string {
    return ms < 1000 ? `${ms}ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60000).toFixed(1)}m`;
  }
</script>

<section class="dock">
  <header>
    <span class="label">실행 기록 (이번 세션 {$runlog.length}건 · 전체는 .bindery/runs/)</span>
    <button class="quiet" onclick={() => runDockOpen.set(false)}>닫기</button>
  </header>
  <div class="body">
    {#if $runlog.length === 0}
      <p class="empty">아직 실행이 없습니다.</p>
    {:else}
      <table class="grid">
        <thead><tr><th>시각</th><th>단계</th><th>범위</th><th>경로</th><th>시간</th><th>exit</th><th>프롬프트/출력</th></tr></thead>
        <tbody>
          {#each $runlog as r (r.runId)}
            <tr onclick={() => selectedRun.set(r)} class:on={$selectedRun?.runId === r.runId}>
              <td class="mono">{r.startedAt.slice(11, 19)}</td>
              <td class="mono">{r.stage}</td>
              <td class="mono">{r.scope}</td>
              <td>
                {#if r.source === 'agent'}<span class="chip ok">AI</span>{:else}<span class="chip warn">폴백</span>{/if}
                {#if r.repairUsed}<span class="chip muted">repair</span>{/if}
              </td>
              <td class="mono">{fmtMs(r.durationMs)}</td>
              <td class="mono">{r.exitCode ?? '-'}</td>
              <td class="mono dim">{r.promptChars.toLocaleString()} / {r.outputChars.toLocaleString()}자</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {/if}
  </div>
</section>

<style>
  .dock {
    grid-area: dock;
    min-height: 0;
    border-top: 1px solid var(--line-strong);
    background: var(--bg-1);
    display: grid; grid-template-rows: auto minmax(0, 1fr);
  }
  header { display: flex; justify-content: space-between; align-items: center; padding: 6px 14px; border-bottom: 1px solid var(--line); }
  .body { overflow: auto; padding: 0 14px 10px; }
  tbody tr { cursor: pointer; }
  tbody tr:hover, tbody tr.on { background: var(--accent-soft); }
</style>
