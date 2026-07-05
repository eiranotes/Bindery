<script lang="ts">
  // Diff 뷰 — 후보 vs 기준 원고. hunk 단위 선택 적용.
  import { diffLines, groupHunks, applyHunks, type Hunk } from '$lib/core/diff';

  let {
    base,
    next,
    onapply
  }: {
    base: string;
    next: string;
    onapply: (result: string, mode: 'all' | 'partial') => void;
  } = $props();

  const hunks = $derived(groupHunks(diffLines(base, next)));
  let selected = $state(new Set<number>());

  $effect(() => {
    // 후보가 바뀌면 기본 전체 선택
    selected = new Set(hunks.map((h) => h.id));
  });

  function toggle(h: Hunk) {
    const nextSet = new Set(selected);
    if (nextSet.has(h.id)) nextSet.delete(h.id);
    else nextSet.add(h.id);
    selected = nextSet;
  }

  function apply() {
    const result = applyHunks(base, hunks, selected);
    onapply(result, selected.size === hunks.length ? 'all' : 'partial');
  }
</script>

{#if hunks.length === 0}
  <p class="empty">기준 원고와 차이가 없습니다.</p>
{:else}
  <div class="diffbar">
    <span class="dim">{hunks.length}개 변경 구간 · {selected.size}개 선택</span>
    <button class="quiet" onclick={() => (selected = new Set(hunks.map((h) => h.id)))}>전체 선택</button>
    <button class="quiet" onclick={() => (selected = new Set())}>선택 해제</button>
    <button class="primary" onclick={apply} disabled={selected.size === 0}>선택 적용 (스냅샷 후)</button>
  </div>
  <div class="hunks">
    {#each hunks as h (h.id)}
      <div class="hunk" class:off={!selected.has(h.id)}>
        <button class="quiet head" onclick={() => toggle(h)}>
          <input type="checkbox" checked={selected.has(h.id)} tabindex="-1" />
          <span class="mono dim">L{h.baseStart + 1} 부근</span>
        </button>
        <pre class="pre">{#each h.lines as line}<span class={line.kind}>{line.kind === 'add' ? '+ ' : line.kind === 'del' ? '- ' : '  '}{line.text}
</span>{/each}</pre>
      </div>
    {/each}
  </div>
{/if}

<style>
  .diffbar { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .hunks { display: grid; gap: 10px; padding-top: 8px; max-height: 460px; overflow: auto; }
  .hunk { border: 1px solid var(--line); border-radius: 4px; overflow: hidden; }
  .hunk.off { opacity: 0.45; }
  .head { display: flex; gap: 8px; align-items: center; width: 100%; text-align: left; padding: 4px 8px; background: var(--bg-1); border: 0; border-bottom: 1px solid var(--line); border-radius: 0; }
  .pre { padding: 6px 8px; font-size: 11.5px; max-height: 220px; overflow: auto; }
  .pre .add { color: var(--ok); background: var(--ok-soft); display: inline; }
  .pre .del { color: var(--bad); background: var(--bad-soft); display: inline; text-decoration: line-through; }
</style>
