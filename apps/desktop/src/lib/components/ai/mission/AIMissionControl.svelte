<script lang="ts">
  // AI 미션 컨트롤 — 파이프라인 실행을 크게 보면서 검토하는 전체 화면 작업대.
  // 좌측 단계 그래프·run 히스토리, 중앙 대형 뷰어(산출물/프롬프트/컨텍스트/검토),
  // 우측 인스펙터(설정·위험·결정 로그). 실행 자체는 AIStudio의 러너를 위임받는다.
  import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';
  import CandidateDiffPanel from '$lib/components/candidates/CandidateDiffPanel.svelte';
  import QADashboard from '$lib/components/qa/QADashboard.svelte';
  import RevisionPanel from '$lib/components/revision/RevisionPanel.svelte';
  import { pipelineStore } from '$lib/stores/pipelineStore';
  import { runStore } from '$lib/stores/runStore';
  import { artifactStore, artifactsForEpisode } from '$lib/stores/artifactStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { qaStore } from '$lib/stores/qaStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { draftParamsStore, CREATIVITY_LABEL } from '$lib/stores/draftParamsStore';
  import { styleStore, STRICTNESS_LABEL } from '$lib/stores/styleStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { plotStore } from '$lib/stores/plotStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { collectGuidance, buildGuidanceText } from '$lib/domain/guidance';
  import type { GuidanceHardness } from '$lib/domain/guidance';
  import { assemblePrompt, STEP_META } from '$lib/domain/prompt';
  import type { PipelineStep } from '$lib/domain/prompt';
  import type { FileNode } from '$lib/types';

  export let episode: string;
  export let running: PipelineStep | null = null;
  export let runStep: (step: PipelineStep) => Promise<boolean>;
  export let runAllSteps: () => Promise<void>;
  export let onClose: () => void;

  const steps = Object.keys(STEP_META) as PipelineStep[];
  const statusLabel = { idle: '대기', running: '실행 중', done: '완료', failed: '실패' } as const;
  const hardnessMeta: Record<GuidanceHardness, { label: string; cls: string }> = {
    hard: { label: '규칙', cls: 'hard' },
    soft: { label: '지향', cls: 'soft' },
    reference: { label: '참고', cls: 'ref' }
  };
  const runStatusLabel: Record<string, string> = {
    running: '진행 중',
    waiting_for_review: '검토 대기',
    done: '완료',
    failed: '중단'
  };

  type CenterTab = 'artifact' | 'prompt' | 'context' | 'review';
  let tab: CenterTab = 'artifact';
  let selectedStep: PipelineStep = 'draft';
  let selectedArtifactId = '';

  $: episodeArtifacts = artifactsForEpisode($artifactStore, episode);
  $: allEpisodeArtifacts = $artifactStore
    .filter((a) => a.episode === episode)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  $: selectedArtifact =
    (selectedArtifactId ? allEpisodeArtifacts.find((a) => a.id === selectedArtifactId) : null) ??
    episodeArtifacts.find((a) => a.step === selectedStep) ??
    null;
  // 프롬프트/컨텍스트는 열람 시점 기준으로 조립 — 실행 전 확인 용도
  $: promptText =
    tab === 'prompt'
      ? assemblePrompt(
          selectedStep,
          $editorStore.content,
          $codexStore.items,
          selectedStep === 'draft' || selectedStep === 'revise' ? buildGuidanceText(episode) : undefined
        )
      : '';
  $: guidanceSections = tab === 'context' ? collectGuidance(episode) : [];
  $: totalTokens = guidanceSections.reduce((sum, s) => sum + s.tokenEstimate, 0);
  $: activeRun = $runStore.active;
  $: failedSteps = steps.filter((s) => $pipelineStore.stepStatus[s] === 'failed');
  $: qaIssues = $qaStore.report?.issues ?? [];
  $: qaFailCount = qaIssues.filter((i) => i.severity === 'fail').length;
  $: qaWarnCount = qaIssues.filter((i) => i.severity === 'warn').length;
  $: decisions = (activeRun?.humanDecisions ?? []).slice(-8).reverse();
  $: episodePlotRows = $plotStore.grid?.rows.filter((row) => row.episode === episode) ?? [];
  $: manuscriptChars = $editorStore.content.replace(/\s/g, '').length;
  $: bibleFileCount = countBibleFiles($fileTreeStore.nodes);

  function selectStep(step: PipelineStep) {
    selectedStep = step;
    selectedArtifactId = '';
    if (tab === 'review') tab = 'artifact';
  }

  function selectArtifact(id: string, step: PipelineStep) {
    selectedArtifactId = id;
    selectedStep = step;
    tab = 'artifact';
  }

  function artifactCount(step: PipelineStep): number {
    return allEpisodeArtifacts.filter((a) => a.step === step).length;
  }

  function countBibleFiles(nodes: FileNode[]): number {
    let count = 0;
    const walk = (list: FileNode[]) => {
      for (const node of list) {
        if (node.kind === 'file' && /(bible|canon|설정)/i.test(node.path) && node.path.endsWith('.md')) count += 1;
        if (node.children) walk(node.children);
      }
    };
    walk(nodes);
    return count;
  }

  function shortRunId(id: string): string {
    return id.replace(/^run_/, '').replace(`_${episode}`, '');
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Escape') onClose();
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<div class="mission-backdrop" role="dialog" aria-modal="true" aria-label="AI 미션 컨트롤">
  <div class="mission">
    <header class="mc-head">
      <div class="mc-title">
        <span class="eyebrow">AI 미션 컨트롤</span>
        <h1>{episode} 파이프라인</h1>
      </div>
      <div class="mc-run-meta">
        {#if activeRun}
          <span class="run-chip on" title={activeRun.runId}>{shortRunId(activeRun.runId)} · {runStatusLabel[activeRun.status]}</span>
        {:else}
          <span class="run-chip">run 없음 — 단계를 실행하면 기록이 시작됩니다</span>
        {/if}
      </div>
      <div class="mc-actions">
        <button class="primary" on:click={runAllSteps} disabled={running !== null}>전체 실행</button>
        <button class="ghost" on:click={onClose}>닫기 (Esc)</button>
      </div>
    </header>

    <div class="mc-grid">
      <aside class="mc-left" aria-label="파이프라인 단계">
        <span class="line-label">단계</span>
        <ol class="mc-steps">
          {#each steps as step, i}
            {@const st = $pipelineStore.stepStatus[step]}
            {@const count = artifactCount(step)}
            <li class="mc-step" class:on={selectedStep === step} class:done={st === 'done'} class:failed={st === 'failed'} class:running={running === step}>
              <button class="mc-step-select" on:click={() => selectStep(step)} title="{STEP_META[step].label} 산출물 보기">
                <b>{i + 1}</b>
                <span class="mc-step-copy">
                  <span>{STEP_META[step].label}</span>
                  <small>{running === step ? '실행 중' : statusLabel[st]}{count ? ` · 산출물 ${count}` : ''}</small>
                </span>
              </button>
              <button
                class="ghost tiny mc-run-btn"
                disabled={running !== null}
                on:click={() => runStep(step)}
                title="{STEP_META[step].label} 실행"
              >실행</button>
            </li>
          {/each}
        </ol>

        <span class="line-label">Run 히스토리</span>
        {#if $runStore.history.length === 0}
          <p class="mc-empty">아직 완료된 run이 없습니다.</p>
        {:else}
          <ul class="mc-history">
            {#each $runStore.history.slice(0, 8) as run}
              <li title={run.runId}>
                <b>{shortRunId(run.runId)}</b>
                <span>{run.episode} · {runStatusLabel[run.status]}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>

      <section class="mc-center">
        <nav class="mc-tabs" aria-label="뷰어 전환">
          <button class:on={tab === 'artifact'} on:click={() => (tab = 'artifact')}>산출물</button>
          <button class:on={tab === 'prompt'} on:click={() => (tab = 'prompt')}>프롬프트</button>
          <button class:on={tab === 'context'} on:click={() => (tab = 'context')}>컨텍스트</button>
          <button class:on={tab === 'review'} on:click={() => (tab = 'review')}>검토</button>
          <span class="mc-tab-target">{STEP_META[selectedStep].label}{tab === 'review' ? ' 외 검토 전체' : ''}</span>
        </nav>

        <div class="mc-viewer">
          {#if tab === 'artifact'}
            <div class="mc-artifact-overview">
              <div class="mc-context-head">
                <b>{episode} 산출물 목록</b>
                <span>{allEpisodeArtifacts.length}개 기록</span>
              </div>
              {#if allEpisodeArtifacts.length}
                <div class="mc-artifact-strip">
                  {#each allEpisodeArtifacts.slice(0, 18) as artifact}
                    <button class:on={selectedArtifact?.id === artifact.id} on:click={() => selectArtifact(artifact.id, artifact.step)} title={artifact.latestPath ?? artifact.contentPath ?? artifact.title}>
                      <b>{STEP_META[artifact.step].label}</b>
                      <span>{artifact.title} · {new Date(artifact.createdAt).toLocaleTimeString()}</span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
            {#if selectedArtifact}
              <div class="mc-artifact-head">
                <b>{selectedArtifact.title}</b>
                <span>{new Date(selectedArtifact.createdAt).toLocaleString()}{selectedArtifact.previewOnly ? ' · 미리보기 (전체는 프로젝트 파일)' : ''}</span>
                {#if selectedArtifact.latestPath}<code>{selectedArtifact.latestPath}</code>{/if}
              </div>
              <div class="mc-reading"><MarkdownPreview content={selectedArtifact.content} /></div>
            {:else}
              <p class="mc-empty big">아직 표시할 산출물이 없습니다. 왼쪽에서 단계를 실행하면 이 목록과 뷰어에 바로 남습니다.</p>
            {/if}
          {:else if tab === 'prompt'}
            <pre class="mc-pre">{promptText}</pre>
          {:else if tab === 'context'}
            <div class="mc-context-head">
              <b>초안·수정 프롬프트에 들어갈 참고 블록</b>
              <span>{guidanceSections.length}개 섹션 · 추정 {totalTokens.toLocaleString()} tokens</span>
            </div>
            {#if guidanceSections.length === 0}
              <p class="mc-empty big">아직 조립될 컨텍스트가 없습니다. 컨텍스트/요약 단계를 실행하거나 문체 지침서를 확정하세요.</p>
            {:else}
              <ul class="mc-context-list">
                {#each guidanceSections as sec}
                  <li>
                    <details>
                      <summary>
                        <span class="hardness {hardnessMeta[sec.hardness].cls}">{hardnessMeta[sec.hardness].label}</span>
                        <b>{sec.label}</b>
                        <span class="ctx-meta">{sec.source} · {sec.sourceId} · ≈{sec.tokenEstimate.toLocaleString()}t</span>
                      </summary>
                      <pre class="mc-pre inline">{sec.content}</pre>
                    </details>
                  </li>
                {/each}
              </ul>
            {/if}
          {:else}
            <div class="mc-review">
              <section class="mc-review-main"><CandidateDiffPanel /></section>
              <section class="mc-review-side">
                <QADashboard />
                <RevisionPanel />
              </section>
            </div>
          {/if}
        </div>
      </section>

      <aside class="mc-right" aria-label="실행 정보">
        <span class="line-label">입력 기준</span>
        <dl class="mc-kv">
          <div><dt>회차 플롯</dt><dd class:warn={episodePlotRows.length === 0}>{episodePlotRows.length ? `${episodePlotRows.length}개 장면` : 'row 없음'}</dd></div>
          <div><dt>설정 자료</dt><dd>{bibleFileCount}개 문서 · {$codexStore.items.length}개 항목</dd></div>
          <div><dt>현재 원고</dt><dd>{manuscriptChars.toLocaleString()}자</dd></div>
          <div><dt>산출물</dt><dd>{allEpisodeArtifacts.length}개</dd></div>
        </dl>

        <span class="line-label">실행 설정</span>
        <dl class="mc-kv">
          <div><dt>실행기</dt><dd>{$settingsStore.agentProvider}{$settingsStore.mockMode ? ' · 데모' : ''}</dd></div>
          <div><dt>분량</dt><dd>{$draftParamsStore.lengthTarget > 0 ? `약 ${$draftParamsStore.lengthTarget.toLocaleString()}자` : '자동'}</dd></div>
          <div><dt>창의성</dt><dd>{CREATIVITY_LABEL[$draftParamsStore.creativity]}</dd></div>
          {#if $styleStore.guideline}
            <div><dt>문체 강도</dt><dd>{STRICTNESS_LABEL[$styleStore.strictness]}</dd></div>
          {/if}
          <div><dt>후보 수</dt><dd>{$settingsStore.aiDefaultCandidateCount}개</dd></div>
        </dl>

        <span class="line-label">위험</span>
        <dl class="mc-kv">
          <div>
            <dt>QA</dt>
            <dd class:bad={$qaStore.report?.verdict === 'fail'} class:warn={$qaStore.report?.verdict === 'warn'}>
              {$qaStore.report ? `${$qaStore.report.verdict} (${$qaStore.report.score ?? '-'})` : '미실행'}
              {#if qaIssues.length}· fail {qaFailCount} / warn {qaWarnCount}{/if}
            </dd>
          </div>
          <div>
            <dt>실패 단계</dt>
            <dd class:bad={failedSteps.length > 0}>{failedSteps.length ? failedSteps.map((s) => STEP_META[s].label).join(', ') : '없음'}</dd>
          </div>
          <div><dt>후보</dt><dd>{$candidateStore.candidates.length}개{$candidateStore.sessionSnapshotId ? ' · 스냅샷 있음' : ''}</dd></div>
        </dl>

        <span class="line-label">결정 로그</span>
        {#if decisions.length === 0}
          <p class="mc-empty">기록된 결정이 없습니다. 적용/버리기/전체 실행이 여기에 남습니다.</p>
        {:else}
          <ul class="mc-decisions">
            {#each decisions as d}
              <li>
                <b>{d.action}</b>
                <span>{new Date(d.at).toLocaleTimeString()}{d.detail ? ` · ${d.detail}` : ''}</span>
              </li>
            {/each}
          </ul>
        {/if}
      </aside>
    </div>
  </div>
</div>

<style>
  .mission-backdrop {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: var(--bg);
    display: grid;
  }
  .mission { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }

  .mc-head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 18px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
  }
  .mc-title h1 { margin: 2px 0 0; font-size: 19px; line-height: 1.15; }
  .mc-run-meta { flex: 1; min-width: 0; }
  .run-chip {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--muted);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 10px;
    font-size: 11.5px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }
  .run-chip.on { color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); background: var(--accent-soft); }
  .mc-actions { display: flex; gap: 8px; flex-shrink: 0; }

  .mc-grid {
    min-height: 0;
    display: grid;
    grid-template-columns: 250px minmax(0, 1fr) 290px;
  }
  .mc-left, .mc-right {
    min-height: 0;
    overflow: auto;
    padding: 14px 16px;
    display: grid;
    gap: 10px;
    align-content: start;
  }
  .mc-left { border-right: 1px solid var(--line); background: var(--bg-1); }
  .mc-right { border-left: 1px solid var(--line); background: var(--bg-1); }
  .line-label { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; padding-top: 6px; }

  .mc-steps { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .mc-step {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 6px;
    align-items: center;
    padding: 4px 2px;
    border-bottom: 1px solid var(--line);
  }
  .mc-step.on { background: var(--accent-soft); }
  .mc-step-select {
    min-width: 0;
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 8px;
    align-items: center;
    text-align: left;
    padding: 5px 2px;
    border: 0;
    border-radius: 0;
  }
  .mc-step-select b { color: var(--faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; }
  .mc-step.on .mc-step-select b { color: var(--accent); }
  .mc-step.done .mc-step-select b { color: var(--ok); }
  .mc-step.failed .mc-step-select b { color: var(--bad); }
  .mc-step.running .mc-step-select b { color: var(--accent); }
  .mc-step-copy { min-width: 0; display: grid; gap: 1px; }
  .mc-step-copy span { color: var(--text); font-size: 12.5px; font-weight: 650; }
  .mc-step-copy small { color: var(--muted); font-size: 10.5px; }
  .mc-step.failed .mc-step-copy small { color: var(--bad); }
  .mc-run-btn { flex-shrink: 0; }
  .tiny { padding: 3px 8px; font-size: 11px; }

  .mc-history { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .mc-history li { display: grid; gap: 1px; padding: 7px 2px; border-bottom: 1px solid var(--line); }
  .mc-history b { color: var(--text); font-size: 11.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-history span { color: var(--faint); font-size: 10.5px; }

  .mc-center { min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
  .mc-tabs {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 8px 14px;
    border-bottom: 1px solid var(--line);
    background: var(--bg-1);
  }
  .mc-tabs button { padding: 6px 12px; border-radius: var(--r-sm); color: var(--muted); font-size: 13px; }
  .mc-tabs button.on { background: var(--accent-soft); color: var(--text); font-weight: 700; }
  .mc-tab-target { margin-left: auto; color: var(--faint); font-size: 11.5px; }

  .mc-viewer { min-height: 0; overflow: auto; padding: 18px 22px; display: grid; gap: 12px; align-content: start; }
  .mc-artifact-head { display: grid; gap: 3px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
  .mc-artifact-head b { color: var(--text); font-size: 14px; }
  .mc-artifact-head span { color: var(--muted); font-size: 11.5px; }
  .mc-artifact-head code { width: fit-content; color: var(--faint); background: var(--accent-soft); border-radius: 4px; padding: 1px 6px; font-family: ui-monospace, monospace; font-size: 10.5px; }
  .mc-reading { max-width: 860px; }
  .mc-reading :global(.preview) { border-left: 0; padding: 6px 0 24px; font-size: 14.5px; line-height: 1.95; background: transparent; }
  .mc-artifact-overview { display: grid; gap: 8px; padding-bottom: 6px; }
  .mc-artifact-strip {
    display: grid;
    border-top: 1px solid var(--line);
  }
  .mc-artifact-strip button {
    min-width: 0;
    display: grid;
    grid-template-columns: 126px minmax(0, 1fr);
    gap: 10px;
    text-align: left;
    border: 0;
    border-radius: 0;
    border-bottom: 1px solid var(--line);
    padding: 8px 2px;
  }
  .mc-artifact-strip button.on { background: var(--accent-soft); }
  .mc-artifact-strip b { color: var(--text); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .mc-artifact-strip span { color: var(--muted); font-size: 11.5px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .mc-pre {
    margin: 0;
    max-width: 900px;
    white-space: pre-wrap;
    color: var(--text);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 12px;
    line-height: 1.7;
  }
  .mc-pre.inline { padding: 10px 0 4px; color: var(--muted); }

  .mc-context-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding-bottom: 8px; border-bottom: 1px solid var(--line); }
  .mc-context-head b { color: var(--text); font-size: 13px; }
  .mc-context-head span { color: var(--faint); font-size: 11.5px; font-variant-numeric: tabular-nums; }
  .mc-context-list { list-style: none; margin: 0; padding: 0; display: grid; }
  .mc-context-list li { border-bottom: 1px solid var(--line); }
  .mc-context-list summary {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 2px;
    cursor: pointer;
    min-width: 0;
  }
  .mc-context-list summary b { color: var(--text); font-size: 12.5px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ctx-meta { margin-left: auto; color: var(--faint); font-size: 10.5px; white-space: nowrap; }
  .hardness { flex-shrink: 0; border-radius: 999px; padding: 2px 8px; font-size: 10px; font-weight: 800; }
  .hardness.hard { color: var(--bad); background: var(--bad-soft); }
  .hardness.soft { color: var(--accent); background: var(--accent-soft); }
  .hardness.ref { color: var(--muted); background: var(--chip); }

  .mc-review { min-height: 0; display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(280px, .7fr); gap: 14px; align-items: start; }
  .mc-review-main { min-width: 0; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); overflow: hidden; min-height: 380px; }
  .mc-review-side { min-width: 0; display: grid; gap: 10px; align-content: start; }

  .mc-kv { margin: 0; display: grid; border-top: 1px solid var(--line); }
  .mc-kv div { display: grid; grid-template-columns: 78px minmax(0, 1fr); gap: 8px; padding: 8px 0; border-bottom: 1px solid var(--line); }
  .mc-kv dt { color: var(--faint); font-size: 11px; }
  .mc-kv dd { margin: 0; color: var(--text); font-size: 12px; line-height: 1.45; min-width: 0; overflow-wrap: anywhere; }
  .mc-kv dd.bad { color: var(--bad); }
  .mc-kv dd.warn { color: var(--warn); }

  .mc-decisions { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .mc-decisions li { display: grid; gap: 1px; padding: 7px 0; border-bottom: 1px solid var(--line); }
  .mc-decisions b { color: var(--text); font-size: 11.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .mc-decisions span { color: var(--faint); font-size: 10.5px; }

  .mc-empty { margin: 0; color: var(--faint); font-size: 11.5px; line-height: 1.6; }
  .mc-empty.big { font-size: 13px; padding: 28px 0; }

  @media (max-width: 1100px) {
    .mc-grid { grid-template-columns: minmax(0, 1fr); overflow: auto; }
    .mc-left { border-right: 0; border-bottom: 1px solid var(--line); }
    .mc-right { border-left: 0; border-top: 1px solid var(--line); }
    .mc-review { grid-template-columns: 1fr; }
    .mc-head { flex-wrap: wrap; }
  }
</style>
