<script lang="ts">
  import FileTreeNode from './FileTreeNode.svelte';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { uiStore } from '$lib/stores/uiStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { episodeStatusStore, statusKey, setEpisodeStatus, EPISODE_STATUS_LABEL } from '$lib/stores/episodeStore';
  import type { EpisodeStatus } from '$lib/stores/episodeStore';
  import { listEpisodes, openEpisode, createEpisode } from '$lib/actions/episodes';
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
  const statusOptions: EpisodeStatus[] = ['draft', 'revise', 'published'];

  $: root = $projectStore.current?.rootPath || 'sample-project';
  $: episodes = listEpisodes($fileTreeStore.nodes);
  let creating = false;

  async function addEpisode() {
    creating = true;
    try {
      await createEpisode();
    } finally {
      creating = false;
    }
  }
  function openMaterials() { uiStore.update((s) => ({ ...s, centerView: 'materials' })); }
</script>

<section class="panel binder book-navigator">
  <div class="binder-head">
    <div>
      <span class="eyebrow">탐색</span>
      <h2>작품</h2>
    </div>
    <div class="binder-seg">
      <button class:on={$uiStore.binderTab === 'episodes'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'episodes' }))}>회차</button>
      <button class:on={$uiStore.binderTab === 'files'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'files' }))}>파일</button>
      <button class:on={$uiStore.binderTab === 'bible'} on:click={() => uiStore.update((s) => ({ ...s, binderTab: 'bible' }))}>설정집</button>
    </div>
  </div>

  <div class="panel-body binder-list">
    {#if $uiStore.binderTab === 'episodes'}
      {#if episodes.length === 0}
        <div class="hint">회차가 없습니다. 아래에서 첫 회차를 만드세요.</div>
      {:else}
        {#each episodes as ep}
          {@const status = $episodeStatusStore[statusKey(root, ep.id)] ?? 'draft'}
          <div class="ep-row" class:active={$editorStore.path === ep.manuscriptPath}>
            <button class="ep-open" on:click={() => openEpisode(ep)} title={ep.manuscriptPath}>
              <b>{ep.id}</b>
              <span>파일 {ep.files}</span>
            </button>
            <select
              class="ep-status {status}"
              value={status}
              title="회차 상태"
              on:change={(e) => setEpisodeStatus(root, ep.id, e.currentTarget.value as EpisodeStatus)}
            >
              {#each statusOptions as st}
                <option value={st}>{EPISODE_STATUS_LABEL[st]}</option>
              {/each}
            </select>
          </div>
        {/each}
      {/if}
      <button class="ghost ep-add" on:click={addEpisode} disabled={creating}>{creating ? '생성 중…' : '+ 새 회차'}</button>
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
        <div class="hint">설정집이 비어 있습니다. 자료 화면에서 항목을 추가하세요.</div>
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

<style>
  .ep-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    align-items: center;
    border-bottom: 1px solid var(--line);
    padding: 2px 0;
  }
  .ep-row.active .ep-open b { color: var(--accent); }
  .ep-open {
    display: grid;
    gap: 1px;
    text-align: left;
    border: 0;
    padding: 7px 6px;
    min-width: 0;
  }
  .ep-open b { color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; }
  .ep-open span { color: var(--faint); font-size: 10.5px; }
  .ep-status { font-size: 11px; padding: 3px 5px; border-radius: var(--r-sm); }
  .ep-status.published { color: var(--ok); }
  .ep-status.revise { color: var(--warn); }
  .ep-add { margin-top: 10px; width: 100%; }
</style>
