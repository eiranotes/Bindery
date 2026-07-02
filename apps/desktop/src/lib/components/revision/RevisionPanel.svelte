<script lang="ts">
  import { revisionStore } from '$lib/stores/revisionStore';
  import { runRevisionAction, runDraftAction } from '$lib/actions/pipeline';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import type { RevisionStatus } from '$lib/domain/reports';

  const severityLabel = { fail: '필수', warn: '주의', info: '참고' } as const;

  function cycle(id: string) {
    revisionStore.update((s) => ({
      ...s,
      items: s.items.map((it) => {
        if (it.id !== id) return it;
        const next: Record<RevisionStatus, RevisionStatus> = { todo: 'applied', applied: 'skipped', skipped: 'todo' };
        return { ...it, status: next[it.status] };
      })
    }));
  }
  $: done = $revisionStore.items.filter((i) => i.status !== 'todo').length;
</script>

<div class="card">
  <div class="kpi">
    <strong>수정 계획</strong>
    <div class="rev-head">
      {#if $revisionStore.items.length}<span class="prog">{done}/{$revisionStore.items.length}</span>{/if}
      <button class="ghost tiny" on:click={runRevisionAction} disabled={$revisionStore.generating}>{$revisionStore.generating ? '...' : '생성'}</button>
    </div>
  </div>

  {#if $revisionStore.items.length === 0}
    <p class="muted">QA 이후 수정 계획을 생성하거나, QA 이슈에서 항목을 추가하세요.</p>
  {:else}
    {#each $revisionStore.items as item}
      <div class="rev {item.status}">
        <button class="box {item.status}" on:click={() => cycle(item.id)} title="상태 전환">
          {item.status === 'applied' ? '✓' : item.status === 'skipped' ? '−' : ''}
        </button>
        <div class="rev-body">
          <span class="rev-text">{item.text}</span>
          <div class="rev-meta">
            <span class="sev {item.severity}">{severityLabel[item.severity]}</span>
            {#if item.lineStart}<button class="loc" on:click={() => gotoLine(item.lineStart ?? 1)}>L{item.lineStart}</button>{/if}
          </div>
        </div>
      </div>
    {/each}
    <button class="primary apply-rev" on:click={() => runDraftAction('revise')}>수정 반영 후보 생성</button>
  {/if}
</div>

<style>
  .rev-head { display: flex; align-items: center; gap: 8px; }
  .prog { font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .muted { color: var(--muted); font-size: 13px; }
  .rev { display: flex; gap: 9px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .rev.applied { opacity: .55; }
  .rev.skipped { opacity: .45; }
  .rev.skipped .rev-text { text-decoration: line-through; }
  .box { width: 20px; height: 20px; flex-shrink: 0; border: 1px solid var(--line); border-radius: 6px; background: transparent; color: var(--ok); font-size: 12px; padding: 0; margin-top: 1px; }
  .box.applied { border-color: rgba(52,211,153,.5); }
  .box.skipped { color: var(--faint); }
  .rev-body { flex: 1; }
  .rev-text { font-size: 13px; line-height: 1.5; }
  .rev-meta { display: flex; gap: 6px; align-items: center; margin-top: 5px; }
  .sev { font-size: 9.5px; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 5px; }
  .sev.fail { color: var(--bad); background: var(--bad-soft); }
  .sev.warn { color: var(--warn); background: var(--warn-soft); }
  .sev.info { color: var(--accent-2); background: var(--accent-2-soft); }
  .loc { padding: 2px 7px; font-size: 10.5px; font-family: ui-monospace, monospace; background: var(--accent-soft); border: 0; border-radius: 6px; color: var(--accent); }
  .apply-rev { width: 100%; margin-top: 10px; }
</style>
