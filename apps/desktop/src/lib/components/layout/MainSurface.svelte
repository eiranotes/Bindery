<script lang="ts">
  import MarkdownEditor from '$lib/components/editor/MarkdownEditor.svelte';
  import PlotGridPanel from '$lib/components/plot/PlotGridPanel.svelte';
  import CodexPanel from '$lib/components/codex/CodexPanel.svelte';
  import SnapshotPanel from '$lib/components/snapshots/SnapshotPanel.svelte';
  import JobConsole from '$lib/components/agents/JobConsole.svelte';
  import ExportPanel from '$lib/components/export/ExportPanel.svelte';
  import AIStudio from '$lib/components/ai/AIStudio.svelte';
  import StyleStudio from '$lib/components/style/StyleStudio.svelte';
  import HelpSurface from './HelpSurface.svelte';
  import { uiStore } from '$lib/stores/uiStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { loadPlotAction } from '$lib/actions/pipeline';

  $: fileTitle = $editorStore.path ? $editorStore.path.split('/').pop() ?? '원고' : '원고를 선택하세요';
  $: dirtyLabel = $editorStore.dirty ? '저장 대기' : '저장됨';
</script>

<section class="panel main-surface writing-surface">
  {#if $uiStore.centerView === 'write'}
    <div class="write-head">
      <div>
        <span class="eyebrow">집필</span>
        <h1>{$projectStore.current?.title ?? '작품'}</h1>
        <p>{fileTitle}</p>
      </div>
      <div class="write-status">
        <span>{dirtyLabel}</span>
        <span>{$editorStore.wordCount.toLocaleString()} 단어</span>
      </div>
    </div>

    {#if $editorStore.path}
      <MarkdownEditor />
    {:else}
      <div class="empty-write">
        <h2>왼쪽 파일 목록에서 원고를 선택하세요</h2>
        <p>프로젝트를 열면 보통 `manuscript.md`가 자동으로 선택됩니다. 직접 고르려면 왼쪽의 파일 탭을 사용하세요.</p>
      </div>
    {/if}
  {:else if $uiStore.centerView === 'ai'}
    <AIStudio />
  {:else if $uiStore.centerView === 'style'}
    <StyleStudio />
  {:else if $uiStore.centerView === 'materials'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">자료</span>
        <h1>설정집과 플롯</h1>
        <p>원고와 분리된 작품 자료입니다. 설정 항목은 AI 파이프라인의 바이블로도 쓰입니다.</p>
      </div>
      <button class="ghost" on:click={loadPlotAction}>플롯 새로고침</button>
    </div>
    <div class="materials-grid">
      <section class="panel-slim"><CodexPanel /></section>
      <section class="panel-slim"><PlotGridPanel /></section>
    </div>
  {:else if $uiStore.centerView === 'export'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">내보내기</span>
        <h1>출고와 기록</h1>
        <p>합본을 출력하고, 스냅샷과 실행 기록, 집필 통계를 확인합니다.</p>
      </div>
    </div>
    <div class="export-grid three">
      <section class="panel-slim"><ExportPanel /></section>
      <section class="panel-slim"><SnapshotPanel /></section>
      <section class="panel-slim"><JobConsole /></section>
    </div>
  {:else if $uiStore.centerView === 'help'}
    <HelpSurface />
  {/if}
</section>
