<script lang="ts">
  import type { DiffResult } from '$lib/domain/diff';

  export let diff: DiffResult;
  export let appliedHunks: Set<string> = new Set();
  export let onApplyHunk: ((hunkId: string) => void) | null = null;
  export let onRevertHunk: ((hunkId: string) => void) | null = null;
  export let view: 'unified' | 'split' = 'unified';
</script>

<div class="diff-head">
  <div class="diff-counts">
    <span class="add">+{diff.added}</span>
    <span class="del">−{diff.removed}</span>
    <span class="muted">묶음 {diff.hunks.length}개</span>
  </div>
  <div class="seg">
    <button class="seg-btn" class:on={view === 'unified'} on:click={() => (view = 'unified')}>통합</button>
    <button class="seg-btn" class:on={view === 'split'} on:click={() => (view = 'split')}>분할</button>
  </div>
</div>

{#if diff.hunks.length === 0}
  <div class="diff-empty">변경 사항이 없습니다. 후보가 현재 원고와 동일합니다.</div>
{:else}
  <div class="diff-scroll">
    {#each diff.hunks as hunk}
      {@const applied = appliedHunks.has(hunk.id)}
      <div class="hunk" class:applied>
        <div class="hunk-bar">
          <span class="hunk-label">{hunk.id} · <span class="add">+{hunk.added}</span> <span class="del">−{hunk.removed}</span></span>
          {#if applied}
            {#if onRevertHunk}
              <button class="mini ghost" on:click={() => onRevertHunk?.(hunk.id)}>되돌리기</button>
            {:else}
              <button class="mini ghost" disabled>적용됨</button>
            {/if}
          {:else}
            <button class="mini" on:click={() => onApplyHunk?.(hunk.id)}>이 묶음 적용</button>
          {/if}
        </div>
        {#if view === 'unified'}
          <div class="rows">
            {#each hunk.rows as row}
              <div class="row {row.op}">
                <span class="gutter">{row.oldLine ?? ''}</span>
                <span class="gutter">{row.newLine ?? ''}</span>
                <span class="sign">{row.op === 'add' ? '+' : row.op === 'remove' ? '−' : ' '}</span>
                <span class="text">{row.text || ' '}</span>
              </div>
            {/each}
          </div>
        {:else}
          <div class="split">
            <div class="col">
              {#each hunk.rows.filter((r) => r.op !== 'add') as row}
                <div class="row {row.op === 'remove' ? 'remove' : 'equal'}"><span class="gutter">{row.oldLine ?? ''}</span><span class="text">{row.text || ' '}</span></div>
              {/each}
            </div>
            <div class="col">
              {#each hunk.rows.filter((r) => r.op !== 'remove') as row}
                <div class="row {row.op === 'add' ? 'add' : 'equal'}"><span class="gutter">{row.newLine ?? ''}</span><span class="text">{row.text || ' '}</span></div>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  .diff-head { display: flex; align-items: center; justify-content: space-between; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .diff-counts { display: flex; gap: 12px; font-size: 12.5px; font-family: ui-monospace, monospace; }
  .add { color: var(--ok); }
  .del { color: var(--bad); }
  .muted { color: var(--faint); }
  .seg { display: inline-flex; background: var(--hover); border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
  .seg-btn { background: transparent; border: 0; padding: 4px 9px; border-radius: 6px; color: var(--muted); font-size: 11.5px; }
  .seg-btn.on { background: var(--accent-soft); color: var(--text); }
  .diff-empty { padding: 24px; text-align: center; color: var(--muted); }
  .diff-scroll { overflow: auto; padding: 10px; display: flex; flex-direction: column; gap: 12px; }
  .hunk { border: 1px solid var(--line); border-radius: 12px; overflow: hidden; background: var(--bg); }
  .hunk.applied { opacity: .62; border-color: rgba(52,211,153,.4); }
  .hunk-bar { display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: var(--hover); border-bottom: 1px solid var(--line); font-family: ui-monospace, monospace; font-size: 11px; }
  .mini { padding: 4px 9px; border-radius: 7px; font-size: 11px; }
  .mini:disabled { opacity: .65; cursor: default; }
  .mini.ghost { background: var(--chip); }
  .rows, .col { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; line-height: 1.7; }
  .split { display: grid; grid-template-columns: 1fr 1fr; }
  .split .col { border-right: 1px solid var(--line); }
  .split .col:last-child { border-right: 0; }
  .row { display: grid; grid-template-columns: auto auto auto 1fr; gap: 0; white-space: pre-wrap; word-break: break-word; padding: 0 6px; }
  .split .row { grid-template-columns: 40px 1fr; }
  .row.add { background: rgba(52,211,153,.1); }
  .row.remove { background: rgba(251,113,133,.1); }
  .gutter { color: var(--faint); text-align: right; padding-right: 10px; min-width: 34px; user-select: none; font-size: 11px; }
  .sign { color: var(--faint); width: 14px; text-align: center; user-select: none; }
  .row.add .sign { color: var(--ok); }
  .row.remove .sign { color: var(--bad); }
  .text { color: var(--text); }
</style>
