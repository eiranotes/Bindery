<script lang="ts">
  import MarkdownEditor from '$lib/components/editor/MarkdownEditor.svelte';
  import CandidateDiffPanel from '$lib/components/candidates/CandidateDiffPanel.svelte';
  import PlotGridPanel from '$lib/components/plot/PlotGridPanel.svelte';
  import QADashboard from '$lib/components/qa/QADashboard.svelte';
  import RepetitionPanel from '$lib/components/analysis/RepetitionPanel.svelte';
  import RevisionPanel from '$lib/components/revision/RevisionPanel.svelte';
  import SnapshotPanel from '$lib/components/snapshots/SnapshotPanel.svelte';
  import JobConsole from '$lib/components/agents/JobConsole.svelte';
  import AIPanel from '$lib/components/ai/AIPanel.svelte';
  import CodexPanel from '$lib/components/codex/CodexPanel.svelte';
  import SettingsPanel from '$lib/components/settings/SettingsPanel.svelte';
  import EvidenceSummary from './EvidenceSummary.svelte';
  import HelpSurface from './HelpSurface.svelte';
  import { uiStore } from '$lib/stores/uiStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { qaStore } from '$lib/stores/qaStore';
  import { jobStore } from '$lib/stores/jobStore';
  import { runQAAction, runAnalyzeAction, loadPlotAction } from '$lib/actions/pipeline';

  const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;
  $: fileTitle = $editorStore.path ? $editorStore.path.split('/').pop() ?? '원고' : '원고를 선택하세요';
  $: dirtyLabel = $editorStore.dirty ? '저장 대기' : '저장됨';
</script>

<section class="panel main-surface writing-surface">
  {#if $uiStore.centerView === 'write' || $uiStore.centerView === 'prose'}
    <div class="write-head">
      <div>
        <span class="eyebrow">원고 작성</span>
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
  {:else if $uiStore.centerView === 'pipeline' || $uiStore.centerView === 'diff'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">AI 작업</span>
        <h1>후보 생성과 검토</h1>
        <p>AI는 원고를 직접 덮어쓰지 않습니다. 후보를 만들고, 비교본을 확인한 뒤 필요한 부분만 적용합니다.</p>
      </div>
    </div>
    <div class="pipeline-grid">
      <section class="pipeline-run panel-slim">
        <div class="section-head">
          <h2>실행</h2>
          <span>{$editorStore.path ?? '원고 미선택'}</span>
        </div>
        <EvidenceSummary />
        <AIPanel />
      </section>
      <section class="pipeline-result panel-slim">
        <div class="section-head">
          <h2>후보 비교</h2>
          <span>후보 {$candidateStore.candidates.length}개</span>
        </div>
        <CandidateDiffPanel />
      </section>
      <section class="pipeline-proof panel-slim">
        <div class="section-head">
          <h2>검토 결과</h2>
          <span>{$qaStore.report ? verdictLabel[$qaStore.report.verdict] : '대기'}</span>
        </div>
        <QADashboard />
        <RevisionPanel />
      </section>
    </div>
  {:else if $uiStore.centerView === 'materials' || $uiStore.centerView === 'beats' || $uiStore.centerView === 'chapters' || $uiStore.centerView === 'brief' || $uiStore.centerView === 'foundations' || $uiStore.centerView === 'spine'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">자료</span>
        <h1>설정과 플롯</h1>
        <p>펜시브처럼 문서, 설정, 플롯을 원고와 분리해서 확인합니다.</p>
      </div>
      <button class="ghost" on:click={loadPlotAction}>플롯 새로고침</button>
    </div>
    <div class="materials-grid">
      <section class="panel-slim">
        <div class="section-head"><h2>설정집</h2><span>인물·장소·떡밥</span></div>
        <CodexPanel />
      </section>
      <section class="panel-slim">
        <div class="section-head"><h2>플롯 보드</h2><span>장면과 서브플롯</span></div>
        <PlotGridPanel />
      </section>
    </div>
  {:else if $uiStore.centerView === 'review' || $uiStore.centerView === 'read'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">검토</span>
        <h1>원고 점검</h1>
        <p>반복 표현, QA 게이트, 수정 계획을 작성 화면과 분리해서 확인합니다.</p>
      </div>
      <div class="head-actions">
        <button class="primary" on:click={runQAAction}>QA 실행</button>
        <button class="ghost" on:click={() => runAnalyzeAction()}>표현 분석</button>
      </div>
    </div>
    <div class="review-grid">
      <QADashboard />
      <RepetitionPanel />
      <RevisionPanel />
      <CandidateDiffPanel />
    </div>
  {:else if $uiStore.centerView === 'publish'}
    <div class="surface-head compact">
      <div class="surface-copy">
        <span class="eyebrow">내보내기</span>
        <h1>스냅샷과 기록</h1>
        <p>출력 전에 현재 원고, 실행 로그, 스냅샷을 확인합니다.</p>
      </div>
    </div>
    <div class="publish-grid">
      <SnapshotPanel />
      <JobConsole />
      <section class="panel-slim">
        <div class="section-head"><h2>실행 요약</h2><span>{$jobStore.length}건</span></div>
        <EvidenceSummary />
        <SettingsPanel />
      </section>
    </div>
  {:else if $uiStore.centerView === 'help'}
    <HelpSurface />
  {/if}
</section>
