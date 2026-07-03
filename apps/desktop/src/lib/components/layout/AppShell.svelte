<script lang="ts">
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import TopBar from './TopBar.svelte';
  import ToastHost from './ToastHost.svelte';
  import CommandPalette from './CommandPalette.svelte';
  import PreferencesModal from './PreferencesModal.svelte';
  import SearchModal from './SearchModal.svelte';
  import BinderPanel from '$lib/components/binder/BinderPanel.svelte';
  import MainSurface from './MainSurface.svelte';
  import MyBooks from './MyBooks.svelte';
  import { writingModeStore } from '$lib/stores/writingModeStore';
  import { uiStore } from '$lib/stores/uiStore';
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

  // 왼쪽 챕터 네비게이터는 집필할 때만 쓰인다. AI 작업·문체·자료·내보내기 화면은
  // 각자 단계 레일을 가지므로 바인더를 숨겨 3단 분산과 중복을 없앤다.
  $: showBinder = !$writingModeStore.zen && $uiStore.centerView === 'write';
</script>

{#if !$projectStore.current}
  <div class="app app-landing">
    <MyBooks />
    <ToastHost />
  </div>
{:else}
  <div class="app" class:zen={$writingModeStore.zen}>
    <TopBar />
    <main class="studio-grid" class:zen={$writingModeStore.zen} class:sidebar-collapsed={$uiStore.sidebarCollapsed} class:no-binder={!showBinder}>
      {#if showBinder}<BinderPanel collapsed={$uiStore.sidebarCollapsed} />{/if}
      <MainSurface />
    </main>
    <ToastHost />
    <CommandPalette />
    <PreferencesModal />
    <SearchModal />
  </div>
{/if}
