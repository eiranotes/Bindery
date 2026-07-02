<script lang="ts">
  import { onMount } from 'svelte';
  import { createSnapshot, listSnapshots } from '$lib/api/commands';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { toasts } from '$lib/stores/toastStore';
  import type { SnapshotInfo } from '$lib/types';

  let snapshots: SnapshotInfo[] = [];
  let busy = false;
  let error = '';
  let loadedFor = '';

  $: projectPath = $projectStore.current?.rootPath || 'sample-project';
  $: selectedPath = $editorStore.path;

  async function load() {
    if (!$projectStore.current) return;
    try {
      snapshots = await listSnapshots(projectPath);
      error = '';
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }
  }

  async function snap() {
    if (!selectedPath) {
      toasts.push('스냅샷을 만들 파일을 먼저 선택하세요', 'warn');
      return;
    }
    busy = true;
    error = '';
    try {
      const info = await createSnapshot(projectPath, selectedPath, 'panel-snapshot', $editorStore.content);
      snapshots = [info, ...snapshots.filter((s) => s.id !== info.id)];
      toasts.push(`스냅샷 생성: ${selectedPath}`, 'ok');
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
      toasts.push(`스냅샷 실패: ${error}`, 'bad');
    } finally {
      busy = false;
    }
  }

  onMount(load);
  $: if ($projectStore.current && projectPath !== loadedFor) { loadedFor = projectPath; load(); }
</script>
<div class="card">
  <div class="kpi"><strong>스냅샷</strong><button class="ghost" on:click={snap} disabled={busy || !selectedPath}>{busy ? '생성 중...' : '만들기'}</button></div>
  <div class="snap-sub">{selectedPath || '파일을 선택하면 현재 편집 버퍼를 저장합니다.'}</div>
  {#if error}<div class="snap-error">{error}</div>{/if}
  {#if snapshots.length === 0}<p class="empty">이번 세션에 만든 스냅샷이 없습니다.</p>{/if}
  {#each snapshots as s}
    <div class="snap-row" title={s.snapshotPath}>
      <span>{s.label || s.id}</span>
      <span class="badge">{new Date(s.createdAt).toLocaleTimeString()}</span>
    </div>
  {/each}
</div>

<style>
  .snap-sub { margin-top: 8px; font-size: 11.5px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .snap-error { margin-top: 8px; color: var(--bad); background: var(--bad-soft); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 7px 8px; font-size: 12px; }
  .empty { color: var(--muted); margin: 10px 0 0; }
  .snap-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); font-size: 12.5px; }
  .snap-row span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
