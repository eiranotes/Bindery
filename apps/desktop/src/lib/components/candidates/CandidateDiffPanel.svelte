<script lang="ts">
  import DiffView from '$lib/components/diff/DiffView.svelte';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { uiStore } from '$lib/stores/uiStore';
  import { toasts } from '$lib/stores/toastStore';
  import { createSnapshot } from '$lib/api/commands';
  import { projectStore } from '$lib/stores/projectStore';
  import { runDraftAction } from '$lib/actions/pipeline';
  import { diffLines, applyHunk } from '$lib/domain/diff';

  $: active = $candidateStore.candidates.find((c) => c.id === $candidateStore.activeId) || null;
  $: diff = active ? diffLines($editorStore.content, active.content) : null;

  function select(id: string) {
    candidateStore.update((s) => ({ ...s, activeId: id }));
  }

  async function applyAll() {
    if (!active) return;
    await ensureSessionSnapshot();
    const allHunks = new Set(diff?.hunks.map((h) => h.id) ?? []);
    editorStore.update((s) => ({ ...s, content: active!.content, dirty: active!.content !== s.savedContent }));
    candidateStore.update((s) => ({ ...s, appliedHunks: allHunks }));
    toasts.push('후보 전체 적용됨. 저장 전 검토', 'ok');
    uiStore.update((s) => ({ ...s, centerView: 'write' }));
  }

  async function applyOneHunk(hunkId: string) {
    if (!active || !diff) return;
    const hunk = diff.hunks.find((h) => h.id === hunkId);
    if (!hunk) return;
    await ensureSessionSnapshot();
    const next = applyHunk($editorStore.content, hunk);
    editorStore.update((s) => ({ ...s, content: next, dirty: next !== s.savedContent }));
    candidateStore.update((s) => {
      const applied = new Set(s.appliedHunks);
      applied.add(hunkId);
      return { ...s, appliedHunks: applied };
    });
    toasts.push(`${hunkId} 적용됨`, 'ok');
  }

  async function ensureSessionSnapshot() {
    if (!$editorStore.path) return;
    if ($candidateStore.sessionSnapshotId) return;
    const info = await createSnapshot($projectStore.current?.rootPath || 'sample-project', $editorStore.path, 'before-apply-candidate', $editorStore.content);
    candidateStore.update((s) => ({ ...s, sessionSnapshotId: info.id }));
    toasts.push(`스냅샷 생성됨 ${info.id}`, 'info');
  }

  function discard() {
    candidateStore.set({ candidates: [], activeId: null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null });
    uiStore.update((s) => ({ ...s, centerView: 'write' }));
  }
</script>

<div class="cand-panel">
  <div class="cand-toolbar">
    <div class="cand-tabs">
      {#each $candidateStore.candidates as c}
        <button class="cand-tab" class:on={c.id === $candidateStore.activeId} on:click={() => select(c.id)}>
          {c.label}
        </button>
      {/each}
    </div>
    <div class="cand-actions">
      <button class="ghost tiny" on:click={() => runDraftAction('draft')} disabled={$candidateStore.generating}>다시 생성</button>
      <button class="ghost tiny" on:click={discard}>버리기</button>
    </div>
  </div>

  {#if $candidateStore.generating}
    <div class="cand-empty"><div class="spinner"></div> 후보 생성 중…</div>
  {:else if !active}
    <div class="cand-empty">
      <p>후보가 없습니다.</p>
      <p class="muted">AI 작업 화면에서 <b>초안 후보</b>를 실행하거나, 에디터에서 <code>/draft</code>를 입력하세요.</p>
      <button on:click={() => runDraftAction('draft')}>후보 생성</button>
    </div>
  {:else}
    <div class="cand-source">
      {active.source}
      {#if $candidateStore.sessionSnapshotId}
        <span class="snap">스냅샷: {$candidateStore.sessionSnapshotId}</span>
      {/if}
    </div>
    <div class="apply-bar">
      <button class="primary" on:click={applyAll}>전체 적용 (스냅샷 후)</button>
      <span class="muted small">AI 출력은 후보입니다. 첫 적용 전에 원본이 스냅샷됩니다.</span>
    </div>
    {#if diff}
      <div class="diff-host">
        <DiffView {diff} appliedHunks={$candidateStore.appliedHunks} onApplyHunk={applyOneHunk} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .cand-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; }
  .cand-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line); gap: 8px; }
  .cand-tabs { display: flex; gap: 6px; overflow-x: auto; }
  .cand-tab { padding: 6px 11px; border-radius: 9px; background: var(--hover); border: 1px solid transparent; color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .cand-tab.on { color: var(--text); border-color: var(--accent-2); background: var(--accent-2-soft); }
  .cand-actions { display: flex; gap: 6px; }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .cand-source { padding: 6px 12px; font-family: ui-monospace, monospace; font-size: 11px; color: var(--faint); display:flex; gap: 12px; align-items:center; }
  .snap { color: var(--accent-2); border: 1px solid var(--line); border-radius: 999px; padding: 2px 7px; }
  .apply-bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .small { font-size: 11px; }
  .muted { color: var(--muted); }
  .diff-host { min-height: 0; overflow: auto; flex: 1; display: flex; flex-direction: column; }
  .cand-empty { padding: 32px 20px; text-align: center; color: var(--text); display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .cand-empty .muted { color: var(--muted); font-size: 13px; }
  .cand-empty code { background: var(--accent-soft); padding: 1px 6px; border-radius: 5px; font-family: ui-monospace, monospace; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--line); border-top-color: var(--accent-2); border-radius: 50%; display: inline-block; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
