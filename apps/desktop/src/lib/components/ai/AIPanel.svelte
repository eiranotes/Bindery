<script lang="ts">
  import { runQAAction, runRevisionAction, runDraftAction, runAnalyzeAction } from '$lib/actions/pipeline';
  import { runNovelctl } from '$lib/api/commands';
  import { projectStore } from '$lib/stores/projectStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { jobStore } from '$lib/stores/jobStore';
  import { episodeStore } from '$lib/stores/episodeStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { toasts } from '$lib/stores/toastStore';
  import { assemblePrompt, STEP_META } from '$lib/domain/prompt';
  import type { PipelineStep } from '$lib/domain/prompt';

  let previewStep: PipelineStep | null = null;
  let previewText = '';
  let running: PipelineStep | null = null;

  const steps = Object.keys(STEP_META) as PipelineStep[];
  let selected: Record<PipelineStep, boolean> = {
    context: false,
    draft: true,
    analyze: true,
    qa: true,
    revise: false,
    summarize: false,
    commit: false
  };
  $: selectedSteps = steps.filter((s) => selected[s]);

  function currentEpisode(): string {
    const path = $editorStore.path || '';
    const m = /story\/chapters\/(ep\d+)/.exec(path);
    return m?.[1] || $episodeStore.currentEpisode || 'ep001';
  }

  async function novelctl(step: string) {
    const ep = currentEpisode();
    const id = `${step}-${Date.now()}`;
    jobStore.update((jobs) => [{ id, createdAt: new Date().toISOString(), label: `${step} ${ep}`, status: 'running', ok: false, command: ['novelctl', step, ep], stdout: '', stderr: '', exitCode: null }, ...jobs]);
    const result = await runNovelctl($projectStore.current?.rootPath || 'sample-project', [step, ep, '--json']);
    jobStore.update((jobs) => jobs.map((j) => (j.id === id ? { ...j, ...result, status: result.ok ? 'ok' : 'failed' } : j)));
  }

  const runners: Record<PipelineStep, () => void | Promise<void>> = {
    context: () => novelctl('context'),
    draft: () => runDraftAction('draft'),
    analyze: () => runAnalyzeAction(),
    qa: runQAAction,
    revise: runRevisionAction,
    summarize: () => novelctl('summarize'),
    commit: () => novelctl('commit')
  };

  async function run(step: PipelineStep) {
    running = step;
    try { await runners[step](); } finally { running = null; }
  }
  function preview(step: PipelineStep) {
    previewStep = step;
    previewText = assemblePrompt(step, $editorStore.content, $codexStore.items);
  }
  async function runSelected() {
    if (selectedSteps.length === 0) {
      toasts.push('선택된 단계가 없습니다', 'warn');
      return;
    }
    toasts.push(`선택 파이프라인 실행: ${selectedSteps.length}단계`, 'info');
    for (const step of selectedSteps) await run(step);
  }
  async function runAll() {
    toasts.push('전체 파이프라인 실행', 'info');
    for (const step of steps) await run(step);
  }
</script>

<div class="ai-panel">
  <p class="ai-note">현재 열린 원고를 기준으로 실행합니다. 원고는 바로 바뀌지 않고, 후보와 검토 결과만 생성됩니다.</p>

  <div class="steps">
    {#each steps as step}
      <div class="step">
        <label class="step-check" title="선택 실행에 포함">
          <input type="checkbox" bind:checked={selected[step]} />
        </label>
        <button class="step-main" on:click={() => run(step)} disabled={running !== null}>
          <span class="step-name">{STEP_META[step].label}</span>
          <span class="step-desc">{STEP_META[step].desc}</span>
          {#if running === step}<span class="spin"></span>{/if}
        </button>
        <button class="step-eye" title="프롬프트 미리보기" aria-label="프롬프트 미리보기" on:click={() => preview(step)}>
          <span class="prompt-icon"></span>
        </button>
      </div>
    {/each}
  </div>

  {#if $candidateStore.candidates.length}
    <div class="cand-hint">후보 {$candidateStore.candidates.length}개가 준비되었습니다. 오른쪽 후보 비교에서 검토하세요.</div>
  {/if}

  <div class="run-row">
    <button class="primary" on:click={runSelected} disabled={running !== null}>선택 실행 {selectedSteps.length}</button>
    <button class="ghost" on:click={runAll} disabled={running !== null}>전체 실행</button>
  </div>
</div>

{#if previewStep}
  <div class="pv-backdrop">
    <button class="pv-close-area" aria-label="닫기" on:click={() => (previewStep = null)}></button>
    <div class="pv" role="dialog" aria-modal="true">
      <div class="pv-head">
        <span class="eyebrow">프롬프트 미리보기 {STEP_META[previewStep].label}</span>
        <button class="ghost" on:click={() => (previewStep = null)}>닫기</button>
      </div>
      <pre class="pv-body">{previewText}</pre>
      <div class="pv-foot">
        <button class="primary" on:click={() => { const s = previewStep; previewStep = null; if (s) run(s); }}>이 프롬프트로 실행</button>
      </div>
    </div>
  </div>
{/if}

<style>
  .ai-panel { display: flex; flex-direction: column; min-height: 0; }
  .ai-note { margin: 2px 2px 12px; font-size: 12.5px; color: var(--muted); line-height: 1.55; }
  .steps { display: flex; flex-direction: column; gap: 4px; }
  .step { display: flex; align-items: stretch; border: 1px solid var(--line); border-radius: var(--r-md); overflow: hidden; background: var(--bg-2); }
  .step-check { width: 34px; display: grid; place-items: center; border-right: 1px solid var(--line); background: var(--bg-1); }
  .step-check input { width: 14px; height: 14px; }
  .step-main { flex: 1; display: flex; align-items: baseline; gap: 10px; padding: 10px 12px; border: 0; border-radius: 0; text-align: left; }
  .step-name { font-weight: 650; font-size: 13px; color: var(--text); min-width: 76px; }
  .step-desc { font-size: 12px; color: var(--muted); }
  .step-eye { border: 0; border-left: 1px solid var(--line); border-radius: 0; padding: 0 12px; font-size: 13px; }
  .prompt-icon { width: 15px; height: 10px; display: inline-block; border: 1.5px solid currentColor; border-radius: 999px; position: relative; opacity: .72; }
  .prompt-icon::after { content: ''; position: absolute; width: 4px; height: 4px; border-radius: 50%; background: currentColor; left: 50%; top: 50%; transform: translate(-50%, -50%); }
  .spin { width: 12px; height: 12px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; margin-left: auto; animation: sp .7s linear infinite; }
  @keyframes sp { to { transform: rotate(360deg); } }
  .cand-hint { margin-top: 12px; font-size: 12px; color: var(--muted); background: var(--accent-2-soft); border: 1px solid var(--line); border-radius: var(--r-sm); padding: 8px 10px; }
  .run-row { display: grid; grid-template-columns: 1fr auto; gap: 8px; margin-top: 14px; }
  .run-row button { padding: 9px 11px; }

  .pv-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 150; display: flex; align-items: center; justify-content: center; }
  .pv-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .pv { position: relative; width: min(640px, 92vw); max-height: 80vh; display: flex; flex-direction: column; background: var(--pop); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-pop); }
  .pv-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  .pv-body { margin: 0; padding: 16px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.65; color: var(--text); white-space: pre-wrap; }
  .pv-foot { padding: 12px 16px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; }
</style>
