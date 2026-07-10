<script lang="ts">
  // 작품노트 - 인물·세계·플롯·떡밥·스타일을 한 화면에서 본다.
  // 유일하게 2단(목록+뷰어)을 쓰는 화면. 모든 내용은 Markdown 파일이 진실이다.
  import { ctx, tree, withBusy, toast, uiMode, mode } from '$lib/stores/app';
  import { readOptional } from '$lib/harness/project';
  import { LAYOUT } from '$lib/core/layout';
  import type { FileNode } from '$lib/bridge';
  import MarkdownEditor from '../MarkdownEditor.svelte';

  type Seg = 'bible' | 'characters' | 'world' | 'plot' | 'threads' | 'style';
  const SEGS: Array<{ id: Seg; label: string }> = [
    { id: 'bible', label: '바이블' },
    { id: 'characters', label: '인물' },
    { id: 'world', label: '세계' },
    { id: 'plot', label: '플롯' },
    { id: 'threads', label: '떡밥' },
    { id: 'style', label: '스타일' }
  ];

  let seg = $state<Seg>('bible');
  let selectedPath = $state<string | null>(null);
  let content = $state('');
  let dirty = $state(false);

  function collect(nodes: FileNode[], prefix: string): FileNode[] {
    const out: FileNode[] = [];
    const walk = (list: FileNode[]) => {
      for (const node of list) {
        if (node.kind === 'file' && node.path.startsWith(prefix) && node.name.endsWith('.md') && node.name !== 'README.md' && !node.name.startsWith('.')) {
          out.push(node);
        }
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return out;
  }

  const files = $derived.by((): Array<{ name: string; path: string }> => {
    switch (seg) {
      case 'bible': return [{ name: '설정 바이블', path: LAYOUT.canon.bible }];
      case 'characters': return collect($tree, 'characters/');
      case 'world': return collect($tree, 'world/');
      case 'plot': return [{ name: '시리즈 아웃라인', path: LAYOUT.plot.seriesOutline }];
      case 'threads': return [{ name: '열린 떡밥', path: LAYOUT.plot.openThreads }];
      case 'style': return [{ name: '스타일 지침', path: LAYOUT.style.guide }];
    }
  });

  $effect(() => {
    const list = files;
    if (!list.length) {
      selectedPath = null;
      content = '';
      return;
    }
    if (!selectedPath || !list.some((f) => f.path === selectedPath)) {
      void open(list[0].path);
    }
  });

  async function open(path: string) {
    if (dirty && !confirm('저장하지 않은 변경이 있습니다. 이동할까요?')) return;
    selectedPath = path;
    content = await readOptional(ctx(), path);
    dirty = false;
  }

  function markDirty() {
    dirty = true;
  }

  async function save() {
    if (!selectedPath) return;
    await withBusy('노트 저장', async () => {
      await ctx().bridge.writeFile(ctx().root, selectedPath!, content);
      toast(`저장됨 - ${selectedPath}`, 'ok');
    }, false);
    dirty = false;
  }
</script>

<div class="surface">
  <header class="head">
    <h1>작품노트</h1>
    <nav class="seg" aria-label="노트 분류">
      {#each SEGS as s (s.id)}
        <button class="quiet" class:on={seg === s.id} onclick={() => { seg = s.id; selectedPath = null; }}>{s.label}</button>
      {/each}
    </nav>
    {#if $uiMode === 'advanced'}
      <button class="quiet dim-btn" onclick={() => mode.set(seg === 'plot' ? 'plot' : 'world')}>설계자 화면에서 열기</button>
    {/if}
  </header>

  <div class="panes">
    <aside class="list">
      {#if files.length === 0}
        <p class="empty">아직 파일이 없습니다. {seg === 'characters' || seg === 'world' ? '기획 채택이나 회차 마감에서 자동으로 쌓입니다.' : ''}</p>
      {:else}
        {#each files as f (f.path)}
          <button class="row quiet" class:on={selectedPath === f.path} onclick={() => open(f.path)} title={f.path}>
            {f.name.replace(/\.md$/, '')}
          </button>
        {/each}
      {/if}
    </aside>
    <section class="viewer">
      {#if selectedPath}
        <div class="bar">
          <span class="mono dim">{selectedPath}</span>
          <span class="grow"></span>
          {#if dirty}<span class="chip warn">수정됨</span>{/if}
          <button class="primary" onclick={save} disabled={!dirty}>저장</button>
        </div>
        <div class="editor" oninput={markDirty}>
          <MarkdownEditor bind:value={content} />
        </div>
      {:else}
        <p class="empty">왼쪽에서 노트를 선택하세요.</p>
      {/if}
    </section>
  </div>
</div>

<style>
  .surface { padding: 22px 32px 32px; display: grid; gap: 14px; align-content: start; height: 100%; grid-template-rows: auto minmax(0, 1fr); }
  .head { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
  .head h1 { margin: 0; font-size: 22px; }
  .seg { display: flex; gap: 2px; }
  .seg button { font-size: 12.5px; padding: 4px 12px; border-radius: 4px; }
  .seg button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .dim-btn { margin-left: auto; font-size: 11.5px; }

  .panes { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 0; border: 1px solid var(--line); border-radius: 4px; overflow: hidden; min-height: 0; }
  .list { border-right: 1px solid var(--line); background: var(--bg-1); overflow: auto; padding: 8px; display: grid; align-content: start; }
  .list .row { display: block; width: 100%; text-align: left; padding: 7px 8px; border: 0; border-bottom: 1px solid var(--line); border-radius: 0; font-size: 12.5px; }
  .list .row.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .viewer { display: grid; grid-template-rows: auto minmax(0, 1fr); min-height: 0; }
  .bar { display: flex; gap: 8px; align-items: center; padding: 8px 12px; border-bottom: 1px solid var(--line); background: var(--bg-1); }
  .grow { flex: 1; }
  .editor { min-height: 0; padding: 8px; }
  .empty { padding: 14px; }
  @media (max-width: 800px) { .panes { grid-template-columns: minmax(0, 1fr); } .list { display: flex; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line); } }
</style>
