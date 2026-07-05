<script lang="ts">
  // 앱 셸 — 펜시브 벤치마크 구조:
  // 상단 모드 탭 / 좌측 구조 탐색 / 중앙 작업면 / 우측 인스펙터 / 하단 run 로그 도크.
  import {
    MODES, mode, project, busy, pendingProposals, runDockOpen, runlog, settings
  } from '$lib/stores/app';
  import type { Mode } from '$lib/stores/app';
  import Sidebar from './Sidebar.svelte';
  import Inspector from './Inspector.svelte';
  import RunDock from './RunDock.svelte';
  import HomeSurface from './surfaces/HomeSurface.svelte';
  import IdeasSurface from './surfaces/IdeasSurface.svelte';
  import WorldSurface from './surfaces/WorldSurface.svelte';
  import PlotSurface from './surfaces/PlotSurface.svelte';
  import EpisodeSurface from './surfaces/EpisodeSurface.svelte';
  import CanonSurface from './surfaces/CanonSurface.svelte';
  import FilesSurface from './surfaces/FilesSurface.svelte';
  import SettingsSurface from './surfaces/SettingsSurface.svelte';

  let { bridgeKind }: { bridgeKind: string } = $props();

  const surfaces: Record<Mode, typeof HomeSurface> = {
    home: HomeSurface,
    ideas: IdeasSurface,
    world: WorldSurface,
    plot: PlotSurface,
    episode: EpisodeSurface,
    canon: CanonSurface,
    files: FilesSurface,
    settings: SettingsSurface
  };

  const Surface = $derived(surfaces[$mode]);
  const agentLabel = $derived(
    $settings.offline ? '오프라인' : $settings.command ? `${$settings.command}${$settings.model ? ` · ${$settings.model}` : ''}` : '실행기 미설정'
  );
</script>

<div class="shell" class:dock-open={$runDockOpen}>
  <header class="topbar">
    <b class="brand">Bindery</b>
    <span class="proj" title={$project?.root}>{$project?.title}</span>
    <nav class="tabs" aria-label="작업 단계">
      {#each MODES as m}
        <button class="quiet" class:on={$mode === m.id} title={m.hint} onclick={() => mode.set(m.id)}>
          {m.label}{#if m.id === 'canon' && $pendingProposals > 0}<i class="badge">{$pendingProposals}</i>{/if}
        </button>
      {/each}
    </nav>
    <span class="right">
      {#if $busy}<span class="chip info">{$busy} 실행 중…</span>{/if}
      {#if bridgeKind === 'memory'}<span class="chip warn">데모(비영속)</span>{/if}
      <button class="quiet agent" class:warn={$settings.offline || !$settings.command} onclick={() => mode.set('settings')} title="AI 실행기 설정">{agentLabel}</button>
      <button class="quiet" onclick={() => runDockOpen.update((v) => !v)} title="실행 기록">run {$runlog.length}</button>
    </span>
  </header>

  <Sidebar />

  <main class="center">
    <Surface />
  </main>

  <Inspector />

  {#if $runDockOpen}
    <RunDock />
  {/if}
</div>

<style>
  .shell {
    height: 100%;
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr) 268px;
    grid-template-rows: auto minmax(0, 1fr);
    grid-template-areas: 'top top top' 'side center insp';
    background: var(--bg);
  }
  .shell.dock-open {
    grid-template-rows: auto minmax(0, 1fr) 200px;
    grid-template-areas: 'top top top' 'side center insp' 'dock dock dock';
  }
  .topbar {
    grid-area: top;
    display: flex; align-items: center; gap: 14px;
    padding: 7px 14px;
    background: var(--bg-1);
    border-bottom: 1px solid var(--line);
  }
  .brand { font-size: 14px; font-weight: 800; color: var(--accent); }
  .proj { font-size: 12.5px; color: var(--muted); max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .tabs { display: flex; gap: 2px; }
  .tabs button { font-size: 12.5px; padding: 4px 10px; border-radius: 4px; position: relative; }
  .tabs button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .badge {
    font-style: normal; margin-left: 5px; padding: 0 5px; border-radius: 8px;
    background: var(--warn); color: var(--on-accent); font-size: 10px; font-weight: 800;
  }
  .right { margin-left: auto; display: flex; align-items: center; gap: 8px; }
  .agent { font-family: var(--mono); font-size: 11px; }
  .agent.warn { color: var(--warn); }
  .center { grid-area: center; min-width: 0; min-height: 0; overflow: auto; background: var(--bg-desk); }
  @media (max-width: 1100px) {
    .shell { grid-template-columns: 200px minmax(0, 1fr); grid-template-areas: 'top top' 'side center'; }
    .shell.dock-open { grid-template-areas: 'top top' 'side center' 'dock dock'; }
    .shell :global(.inspector) { display: none; }
  }
</style>
