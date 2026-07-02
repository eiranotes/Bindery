<script lang="ts">
  import { onMount } from 'svelte';
  import DiffView from '$lib/components/diff/DiffView.svelte';
  import { createSnapshot, listSnapshots, readFile } from '$lib/api/commands';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { toasts } from '$lib/stores/toastStore';
  import { openFileInEditor } from '$lib/actions/project';
  import { diffLines } from '$lib/domain/diff';
  import type { DiffResult } from '$lib/domain/diff';
  import type { SnapshotInfo } from '$lib/types';

  let snapshots: SnapshotInfo[] = [];
  let busy = false;
  let error = '';
  let loadedFor = '';

  // 비교 모달 상태
  let compareTarget: SnapshotInfo | null = null;
  let compareDiff: DiffResult | null = null;
  let compareContent = '';

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

  async function openCompare(s: SnapshotInfo) {
    try {
      compareContent = await readFile(projectPath, s.snapshotPath);
      // 대상 파일이 열려 있으면 편집 버퍼와, 아니면 디스크의 대상 파일과 비교
      const current = $editorStore.path === s.targetPath ? $editorStore.content : await readFile(projectPath, s.targetPath);
      compareDiff = diffLines(current, compareContent);
      compareTarget = s;
    } catch (e) {
      toasts.push(`스냅샷 읽기 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    }
  }

  async function restore(s: SnapshotInfo, content?: string) {
    try {
      const text = content ?? (await readFile(projectPath, s.snapshotPath));
      // 복원 전 현재 상태를 안전 스냅샷으로 남긴다
      if ($editorStore.path !== s.targetPath) {
        await openFileInEditor(s.targetPath, 'stay');
      }
      await createSnapshot(projectPath, s.targetPath, 'before-restore', $editorStore.content);
      editorStore.update((st) => ({ ...st, content: text, dirty: text !== st.savedContent }));
      compareTarget = null;
      compareDiff = null;
      await load();
      toasts.push(`복원됨: ${s.id} → ${s.targetPath} (저장 전 검토하세요)`, 'ok');
    } catch (e) {
      toasts.push(`복원 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
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
      <span class="snap-name">{s.label || s.id}</span>
      <span class="badge">{new Date(s.createdAt).toLocaleTimeString()}</span>
      <div class="snap-actions">
        <button class="ghost tiny" on:click={() => openCompare(s)}>비교</button>
        <button class="ghost tiny" on:click={() => restore(s)}>복원</button>
      </div>
    </div>
  {/each}
</div>

{#if compareTarget && compareDiff}
  <div class="cmp-backdrop">
    <button class="cmp-close-area" aria-label="닫기" on:click={() => { compareTarget = null; compareDiff = null; }}></button>
    <div class="cmp" role="dialog" aria-modal="true">
      <div class="cmp-head">
        <span class="eyebrow">스냅샷 비교 — {compareTarget.label || compareTarget.id} · {compareTarget.targetPath}</span>
        <div class="cmp-head-actions">
          <button class="primary tiny" on:click={() => compareTarget && restore(compareTarget, compareContent)}>이 스냅샷으로 복원</button>
          <button class="ghost tiny" on:click={() => { compareTarget = null; compareDiff = null; }}>닫기</button>
        </div>
      </div>
      <div class="cmp-body">
        <p class="cmp-note">기준: 현재 원고 → 스냅샷. 복원하면 현재 상태가 먼저 안전 스냅샷으로 저장됩니다.</p>
        <DiffView diff={compareDiff} />
      </div>
    </div>
  </div>
{/if}

<style>
  .snap-sub { margin-top: 8px; font-size: 11.5px; color: var(--faint); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .snap-error { margin-top: 8px; color: var(--bad); background: var(--bad-soft); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 7px 8px; font-size: 12px; }
  .empty { color: var(--muted); margin: 10px 0 0; }
  .snap-row { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 8px; align-items: center; padding: 7px 0; border-top: 1px solid var(--line); font-size: 12.5px; }
  .snap-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .snap-actions { display: flex; gap: 4px; }
  .tiny { padding: 3px 8px; font-size: 11px; }

  .cmp-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 160; display: flex; align-items: center; justify-content: center; }
  .cmp-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .cmp { position: relative; width: min(880px, 94vw); max-height: 86vh; display: flex; flex-direction: column; background: var(--pop); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-pop); }
  .cmp-head { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  .cmp-head-actions { display: flex; gap: 6px; }
  .cmp-body { min-height: 0; overflow: auto; padding: 12px 16px; display: flex; flex-direction: column; }
  .cmp-note { margin: 0 0 10px; color: var(--faint); font-size: 12px; }
</style>
