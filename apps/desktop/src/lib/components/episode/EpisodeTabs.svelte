<script lang="ts">
  import { episodeStore } from '$lib/stores/episodeStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { computeStats } from '$lib/editor';
  import { readFile } from '$lib/api/commands';
  import { projectStore } from '$lib/stores/projectStore';

  async function openTab(tab: string) {
    episodeStore.update((s) => ({ ...s, activeTab: tab }));
    const ep = $episodeStore.currentEpisode;
    const path = `story/chapters/${ep}/${tab}`;
    const content = await readFile($projectStore.current?.rootPath || 'sample-project', path);
    fileTreeStore.update((s) => ({ ...s, selectedPath: path }));
    editorStore.set({ path, content, savedContent: content, dirty: false, mode: 'split', wordCount: computeStats(content).words });
  }
</script>

<div class="tabs">
  {#each $episodeStore.tabs as tab}
    <button class="tab" class:active={$episodeStore.activeTab === tab} on:click={() => openTab(tab)}>{tab}</button>
  {/each}
</div>
