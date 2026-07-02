<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import TopBar from './TopBar.svelte';
  import ToastHost from './ToastHost.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import PreferencesModal from './PreferencesModal.svelte';
  import BinderPanel from '$lib/components/binder/BinderPanel.svelte';
  import MainSurface from './MainSurface.svelte';
  import MyBooks from './MyBooks.svelte';
  import { writingModeStore } from '$lib/stores/writingModeStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { openProjectIntoWorkspace } from '$lib/actions/project';

  // 새로고침 뒤에도 열려 있던 작품을 복원한다. 프로젝트는 localStorage에
  // 남지만 파일 트리와 원고 버퍼는 메모리에만 있으므로 다시 불러온다.
  onMount(() => {
    const current = get(projectStore).current;
    if (current && get(fileTreeStore).nodes.length === 0) {
      openProjectIntoWorkspace(current.rootPath).catch(() => {
        projectStore.update((s) => ({ ...s, current: null }));
      });
    }
  });
</script>

{#if !$projectStore.current}
  <div class="app app-landing">
    <MyBooks />
    <ToastHost />
  </div>
{:else}
  <div class="app" class:zen={$writingModeStore.zen}>
    <TopBar />
    <main class="studio-grid" class:zen={$writingModeStore.zen}>
      {#if !$writingModeStore.zen}<BinderPanel />{/if}
      <MainSurface />
    </main>
    <ToastHost />
    <CommandPalette />
    <PreferencesModal />
  </div>
{/if}
