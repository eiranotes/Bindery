<script lang="ts">
  import FileTreeNode from './FileTreeNode.svelte';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { uiStore } from '$lib/stores/uiStore';
  import type { CodexType } from '$lib/domain/codex';

  const ICON: Record<CodexType, string> = { character: '◆', location: '⌂', faction: '⚑', system: '⚙', item: '✦', term: '§', event: '✳' };
  const TYPE_LABEL: Record<CodexType, string> = {
    character: '인물',
    location: '장소',
    faction: '세력',
    system: '규칙',
    item: '물건',
    term: '용어',
    event: '사건'
  };
  function openMaterials() { uiStore.update((s) => ({ ...s, centerView: 'materials' })); }
</script>

<section class="panel binder book-navigator">
  <div class="binder-head">
    <div>
      <span class="eyebrow">탐색</span>
      <h2>작품</h2>
    </div>
    <div class="binder-seg">
      <button class:on={$uiStore.binderTab === 'files'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'files' }))}>파일</button>
      <button class:on={$uiStore.binderTab === 'bible'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'bible' }))}>설정집</button>
    </div>
  </div>

  <div class="panel-body binder-list">
    {#if $uiStore.binderTab === 'files'}
      {#if $fileTreeStore.nodes.length === 0}
        <div class="hint">프로젝트를 열면 파일이 표시됩니다.</div>
      {:else}
        {#each $fileTreeStore.nodes as node}
          <FileTreeNode {node} depth={0} />
        {/each}
      {/if}
    {:else}
      {#if $codexStore.items.length === 0}
        <div class="hint">설정집이 비어 있습니다. 자료 화면에서 항목을 확인하세요.</div>
      {:else}
        {#each $codexStore.items as item}
          <button class="codex-node" on:click={openMaterials} title={item.summary}>
            <span class="ci" data-type={item.type}>{ICON[item.type]}</span>
            <span class="cn">{item.name}</span>
            <span class="ct">{TYPE_LABEL[item.type]}</span>
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</section>
