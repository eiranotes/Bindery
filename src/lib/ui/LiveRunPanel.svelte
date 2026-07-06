<script lang="ts">
  // 실시간 실행 패널 — CLI stdout을 그대로 스트리밍해 대기 시간을 체감으로 바꾼다.
  // runFeed(전체 흐름 누적) + activeRun(현재 단계)을 함께 보여준다.
  import { activeRun, runFeed, cancelActiveRun, stageLabel } from '$lib/stores/app';

  let { title = 'AI 실행 중' }: { title?: string } = $props();

  let pre: HTMLPreElement | undefined = $state();
  let follow = $state(true);

  $effect(() => {
    void $runFeed;
    if (pre && follow) pre.scrollTop = pre.scrollHeight;
  });

  function onScroll() {
    if (!pre) return;
    follow = pre.scrollHeight - pre.scrollTop - pre.clientHeight < 40;
  }

  const elapsed = $derived.by(() => {
    if (!$activeRun) return '';
    const s = Math.max(0, Math.round((Date.now() - new Date($activeRun.startedAt).getTime()) / 1000));
    return s < 60 ? `${s}초` : `${Math.floor(s / 60)}분 ${s % 60}초`;
  });
</script>

<section class="stream">
  <header>
    <span class="pulse" class:idle={!$activeRun}></span>
    <b>{$activeRun ? `${stageLabel($activeRun.stage)} · ${$activeRun.scope}` : title}</b>
    {#if $activeRun}<span class="dim">{elapsed}</span>{/if}
    <span class="grow"></span>
    {#if $activeRun}
      <button class="quiet cancel" onclick={cancelActiveRun} disabled={$activeRun.status === 'cancelling'}>
        {$activeRun.status === 'cancelling' ? '취소 중' : '취소'}
      </button>
    {/if}
  </header>
  <pre bind:this={pre} onscroll={onScroll}>{$runFeed || '실행 출력이 여기 실시간으로 표시됩니다.'}</pre>
</section>

<style>
  .stream {
    border: 1px solid var(--line);
    border-radius: 4px;
    background: var(--bg-1);
    overflow: hidden;
    display: grid;
    grid-template-rows: auto minmax(0, 1fr);
  }
  header {
    display: flex; align-items: center; gap: 10px;
    padding: 8px 12px;
    border-bottom: 1px solid var(--line);
    font-size: 12.5px; color: var(--muted);
  }
  header b { color: var(--text); font-weight: 650; }
  .grow { flex: 1; }
  .pulse {
    width: 8px; height: 8px; border-radius: 50%;
    background: var(--accent);
    animation: pulse 1.4s ease-in-out infinite;
  }
  .pulse.idle { animation: none; background: var(--faint); }
  @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
  @media (prefers-reduced-motion: reduce) { .pulse { animation: none; } }
  pre {
    margin: 0;
    padding: 12px 14px;
    font: 11.5px/1.6 var(--mono);
    color: var(--muted);
    background: var(--bg-desk);
    max-height: 300px;
    min-height: 140px;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
  .cancel { color: var(--warn); }
</style>
