<script lang="ts">
  // 파일 화면 - 프로젝트 전체 트리를 직접 편집. Markdown-native 원칙의 안전판:
  // 어떤 산출물이든 여기서 열어 사람이 직접 고칠 수 있다.
  import { ctx, tree, snapshots, withBusy, toast, refreshAll } from '$lib/stores/app';
  import type { FileNode } from '$lib/bridge';
  import { restoreSnapshot, type SnapshotMeta } from '$lib/harness/snapshots';
  import MarkdownEditor from '../MarkdownEditor.svelte';

  let openPath = $state<string | null>(null);
  let content = $state('');
  let savedContent = $state('');
  let showHidden = $state(false);

  const dirty = $derived(content !== savedContent);

  function visibleNodes(nodes: FileNode[]): FileNode[] {
    return nodes.filter((n) => showHidden || !n.name.startsWith('.'));
  }

  async function open(path: string) {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 버리고 이동할까요?')) return;
    content = await ctx().bridge.readFile(ctx().root, path);
    savedContent = content;
    openPath = path;
  }

  async function save() {
    if (!openPath) return;
    await withBusy('파일 저장', async () => {
      await ctx().bridge.writeFile(ctx().root, openPath!, content);
      savedContent = content;
      toast(`저장됨: ${openPath}`, 'ok');
    }, false);
  }

  async function restore(meta: SnapshotMeta) {
    if (!confirm(`${meta.targetPath} 파일을 스냅샷 ${meta.id} 시점으로 복원할까요? 현재 상태도 복원 전 백업으로 남습니다.`)) return;
    await withBusy('스냅샷 복원', async () => {
      await restoreSnapshot(ctx(), meta);
      if (openPath === meta.targetPath) {
        content = await ctx().bridge.readFile(ctx().root, meta.targetPath);
        savedContent = content;
      }
      await refreshAll();
      toast(`복원됨: ${meta.targetPath}`, 'ok');
    }, false);
  }
</script>

<div class="surface">
  <div class="treecol">
    <div class="row">
      <span class="label">프로젝트 파일</span>
      <label class="inline"><input type="checkbox" bind:checked={showHidden} /> .bindery 표시</label>
      <button class="quiet" onclick={() => refreshAll()}>새로고침</button>
    </div>
    <div class="tree">
      {#snippet nodeView(nodes: FileNode[], depth: number)}
        {#each visibleNodes(nodes) as node (node.path)}
          {#if node.kind === 'directory'}
            <details open={depth < 1}>
              <summary style={`padding-left:${depth * 12}px`}>{node.name}/</summary>
              {#if node.children}{@render nodeView(node.children, depth + 1)}{/if}
            </details>
          {:else}
            <button class="quiet file" class:on={openPath === node.path} style={`padding-left:${depth * 12 + 14}px`} onclick={() => open(node.path)}>{node.name}</button>
          {/if}
        {/each}
      {/snippet}
      {@render nodeView($tree, 0)}
    </div>

    <section class="snapshots">
      <span class="label">최근 스냅샷</span>
      {#if $snapshots.length === 0}
        <p class="empty mini">스냅샷이 없습니다.</p>
      {:else}
        {#each $snapshots.slice(0, 8) as snap (snap.id)}
          <button class="quiet snapshot" onclick={() => restore(snap)} title={snap.snapshotPath}>
            <b>{snap.targetPath}</b>
            <span>{snap.label} · {new Date(snap.createdAt).toLocaleString()}</span>
          </button>
        {/each}
      {/if}
    </section>
  </div>

  <div class="editcol">
    {#if openPath}
      <div class="row">
        <span class="mono dim">{openPath}</span>
        <span class="chip {dirty ? 'warn' : 'ok'}">{dirty ? '저장 대기' : '저장됨'}</span>
        <span class="spacer"></span>
        <button class="primary" onclick={save} disabled={!dirty}>저장</button>
      </div>
      <MarkdownEditor bind:value={content} />
    {:else}
      <p class="empty">왼쪽에서 파일을 선택하세요. 브리프·장면 계획·바이블·소재 카드 등 모든 산출물을 직접 수정할 수 있습니다.</p>
    {/if}
  </div>
</div>

<style>
  .surface { height: 100%; display: grid; grid-template-columns: minmax(220px, 300px) minmax(0, 1fr); }
  .treecol { border-right: 1px solid var(--line); padding: 14px 10px; overflow: auto; display: grid; gap: 8px; align-content: start; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .inline { display: flex; gap: 4px; align-items: center; font-size: 11px; color: var(--muted); }
  .spacer { flex: 1; }
  .tree { display: grid; font-size: 12px; }
  .tree summary { cursor: pointer; color: var(--muted); padding: 3px 0; font-weight: 650; }
  .file { display: block; width: 100%; text-align: left; border: 0; border-radius: 3px; padding-top: 3px; padding-bottom: 3px; font-size: 12px; font-family: var(--mono); }
  .file.on { background: var(--accent-soft); color: var(--text); }
  .editcol { display: grid; grid-template-rows: auto minmax(0, 1fr); gap: 8px; padding: 14px 18px; min-height: 0; }
  .snapshots { display: grid; gap: 4px; border-top: 1px solid var(--line); padding-top: 10px; }
  .snapshot {
    display: grid;
    gap: 2px;
    width: 100%;
    text-align: left;
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    padding: 5px 2px;
  }
  .snapshot b { color: var(--text); font-size: 11.5px; font-family: var(--mono); overflow-wrap: anywhere; }
  .snapshot span { color: var(--faint); font-size: 10.5px; }
  .mini { padding: 4px 0; }
</style>
