<script lang="ts">
  import { projectStore } from '$lib/stores/projectStore';
  import { primaryViews, isStudioView, toggleSidebar, uiStore, gotoView } from '$lib/stores/uiStore';
  import { themeStore, toggleTheme } from '$lib/stores/themeStore';
  import { settingsStore } from '$lib/stores/settingsStore';

  const providerLabel: Record<string, string> = {
    codex: 'Codex',
    antigravity: 'Antigravity',
    gemini: 'Gemini',
    custom: '직접 설정'
  };

  $: agentReady = Boolean($settingsStore.agentCliPath);
  $: agentName = providerLabel[$settingsStore.agentProvider] ?? $settingsStore.agentProvider;
  $: agentModel = $settingsStore.agentModel?.trim() || 'CLI 기본';

  function backToBooks() {
    projectStore.update((s) => ({ ...s, current: null }));
    uiStore.update((s) => ({ ...s, centerView: 'pipeline', binderTab: 'episodes' }));
  }
  function openAIConnect() {
    uiStore.update((s) => ({ ...s, prefsOpen: true, prefsSection: 'aiRunner' }));
  }
  // 작업실 탭 — 문체/내보내기 도구. AI 파이프라인은 최상위 탭으로 승격됐다.
  $: studioActive = isStudioView($uiStore.centerView);
  function openStudio() {
    uiStore.update((s) => (isStudioView(s.centerView) ? s : { ...s, centerView: 'style' }));
  }
</script>

<header class="topbar studio-topbar" data-tauri-drag-region>
  <button class="logo logo-button" on:click={backToBooks} title="시작 화면">
    <span class="logo-mark"></span><span>Bindery</span>
  </button>

  <div class="project-zone">
    {#if $uiStore.centerView === 'write'}
      <button
        class="ghost icon sidebar-toggle"
        on:click={toggleSidebar}
        title={$uiStore.sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-label={$uiStore.sidebarCollapsed ? '사이드바 펼치기' : '사이드바 접기'}
        aria-pressed={$uiStore.sidebarCollapsed}
      >
        <span>{$uiStore.sidebarCollapsed ? '›' : '‹'}</span>
      </button>
    {/if}
    <button class="project-chip" on:click={backToBooks} title={$projectStore.current?.rootPath}>
      <span>작품</span>
      <b>{$projectStore.current?.title}</b>
    </button>
    <nav class="main-tabs" aria-label="주요 화면">
      {#each primaryViews as view}
        <button class:on={$uiStore.centerView === view.id} title={view.hint} on:click={() => gotoView(view.id)}>{view.label}</button>
      {/each}
      <button class:on={studioActive} title="문체·내보내기 작업실" on:click={openStudio}>작업실</button>
    </nav>
  </div>

  <div class="topbar-right">
    <button class="agent-state" class:ready={agentReady} title="AI 연결 상태 · 환경설정" on:click={openAIConnect}>
      <span class="dot" class:ok={agentReady}></span>{agentName} · {agentModel}
    </button>
    {#if $settingsStore.mockMode}<span class="mock-pill">데모</span>{/if}
    <button class="ghost quiet-action" class:on={$uiStore.centerView === 'help'} on:click={() => uiStore.update((s) => ({ ...s, centerView: 'help' }))}>도움말</button>
    <button class="ghost quiet-action" on:click={() => uiStore.update((s) => ({ ...s, prefsOpen: true, prefsSection: null }))}>환경설정</button>
    <button class="ghost icon theme-toggle" title={$themeStore === 'light' ? '다크 모드' : '라이트 모드'} on:click={toggleTheme} aria-label={$themeStore === 'light' ? '다크 모드' : '라이트 모드'}>
      <span class:dark-dot={$themeStore === 'light'} class:light-dot={$themeStore !== 'light'}></span>
    </button>
  </div>
</header>
