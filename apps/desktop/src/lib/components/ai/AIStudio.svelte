<script lang="ts">
  import CandidateDiffPanel from '$lib/components/candidates/CandidateDiffPanel.svelte';
  import QADashboard from '$lib/components/qa/QADashboard.svelte';
  import RevisionPanel from '$lib/components/revision/RevisionPanel.svelte';
  import RepetitionPanel from '$lib/components/analysis/RepetitionPanel.svelte';
  import { pipelineStore, harnessStages, gotoStage, setStepStatus, resetPipeline } from '$lib/stores/pipelineStore';
  import type { HarnessStage } from '$lib/stores/pipelineStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { episodeStore } from '$lib/stores/episodeStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { codexStore } from '$lib/stores/codexStore';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { qaStore } from '$lib/stores/qaStore';
  import { jobStore } from '$lib/stores/jobStore';
  import { toasts } from '$lib/stores/toastStore';
  import { testAgentCli, runNovelctl, writeFile, listTree } from '$lib/api/commands';
  import { runQAAction, runRevisionAction, runDraftAction, runAnalyzeAction } from '$lib/actions/pipeline';
  import { openFileInEditor } from '$lib/actions/project';
  import { assemblePrompt, STEP_META } from '$lib/domain/prompt';
  import type { PipelineStep } from '$lib/domain/prompt';
  import type { FileNode } from '$lib/types';

  const steps = Object.keys(STEP_META) as PipelineStep[];
  const verdictLabel = { pass: '통과', warn: '주의', fail: '실패' } as const;
  const statusLabel = { idle: '대기', running: '실행 중', done: '완료', failed: '실패' } as const;

  let previewStep: PipelineStep | null = null;
  let previewText = '';
  let running: PipelineStep | null = null;
  let testing = false;
  let testResult = '';
  let testOk: boolean | null = null;
  type DraftKind = 'draft' | 'continue' | 'rewrite';
  let draftKind: DraftKind = 'draft';
  const draftKinds: Array<[DraftKind, string]> = [['draft', '초안'], ['continue', '이어쓰기'], ['rewrite', '다시쓰기']];

  // ---- 상태 요약 (레일) -------------------------------------------------
  $: agentReady = Boolean($settingsStore.agentCliPath);
  $: bibleFiles = collectBibleFiles($fileTreeStore.nodes);
  $: hasBible = bibleFiles.length > 0 || $codexStore.items.length > 0;
  $: doneCount = steps.filter((s) => $pipelineStore.stepStatus[s] === 'done').length;
  $: failedCount = steps.filter((s) => $pipelineStore.stepStatus[s] === 'failed').length;
  $: episode = currentEpisode();
  $: fileName = $editorStore.path?.split('/').pop() ?? '원고 미선택';

  function collectBibleFiles(nodes: FileNode[]): FileNode[] {
    const out: FileNode[] = [];
    const walk = (list: FileNode[]) => {
      for (const n of list) {
        if (n.kind === 'file' && /(bible|canon|설정)/i.test(n.path) && n.path.endsWith('.md')) out.push(n);
        if (n.children) walk(n.children);
      }
    };
    walk(nodes);
    return out;
  }

  type StageState = { text: string; tone: 'ok' | 'warn' | 'bad' | 'neutral' };
  // 템플릿에서 함수 호출 대신 반응형 객체를 읽어야 스토어 변경이 레일에 반영된다.
  $: railStates = {
    connect: (agentReady ? { text: '연결됨', tone: 'ok' } : { text: '미설정', tone: 'warn' }) as StageState,
    bible: (hasBible
      ? { text: `문서 ${bibleFiles.length} · 항목 ${$codexStore.items.length}`, tone: 'ok' }
      : $pipelineStore.bibleSkipped
        ? { text: '생략하고 진행', tone: 'neutral' }
        : { text: '없음', tone: 'warn' }) as StageState,
    run: (failedCount
      ? { text: `실패 ${failedCount}`, tone: 'bad' }
      : doneCount === 0
        ? { text: `단계 ${steps.length}개 대기`, tone: 'neutral' }
        : { text: `${doneCount}/${steps.length} 완료`, tone: doneCount === steps.length ? 'ok' : 'warn' }) as StageState,
    review: reviewState($qaStore.report?.verdict, $candidateStore.candidates.length)
  } satisfies Record<HarnessStage, StageState>;

  function reviewState(v: 'pass' | 'warn' | 'fail' | undefined, count: number): StageState {
    const parts = [`후보 ${count}`];
    if (v) parts.push(`QA ${verdictLabel[v]}`);
    return { text: parts.join(' · '), tone: v === 'fail' ? 'bad' : v === 'warn' ? 'warn' : count ? 'ok' : 'neutral' };
  }

  // ---- 연결 --------------------------------------------------------------
  async function test() {
    testing = true;
    const r = await testAgentCli($settingsStore.agentCliPath, $settingsStore.agentProvider, $settingsStore.agentOutputMode);
    testResult = r.ok ? r.stdout : r.stderr || '응답 없음';
    testOk = r.ok;
    testing = false;
    toasts.push(r.ok ? 'AI 실행기 응답 확인' : 'AI 실행기 연결 실패', r.ok ? 'ok' : 'bad');
  }

  // ---- 바이블 ------------------------------------------------------------
  const BIBLE_TEMPLATE = `# 설정집 (바이블)

## 세계관
- (확정된 세계 규칙을 적습니다)

## 인물
- 주인공:
- 조연:

## 규칙
- (마법/기술/사회 규칙 등 어기면 안 되는 것)

## 열린 떡밥
- (회수해야 할 복선)
`;

  let creatingBible = false;
  async function createBible() {
    const root = $projectStore.current?.rootPath || 'sample-project';
    creatingBible = true;
    try {
      await writeFile(root, 'canon/setting-bible.md', BIBLE_TEMPLATE);
      const nodes = await listTree(root);
      fileTreeStore.update((s) => ({ ...s, nodes }));
      pipelineStore.update((s) => ({ ...s, bibleSkipped: false }));
      toasts.push('설정집 템플릿 생성됨: canon/setting-bible.md', 'ok');
      await openFileInEditor('canon/setting-bible.md');
    } catch (e) {
      toasts.push(`설정집 생성 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      creatingBible = false;
    }
  }
  function skipBible() {
    pipelineStore.update((s) => ({ ...s, bibleSkipped: true }));
    gotoStage('run');
    toasts.push('바이블 없이 진행합니다. 프롬프트에는 원고만 포함됩니다.', 'info');
  }

  // ---- 실행 --------------------------------------------------------------
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
    if (!result.ok) throw new Error(result.stderr || `novelctl ${step} 실패`);
  }

  const runners: Record<PipelineStep, () => void | Promise<void>> = {
    context: () => novelctl('context'),
    draft: () => runDraftAction(draftKind),
    analyze: () => runAnalyzeAction(),
    qa: runQAAction,
    revise: runRevisionAction,
    summarize: () => novelctl('summarize'),
    commit: () => novelctl('commit')
  };

  async function run(step: PipelineStep) {
    running = step;
    setStepStatus(step, 'running');
    try {
      await runners[step]();
      setStepStatus(step, 'done');
    } catch {
      setStepStatus(step, 'failed');
    } finally {
      running = null;
    }
  }
  async function runAll() {
    toasts.push(`전체 파이프라인 실행: ${steps.length}단계`, 'info');
    for (const step of steps) await run(step);
    gotoStage('review');
  }
  function preview(step: PipelineStep) {
    previewStep = step;
    previewText = assemblePrompt(step, $editorStore.content, $codexStore.items);
  }
</script>

<div class="ai-studio">
  <aside class="ai-rail" aria-label="AI 작업 단계">
    <div class="rail-head">
      <span class="eyebrow">AI 작업</span>
      <h2>소설 파이프라인</h2>
      <p class="rail-target" title={$editorStore.path}>{episode} · {fileName}</p>
    </div>

    <nav class="rail-stages">
      {#each harnessStages as st, i}
        <button class="rail-stage" class:on={$pipelineStore.stage === st.id} on:click={() => gotoStage(st.id)}>
          <b>0{i + 1}</b>
          <span class="rs-copy">
            <span class="rs-name">{st.label}</span>
            <small>{railStates[st.id].text}</small>
          </span>
          <span class="dot {railStates[st.id].tone}"></span>
        </button>
      {/each}
    </nav>

    <p class="rail-note">AI는 원고를 직접 수정하지 않습니다. 모든 출력은 후보와 보고서로 저장되고, 적용은 검토 단계에서 직접 선택합니다.</p>
  </aside>

  <section class="ai-stage">
    {#if $pipelineStore.stage === 'connect'}
      <header class="stage-head">
        <span class="eyebrow">01 연결</span>
        <h1>AI 실행기 연결</h1>
        <p>로컬 CLI로 실행합니다. 연결이 없어도 집필은 가능하고, 이 단계만 마치면 파이프라인 전체를 쓸 수 있습니다.</p>
      </header>

      <div class="stage-body narrow">
        <div class="line-form">
          <label class="line-row">
            <span>실행기</span>
            <select bind:value={$settingsStore.agentProvider}>
              <option value="codex">Codex CLI</option>
              <option value="antigravity">Antigravity CLI</option>
              <option value="gemini">Gemini CLI</option>
              <option value="custom">직접 설정</option>
            </select>
          </label>
          <label class="line-row">
            <span>명령어</span>
            <input bind:value={$settingsStore.agentCliPath} placeholder="codex 또는 /opt/homebrew/bin/codex" />
          </label>
          <label class="line-row">
            <span>출력 방식</span>
            <select bind:value={$settingsStore.agentOutputMode}>
              <option value="stdout">터미널 출력(stdout)</option>
              <option value="file">파일로 받기</option>
            </select>
          </label>
          <label class="line-row">
            <span>novelctl</span>
            <input bind:value={$settingsStore.novelctlPath} placeholder="novelctl" />
          </label>
          <label class="line-row check">
            <span>데모 모드</span>
            <span class="check-cell"><input type="checkbox" bind:checked={$settingsStore.mockMode} /> CLI 없이 mock 데이터로 흐름 확인</span>
          </label>
        </div>

        <div class="stage-actions">
          <button class="primary" on:click={test} disabled={testing}>{testing ? '확인 중…' : '연결 테스트'}</button>
          {#if testOk !== null}
            <span class="test-state" class:ok={testOk} class:bad={!testOk}>{testOk ? '응답 확인됨' : '실패'}</span>
          {/if}
          <button class="ghost" on:click={() => gotoStage('bible')}>다음: 바이블 →</button>
        </div>
        {#if testResult}<pre class="console">{testResult}</pre>{/if}

        <p class="stage-note">Gemini는 계정 정책에 따라 headless 실행이 막힐 수 있습니다. Antigravity는 명령어를 <code>agy</code>로 바꾸고 파일 출력을 선택하세요.</p>
      </div>
    {:else if $pipelineStore.stage === 'bible'}
      <header class="stage-head">
        <span class="eyebrow">02 바이블</span>
        <h1>설정집 확인</h1>
        <p>파이프라인은 설정집(바이블)과 원고를 함께 읽습니다. 설정집이 없어도 원고만으로 진행할 수 있습니다.</p>
      </header>

      <div class="stage-body narrow">
        {#if bibleFiles.length}
          <div class="line-list">
            <span class="line-label">감지된 설정 문서</span>
            {#each bibleFiles as f}
              <button class="line-item" on:click={() => openFileInEditor(f.path)} title="집필 화면에서 열기">
                <b>{f.name}</b>
                <span>{f.path}</span>
              </button>
            {/each}
          </div>
        {:else}
          <div class="bible-missing">
            <p><b>설정집 파일이 없습니다.</b> 두 가지 중 하나를 선택하세요.</p>
            <div class="stage-actions">
              <button class="primary" on:click={createBible} disabled={creatingBible}>{creatingBible ? '생성 중…' : '설정집 템플릿 만들기'}</button>
              <button class="ghost" on:click={skipBible}>바이블 없이 진행 →</button>
            </div>
            <p class="stage-note">템플릿은 <code>canon/setting-bible.md</code>에 만들어지고 바로 편집할 수 있습니다. 생략하면 프롬프트에 원고와 회차 메타데이터만 들어갑니다.</p>
          </div>
        {/if}

        {#if $codexStore.items.length}
          <div class="line-list">
            <span class="line-label">설정 항목 {$codexStore.items.length}개 — 원고에 등장하면 프롬프트에 자동 포함</span>
            {#each $codexStore.items.slice(0, 8) as item}
              <div class="line-item static">
                <b>{item.name}</b>
                <span>{item.summary ?? ''}</span>
              </div>
            {/each}
          </div>
        {/if}

        {#if bibleFiles.length || $codexStore.items.length}
          <div class="stage-actions">
            <button class="primary" on:click={() => gotoStage('run')}>다음: 실행 →</button>
          </div>
        {/if}
      </div>
    {:else if $pipelineStore.stage === 'run'}
      <header class="stage-head">
        <span class="eyebrow">03 실행</span>
        <h1>파이프라인 실행</h1>
        <p>위에서 아래 순서로 진행됩니다. 단계별로 따로 실행하거나 전체를 이어서 실행할 수 있고, 프롬프트는 실행 전에 그대로 확인할 수 있습니다.</p>
      </header>

      <div class="stage-body">
        <ol class="pipe-list">
          {#each steps as step, i}
            {@const st = $pipelineStore.stepStatus[step]}
            <li class="pipe-step" class:running={st === 'running'} class:done={st === 'done'} class:failed={st === 'failed'}>
              <span class="pipe-num">{i + 1}</span>
              <div class="pipe-copy">
                <b>{STEP_META[step].label}</b>
                <small>{STEP_META[step].desc}</small>
              </div>
              {#if step === 'draft'}
                <select class="pipe-kind" bind:value={draftKind} title="후보 종류">
                  {#each draftKinds as [k, label]}<option value={k}>{label}</option>{/each}
                </select>
              {/if}
              <span class="pipe-state {st}">{running === step ? '실행 중' : statusLabel[st]}</span>
              <div class="pipe-actions">
                <button class="ghost tiny" on:click={() => preview(step)}>프롬프트</button>
                <button class="ghost tiny" on:click={() => run(step)} disabled={running !== null}>실행</button>
              </div>
            </li>
          {/each}
        </ol>

        <div class="stage-actions">
          <button class="primary" on:click={runAll} disabled={running !== null}>전체 실행</button>
          <button class="ghost" on:click={resetPipeline} disabled={running !== null}>상태 초기화</button>
          <button class="ghost" on:click={() => gotoStage('review')}>다음: 검토 →</button>
        </div>
        {#if $candidateStore.candidates.length}
          <p class="stage-note">후보 {$candidateStore.candidates.length}개가 준비되었습니다. 검토 단계에서 비교하고 적용하세요.</p>
        {/if}
      </div>
    {:else}
      <header class="stage-head">
        <span class="eyebrow">04 검토</span>
        <h1>후보 비교와 적용</h1>
        <p>후보는 원고와 나란히 비교하고, 필요한 문단만 적용합니다. 첫 적용 전에 원본이 자동으로 스냅샷됩니다.</p>
      </header>

      <div class="review-layout">
        <section class="review-main">
          <CandidateDiffPanel />
        </section>
        <section class="review-side">
          <QADashboard />
          <RevisionPanel />
          <RepetitionPanel />
        </section>
      </div>
    {/if}
  </section>
</div>

{#if previewStep}
  <div class="pv-backdrop">
    <button class="pv-close-area" aria-label="닫기" on:click={() => (previewStep = null)}></button>
    <div class="pv" role="dialog" aria-modal="true">
      <div class="pv-head">
        <span class="eyebrow">프롬프트 미리보기 — {STEP_META[previewStep].label}</span>
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
  .ai-studio { min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr); }
  .ai-rail {
    display: grid;
    grid-template-rows: auto 1fr auto;
    align-content: start;
    gap: 14px;
    padding: 18px 16px;
    border-right: 1px solid var(--line);
    background: var(--bg-1);
    min-height: 0;
    overflow: auto;
  }
  .rail-head h2 { margin: 3px 0 6px; font-size: 19px; line-height: 1.15; }
  .rail-target { margin: 0; color: var(--faint); font-size: 11.5px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rail-stages { display: grid; align-content: start; border-top: 1px solid var(--line); }
  .rail-stage {
    display: grid;
    grid-template-columns: 30px minmax(0, 1fr) 10px;
    gap: 10px;
    align-items: center;
    text-align: left;
    padding: 12px 4px;
    border: 0;
    border-bottom: 1px solid var(--line);
    border-radius: 0;
    position: relative;
  }
  .rail-stage b { color: var(--faint); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; font-weight: 600; }
  .rail-stage.on b { color: var(--accent); }
  .rail-stage.on::before { content: ''; position: absolute; left: -16px; top: 10px; bottom: 10px; width: 2px; background: var(--accent); }
  .rs-copy { min-width: 0; display: grid; gap: 2px; }
  .rs-name { color: var(--text); font-weight: 650; font-size: 13.5px; }
  .rail-stage small { color: var(--muted); font-size: 11px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .rail-note { margin: 0; color: var(--faint); font-size: 11.5px; line-height: 1.6; border-top: 1px solid var(--line); padding-top: 12px; }

  .ai-stage { min-height: 0; overflow: auto; padding: 22px 26px; }
  .stage-head { max-width: 720px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .stage-head h1 { margin: 4px 0 7px; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
  .stage-head p { margin: 0; color: var(--muted); line-height: 1.65; }
  .stage-body { padding-top: 18px; display: grid; gap: 18px; align-content: start; }
  .stage-body.narrow { max-width: 620px; }
  .stage-note { margin: 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .stage-note code { background: var(--accent-soft); border-radius: 4px; padding: 1px 5px; font-family: ui-monospace, monospace; font-size: .9em; }
  .stage-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .test-state { font-size: 12px; }
  .test-state.ok { color: var(--ok); }
  .test-state.bad { color: var(--bad); }

  .line-form { display: grid; border-top: 1px solid var(--line); }
  .line-row {
    display: grid;
    grid-template-columns: 110px minmax(0, 1fr);
    gap: 12px;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
  }
  .line-row > span:first-child { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .line-row input, .line-row select { width: 100%; }
  .line-row.check .check-cell { display: flex; align-items: center; gap: 8px; color: var(--muted); font-size: 12.5px; }

  .line-list { display: grid; border-top: 1px solid var(--line); }
  .line-label { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; padding: 10px 0 4px; }
  .line-item {
    display: grid;
    grid-template-columns: minmax(120px, .35fr) minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    text-align: left;
    border: 0;
    border-radius: 0;
    border-bottom: 1px solid var(--line);
    padding: 10px 2px;
  }
  .line-item b { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line-item span { color: var(--muted); font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .line-item.static { cursor: default; }
  .bible-missing { display: grid; gap: 12px; }
  .bible-missing p { margin: 0; color: var(--muted); line-height: 1.6; }
  .bible-missing b { color: var(--text); }

  .pipe-list { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); max-width: 760px; }
  .pipe-step {
    display: grid;
    grid-template-columns: 34px minmax(0, 1fr) auto auto auto;
    gap: 12px;
    align-items: center;
    padding: 11px 0;
    border-bottom: 1px solid var(--line);
    position: relative;
  }
  .pipe-num {
    width: 24px; height: 24px;
    display: grid; place-items: center;
    border: 1px solid var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 11px; font-weight: 700;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    background: var(--bg-1);
    z-index: 1;
  }
  /* 단계 사이 연결선 — 파이프라인임이 한눈에 보이게 */
  .pipe-step:not(:last-child)::after {
    content: '';
    position: absolute;
    left: 11.5px;
    top: calc(50% + 14px);
    bottom: -14px;
    width: 1px;
    background: var(--line-strong);
  }
  .pipe-step.done .pipe-num { color: var(--ok); border-color: color-mix(in srgb, var(--ok) 45%, transparent); background: var(--ok-soft); }
  .pipe-step.failed .pipe-num { color: var(--bad); border-color: color-mix(in srgb, var(--bad) 45%, transparent); background: var(--bad-soft); }
  .pipe-step.running .pipe-num { color: var(--accent); border-color: var(--accent); }
  .pipe-copy { min-width: 0; display: grid; gap: 2px; }
  .pipe-copy b { font-size: 13.5px; color: var(--text); }
  .pipe-copy small { color: var(--muted); font-size: 11.5px; }
  .pipe-kind { font-size: 12px; padding: 4px 6px; }
  .pipe-state { font-size: 11px; color: var(--faint); min-width: 44px; text-align: right; font-variant-numeric: tabular-nums; }
  .pipe-state.running { color: var(--accent); }
  .pipe-state.done { color: var(--ok); }
  .pipe-state.failed { color: var(--bad); }
  .pipe-actions { display: flex; gap: 4px; }
  .tiny { padding: 4px 9px; font-size: 11.5px; }

  .review-layout {
    padding-top: 16px;
    display: grid;
    grid-template-columns: minmax(0, 1.25fr) minmax(300px, .75fr);
    gap: 14px;
    align-items: start;
    min-height: 0;
  }
  .review-main { min-width: 0; border: 1px solid var(--line); border-radius: var(--r-md); background: var(--bg-2); overflow: hidden; min-height: 320px; }
  .review-side { min-width: 0; display: grid; gap: 10px; align-content: start; }

  .pv-backdrop { position: fixed; inset: 0; background: rgba(20,18,14,.35); z-index: 150; display: flex; align-items: center; justify-content: center; }
  .pv-close-area { position: absolute; inset: 0; border: 0; background: transparent; }
  .pv { position: relative; width: min(640px, 92vw); max-height: 80vh; display: flex; flex-direction: column; background: var(--pop); border: 1px solid var(--line); border-radius: var(--r-lg); box-shadow: var(--shadow-pop); }
  .pv-head { display: flex; justify-content: space-between; align-items: center; padding: 12px 16px; border-bottom: 1px solid var(--line); }
  .pv-body { margin: 0; padding: 16px; overflow: auto; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; line-height: 1.65; color: var(--text); white-space: pre-wrap; }
  .pv-foot { padding: 12px 16px; border-top: 1px solid var(--line); display: flex; justify-content: flex-end; }

  @media (max-width: 1100px) {
    .ai-studio { grid-template-columns: 1fr; }
    .ai-rail { grid-template-rows: none; border-right: 0; border-bottom: 1px solid var(--line); }
    .rail-stages { grid-template-columns: repeat(2, 1fr); }
    .rail-stage.on::before { display: none; }
    .rail-stage.on { background: var(--accent-soft); }
    .review-layout { grid-template-columns: 1fr; }
  }
  @media (max-width: 700px) {
    .ai-stage { padding: 16px; }
    .pipe-step { grid-template-columns: 34px minmax(0, 1fr); grid-auto-flow: row; }
    .pipe-step::after { display: none; }
    .pipe-state, .pipe-actions, .pipe-kind { grid-column: 2; justify-self: start; text-align: left; }
    .rail-stages { grid-template-columns: 1fr; }
  }
</style>
