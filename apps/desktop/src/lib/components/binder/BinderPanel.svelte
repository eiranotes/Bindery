<script lang="ts">
  import FileTreeNode from './FileTreeNode.svelte';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { uiStore, buildSteps } from '$lib/stores/uiStore';
  import type { BuildStep } from '$lib/stores/uiStore';
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
  function openCodex() { uiStore.update((s) => ({ ...s, binderTab: 'bible' })); }
  function switchCenter(centerView: BuildStep) {
    const mapped = centerView === 'prose' ? 'write' : centerView === 'read' ? 'review' : centerView === 'publish' ? 'publish' : 'materials';
    uiStore.update((s) => ({ ...s, centerView: mapped }));
  }
</script>

<section class="panel binder book-navigator">
  <div class="binder-head">
    <div>
      <span class="eyebrow">탐색</span>
      <h2>작품</h2>
    </div>
    <div class="binder-seg">
      <button class:on={$uiStore.binderTab === 'book'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'book' }))}>작품</button>
      <button class:on={$uiStore.binderTab === 'files'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'files' }))}>파일</button>
      <button class:on={$uiStore.binderTab === 'bible'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'bible' }))}>설정</button>
    </div>
  </div>

  <div class="panel-body binder-list">
    {#if $uiStore.binderTab === 'book'}
      <div class="book-meter">
        <div><b>진행도</b><span>62%</span></div>
        <progress max="100" value="62"></progress>
        <small>공백 1건, 오래된 비트 3건, 적용 후보 0건</small>
      </div>
      <div class="nav-section">
        <span class="section-label">작업 흐름</span>
        {#each buildSteps as step}
          <button class="book-node" class:on={$uiStore.centerView === step.id} on:click={() => switchCenter(step.id)}>
            <span>{step.label}</span><small>{step.hint}</small>
          </button>
        {/each}
      </div>
      <div class="nav-section">
        <span class="section-label">회차</span>
        <button class="episode-node" on:click={() => switchCenter('prose')}><b>ep001</b><span>초안 작성, 검토 필요</span></button>
        <button class="episode-node" on:click={() => switchCenter('beats')}><b>ep002</b><span>비트 공백</span></button>
        <button class="episode-node" on:click={() => switchCenter('beats')}><b>ep003</b><span>잠김</span></button>
      </div>
    {:else if $uiStore.binderTab === 'files'}
      {#if $fileTreeStore.nodes.length === 0}
        <div class="hint">프로젝트를 열면 파일이 표시됩니다.</div>
      {:else}
        {#each $fileTreeStore.nodes as node}
          <FileTreeNode {node} depth={0} />
        {/each}
      {/if}
    {:else}
      {#if $codexStore.items.length === 0}
        <div class="hint">설정집이 비어 있습니다. 자료 화면에서 설정 스캔을 실행하세요.</div>
      {:else}
        {#each $codexStore.items as item}
          <button class="codex-node" on:click={openCodex} title={item.summary}>
            <span class="ci" data-type={item.type}>{ICON[item.type]}</span>
            <span class="cn">{item.name}</span>
            <span class="ct">{TYPE_LABEL[item.type]}</span>
          </button>
        {/each}
      {/if}
    {/if}
  </div>
</section>
