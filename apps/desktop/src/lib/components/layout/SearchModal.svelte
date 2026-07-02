<script lang="ts">
  import { uiStore } from '$lib/stores/uiStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { readFile } from '$lib/api/commands';
  import { openFileInEditor } from '$lib/actions/project';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import type { FileNode } from '$lib/types';

  let query = '';
  let searching = false;
  let results: Array<{ path: string; line: number; text: string }> = [];
  let searched = false;
  let inputEl: HTMLInputElement;

  $: if ($uiStore.searchOpen) setTimeout(() => inputEl?.focus(), 0);

  function close() {
    uiStore.update((s) => ({ ...s, searchOpen: false }));
    query = '';
    results = [];
    searched = false;
  }

  function mdFiles(nodes: FileNode[]): string[] {
    const out: string[] = [];
    const walk = (list: FileNode[]) => {
      for (const n of list) {
        if (n.kind === 'file' && n.path.endsWith('.md') && !n.path.startsWith('.')) out.push(n.path);
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return out.slice(0, 200);
  }

  async function run() {
    const q = query.trim();
    if (q.length < 2) return;
    searching = true;
    results = [];
    const root = $projectStore.current?.rootPath || 'sample-project';
    const files = mdFiles($fileTreeStore.nodes);
    const found: typeof results = [];
    for (const path of files) {
      try {
        const content = await readFile(root, path);
        const lines = content.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes(q)) {
            found.push({ path, line: i + 1, text: lines[i].trim().slice(0, 120) });
            if (found.length >= 80) break;
          }
        }
      } catch {
        /* 읽기 실패한 파일은 건너뜀 */
      }
      if (found.length >= 80) break;
    }
    results = found;
    searching = false;
    searched = true;
  }

  async function open(r: { path: string; line: number }) {
    close();
    await openFileInEditor(r.path);
    gotoLine(r.line);
  }

  function onKey(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'f') {
      e.preventDefault();
      uiStore.update((s) => ({ ...s, searchOpen: !s.searchOpen }));
    } else if (e.key === 'Escape' && $uiStore.searchOpen) {
      e.preventDefault();
      close();
    }
  }
</script>

<svelte:window on:keydown={onKey} />

{#if $uiStore.searchOpen}
  <div class="sm-backdrop">
    <button class="sm-close-area" aria-label="닫기" on:click={close}></button>
    <div class="sm" role="dialog" aria-modal="true" aria-label="프로젝트 검색">
      <form class="sm-head" on:submit|preventDefault={run}>
        <input bind:this={inputEl} bind:value={query} placeholder="프로젝트 전체 검색…  (⌘⇧F)" />
        <button class="primary" type="submit" disabled={searching || query.trim().length < 2}>{searching ? '검색 중…' : '검색'}</button>
      </form>
      <div class="sm-list">
        {#if results.length === 0}
          <div class="sm-empty">{searched ? '일치하는 결과가 없습니다.' : '두 글자 이상 입력하고 검색하세요. Markdown 파일 전체를 훑습니다.'}</div>
        {:else}
          {#each results as r}
            <button class="sm-item" on:click={() => open(r)}>
              <span class="sm-loc">{r.path} · L{r.line}</span>
              <span class="sm-text">{r.text}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .sm-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 190; display: flex; justify-content: center; align-items: flex-start; padding-top: 12vh; }
  .sm-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .sm { position: relative; width: min(640px, 94vw); max-height: 70vh; display: flex; flex-direction: column; background: var(--pop); border: 1px solid var(--line); border-radius: 14px; box-shadow: var(--shadow-pop); overflow: hidden; }
  .sm-head { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--line); }
  .sm-head input { flex: 1; font-size: 14px; padding: 9px 12px; }
  .sm-list { min-height: 0; overflow: auto; padding: 6px; }
  .sm-empty { padding: 22px; text-align: center; color: var(--muted); font-size: 13px; }
  .sm-item { width: 100%; display: grid; gap: 2px; text-align: left; border: 0; border-radius: 9px; padding: 8px 10px; }
  .sm-item:hover { background: var(--accent-soft); }
  .sm-loc { color: var(--faint); font-size: 10.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .sm-text { color: var(--text); font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
