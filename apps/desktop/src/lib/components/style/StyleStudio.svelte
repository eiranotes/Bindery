<script lang="ts">
  import MarkdownPreview from '$lib/components/editor/MarkdownPreview.svelte';
  import { styleStore } from '$lib/stores/styleStore';
  import type { StyleStep } from '$lib/stores/styleStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { settingsStore } from '$lib/stores/settingsStore';
  import { toasts } from '$lib/stores/toastStore';
  import { runAgentText, writeFile, listTree } from '$lib/api/commands';
  import {
    analyzeStyle,
    buildExtractPrompt,
    buildGuidePrompt,
    buildProofPrompt,
    buildGuidelinePrompt,
    mockExtract,
    mockGuide,
    mockProof,
    mockGuideline
  } from '$lib/domain/style';

  const stages: Array<{ id: StyleStep; label: string; desc: string }> = [
    { id: 'sample', label: '샘플 입력', desc: '재현할 텍스트' },
    { id: 'analyze', label: '장면 분석', desc: '정량 + 감성' },
    { id: 'guide', label: '작성 지침', desc: '지침·금지 목록' },
    { id: 'proof', label: '재현 테스트', desc: '새 장면 샘플' },
    { id: 'final', label: '지침서', desc: '집필 반영' }
  ];

  let running: StyleStep | null = null;
  let offlineNotice = false;

  $: s = $styleStore;
  $: sampleChars = s.sampleText.replace(/\s/g, '').length;
  $: agentReady = Boolean($settingsStore.agentCliPath) && !$settingsStore.mockMode;

  function goto(step: StyleStep) {
    styleStore.update((v) => ({ ...v, step }));
  }

  type StageState = { text: string; tone: 'ok' | 'warn' | 'neutral' };
  $: railStates = {
    sample: (sampleChars > 0 ? { text: `${sampleChars.toLocaleString()}자`, tone: sampleChars >= 1500 ? 'ok' : 'warn' } : { text: '비어 있음', tone: 'neutral' }) as StageState,
    analyze: (s.analysis ? { text: `장면 ${s.analysis.scenes.length}개${s.extract ? ' · 문체 추출됨' : ''}`, tone: s.extract ? 'ok' : 'warn' } : { text: '대기', tone: 'neutral' }) as StageState,
    guide: (s.guide ? { text: '지침 생성됨', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState,
    proof: (s.proof ? { text: '샘플 있음', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState,
    final: (s.guideline ? { text: s.savedPath ? '저장·집필 반영' : '생성됨', tone: 'ok' } : { text: '대기', tone: 'neutral' }) as StageState
  } satisfies Record<StyleStep, StageState>;

  function projectRoot(): string {
    return $projectStore.current?.rootPath || 'sample-project';
  }

  /** AI 실행 — 실패하거나 오프라인이면 정량 분석 기반 기본 문서로 대체하고 표시한다. */
  async function agentOrMock(prompt: string, label: string, mock: string): Promise<string> {
    const r = await runAgentText(projectRoot(), prompt, label);
    if (r.ok && r.text.trim()) {
      offlineNotice = false;
      return r.text.trim();
    }
    offlineNotice = true;
    return mock;
  }

  function runAnalyze() {
    if (sampleChars < 200) {
      toasts.push('샘플이 너무 짧습니다. 최소 200자, 권장 1,500자 이상을 붙여넣으세요.', 'warn');
      return;
    }
    const analysis = analyzeStyle(s.sampleText);
    styleStore.update((v) => ({ ...v, analysis, extract: null, step: 'analyze' }));
    toasts.push(`장면 ${analysis.scenes.length}개로 나눠 분석했습니다`, 'ok');
  }

  async function runExtract() {
    if (!s.analysis) return;
    running = 'analyze';
    try {
      const text = await agentOrMock(buildExtractPrompt(s.sampleText, s.analysis), 'style-extract', mockExtract(s.analysis));
      styleStore.update((v) => ({ ...v, extract: text }));
      toasts.push(offlineNotice ? '오프라인 기본 분석을 생성했습니다' : '문체 추출 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runGuide() {
    if (!s.analysis) return;
    running = 'guide';
    try {
      const extract = s.extract ?? mockExtract(s.analysis);
      const text = await agentOrMock(buildGuidePrompt(s.sampleText, s.analysis, extract), 'style-guide', mockGuide(s.analysis));
      styleStore.update((v) => ({ ...v, guide: text }));
      toasts.push(offlineNotice ? '오프라인 기본 지침을 생성했습니다' : '작성 지침 생성 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runProof() {
    if (!s.guide) return;
    running = 'proof';
    try {
      const text = await agentOrMock(buildProofPrompt(s.guide, s.extract ?? '', s.sampleText), 'style-proof', mockProof());
      styleStore.update((v) => ({ ...v, proof: text }));
      toasts.push(offlineNotice ? '오프라인 샘플을 생성했습니다' : '재현 샘플 생성 완료 — 원문 느낌과 비교해보세요', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  async function runFinalize() {
    if (!s.analysis || !s.guide) return;
    running = 'final';
    try {
      const text = await agentOrMock(
        buildGuidelinePrompt(s.extract ?? '', s.guide, s.proof ?? '', s.analysis),
        'style-guideline',
        mockGuideline(s.analysis)
      );
      styleStore.update((v) => ({ ...v, guideline: text, savedPath: null }));
      toasts.push(offlineNotice ? '오프라인 기본 지침서를 생성했습니다' : '문체 지침서 생성 완료', offlineNotice ? 'warn' : 'ok');
    } finally {
      running = null;
    }
  }

  let saving = false;
  async function saveGuideline() {
    if (!s.guideline) return;
    saving = true;
    try {
      await writeFile(projectRoot(), 'canon/style-guide.md', s.guideline);
      const nodes = await listTree(projectRoot());
      fileTreeStore.update((v) => ({ ...v, nodes }));
      styleStore.update((v) => ({ ...v, savedPath: 'canon/style-guide.md' }));
      toasts.push('지침서 저장됨: canon/style-guide.md — AI 작업 바이블에서도 보입니다', 'ok');
    } catch (e) {
      toasts.push(`저장 실패: ${e instanceof Error ? e.message : String(e)}`, 'bad');
    } finally {
      saving = false;
    }
  }

  function resetAll() {
    styleStore.update((v) => ({ ...v, analysis: null, extract: null, guide: null, proof: null, guideline: null, savedPath: null, step: 'sample' }));
  }
</script>

<div class="style-studio">
  <aside class="st-rail" aria-label="문체 재현 단계">
    <div class="rail-head">
      <span class="eyebrow">문체</span>
      <h2>문체 재현</h2>
      <p class="rail-target">{agentReady ? 'AI 연결됨' : '오프라인 — 기본 생성'}</p>
    </div>

    <nav class="rail-stages">
      {#each stages as st, i}
        <button class="rail-stage" class:on={s.step === st.id} on:click={() => goto(st.id)}>
          <b>0{i + 1}</b>
          <span class="rs-copy">
            <span class="rs-name">{st.label}</span>
            <small>{railStates[st.id].text}</small>
          </span>
          <span class="dot {railStates[st.id].tone}"></span>
        </button>
      {/each}
    </nav>

    <p class="rail-note">목표는 수치 복사가 아니라 <b>읽었을 때의 느낌</b> 재현입니다. 원문 문장 복사·반복은 지침으로 금지됩니다. 확정된 지침서는 초안 후보 프롬프트에 자동 포함됩니다.</p>
  </aside>

  <section class="st-stage">
    {#if s.step === 'sample'}
      <header class="stage-head">
        <span class="eyebrow">01 샘플 입력</span>
        <h1>재현할 텍스트 붙여넣기</h1>
        <p>문체를 재현하고 싶은 글을 붙여넣습니다. 장면이 나뉘는 긴 글일수록 분석이 정확해집니다 (권장 1,500자 이상, 최대 약 6,000자 분석).</p>
      </header>
      <div class="stage-body">
        <textarea
          class="sample-input"
          rows="16"
          placeholder="여기에 샘플 텍스트를 붙여넣으세요. 장면 구분(빈 줄 두 개, ***, 소제목)이 있으면 그대로 인식합니다."
          value={s.sampleText}
          on:input={(e) => styleStore.update((v) => ({ ...v, sampleText: e.currentTarget.value }))}
        ></textarea>
        <div class="stage-actions">
          <button class="primary" on:click={runAnalyze}>장면 분석 →</button>
          <span class="count-hint">{sampleChars.toLocaleString()}자 (공백 제외)</span>
          {#if s.analysis}<button class="ghost" on:click={resetAll}>처음부터</button>{/if}
        </div>
      </div>
    {:else if s.step === 'analyze'}
      <header class="stage-head">
        <span class="eyebrow">02 장면 분석</span>
        <h1>장면별 구조와 문체 추출</h1>
        <p>먼저 정량 참고치(문장 길이, 대화 비중, 감정어, 종결 습관)를 만들고, AI가 그 위에서 호흡·온도·거리감 같은 감성 층위를 분석합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.analysis}
          <p class="stage-note">샘플이 없습니다. 01 단계에서 텍스트를 먼저 붙여넣으세요.</p>
        {:else}
          <div class="scene-table" role="table" aria-label="장면별 정량 분석">
            <div class="scene-row head" role="row">
              <span>장면</span><span>문장</span><span>평균 길이</span><span>대화</span><span>감정어/1k</span><span>변칙 종결</span><span>주요 어미</span>
            </div>
            {#each s.analysis.scenes as sc}
              <div class="scene-row" role="row">
                <span class="sc-title" title={sc.title}>{sc.index}. {sc.title}</span>
                <span>{sc.sentenceCount}</span>
                <span>{sc.avgSentenceLen}자</span>
                <span>{sc.dialogueRatio}%</span>
                <span>{sc.emotionDensity}</span>
                <span>{sc.inversionRatio}%</span>
                <span class="sc-endings">{sc.endings.slice(0, 3).map((e) => e.form).join(' · ')}</span>
              </div>
            {/each}
          </div>

          <div class="stage-actions">
            <button class="primary" on:click={runExtract} disabled={running !== null}>{running === 'analyze' ? '추출 중…' : s.extract ? '문체 다시 추출 (AI)' : '문체 추출 (AI)'}</button>
            {#if s.extract}<button class="ghost" on:click={() => goto('guide')}>다음: 작성 지침 →</button>{/if}
          </div>

          {#if s.extract}
            <div class="md-output"><MarkdownPreview content={s.extract} /></div>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'guide'}
      <header class="stage-head">
        <span class="eyebrow">03 작성 지침</span>
        <h1>장면별 지침과 금지 목록</h1>
        <p>분석을 실행 지침으로 바꿉니다 — 장면 유형별로 무엇을 하고, 어떤 단어·묘사가 이 문체를 깨뜨리는지 명시합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.analysis}
          <p class="stage-note">02 장면 분석을 먼저 실행하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runGuide} disabled={running !== null}>{running === 'guide' ? '생성 중…' : s.guide ? '지침 다시 생성' : '지침 생성'}</button>
            {#if s.guide}<button class="ghost" on:click={() => goto('proof')}>다음: 재현 테스트 →</button>{/if}
          </div>
          {#if s.guide}
            <div class="md-output"><MarkdownPreview content={s.guide} /></div>
          {:else}
            <p class="stage-note">지침에는 장면 유형별 작성 규칙, 금지어, 금지 묘사, 리듬 규칙이 포함됩니다.</p>
          {/if}
        {/if}
      </div>
    {:else if s.step === 'proof'}
      <header class="stage-head">
        <span class="eyebrow">04 재현 테스트</span>
        <h1>원문에 없는 장면으로 검증</h1>
        <p>지침만으로 완전히 새로운 장면을 쓰게 해서, 문장 복사 없이 문체의 느낌이 재현되는지 직접 읽고 판단합니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.guide}
          <p class="stage-note">03 작성 지침을 먼저 생성하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runProof} disabled={running !== null}>{running === 'proof' ? '작성 중…' : s.proof ? '샘플 다시 작성' : '재현 샘플 작성'}</button>
            {#if s.proof}<button class="ghost" on:click={() => goto('final')}>다음: 지침서 →</button>{/if}
          </div>
          {#if s.proof}
            <div class="md-output"><MarkdownPreview content={s.proof} /></div>
            <p class="stage-note">느낌이 다르면 03 단계로 돌아가 지침을 다시 생성하거나, 샘플 텍스트를 더 넣어 분석 정확도를 높이세요.</p>
          {/if}
        {/if}
      </div>
    {:else}
      <header class="stage-head">
        <span class="eyebrow">05 지침서</span>
        <h1>최종 문체 지침서</h1>
        <p>분석·지침·재현 테스트를 하나의 지침서로 통합합니다. 저장하면 <code>canon/style-guide.md</code>로 기록되고, AI 초안 후보 프롬프트에 자동 포함됩니다.</p>
      </header>
      <div class="stage-body">
        {#if !s.guide}
          <p class="stage-note">03 작성 지침까지 먼저 완료하세요.</p>
        {:else}
          <div class="stage-actions">
            <button class="primary" on:click={runFinalize} disabled={running !== null}>{running === 'final' ? '작성 중…' : s.guideline ? '지침서 다시 생성' : '지침서 생성'}</button>
            {#if s.guideline}
              <button class="ghost" on:click={saveGuideline} disabled={saving}>{saving ? '저장 중…' : s.savedPath ? '다시 저장' : '프로젝트에 저장'}</button>
              <label class="apply-check">
                <input type="checkbox" checked={s.applyToDraft} on:change={(e) => styleStore.update((v) => ({ ...v, applyToDraft: e.currentTarget.checked }))} />
                집필 프롬프트에 반영
              </label>
            {/if}
          </div>
          {#if s.savedPath}<p class="stage-note ok">저장됨: {s.savedPath} — AI 작업 02 바이블과 산출물 보관함에서 확인할 수 있습니다.</p>{/if}
          {#if s.guideline}
            <div class="md-output"><MarkdownPreview content={s.guideline} /></div>
          {/if}
        {/if}
      </div>
    {/if}
  </section>
</div>

<style>
  .style-studio { min-height: 0; display: grid; grid-template-columns: 250px minmax(0, 1fr); }
  .st-rail {
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
  .rail-target { margin: 0; color: var(--faint); font-size: 11.5px; }
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
  .rail-note b { color: var(--muted); }

  .st-stage { min-height: 0; overflow: auto; padding: 22px 26px; }
  .stage-head { max-width: 760px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
  .stage-head h1 { margin: 4px 0 7px; font-size: 24px; line-height: 1.12; letter-spacing: 0; }
  .stage-head p { margin: 0; color: var(--muted); line-height: 1.65; }
  .stage-head code { background: var(--accent-soft); border-radius: 4px; padding: 1px 5px; font-family: ui-monospace, monospace; font-size: .9em; }
  .stage-body { padding-top: 18px; display: grid; gap: 16px; align-content: start; max-width: 860px; }
  .stage-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .stage-note { margin: 0; color: var(--faint); font-size: 12px; line-height: 1.6; }
  .stage-note.ok { color: var(--ok); }

  .sample-input {
    width: 100%;
    resize: vertical;
    background: var(--bg-desk);
    color: var(--text);
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    padding: 14px;
    font-family: var(--manuscript-font);
    font-size: 14px;
    line-height: 1.9;
  }
  .count-hint { color: var(--faint); font-size: 12px; font-variant-numeric: tabular-nums; }

  .scene-table { display: grid; border-top: 1px solid var(--line); font-size: 12.5px; }
  .scene-row {
    display: grid;
    grid-template-columns: minmax(140px, 1.4fr) 50px 70px 50px 76px 70px minmax(90px, 1fr);
    gap: 8px;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--line);
    color: var(--text);
  }
  .scene-row.head { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .06em; text-transform: uppercase; }
  .scene-row span { font-variant-numeric: tabular-nums; }
  .sc-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .sc-endings { color: var(--muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  .md-output {
    border: 1px solid var(--line);
    border-radius: var(--r-md);
    background: var(--bg-2);
    max-height: 520px;
    overflow: auto;
  }
  .md-output :global(.preview) { border-left: 0; padding: 18px 22px; font-size: 13.5px; line-height: 1.85; }
  .apply-check { display: inline-flex; align-items: center; gap: 7px; color: var(--muted); font-size: 12.5px; }

  @media (max-width: 1100px) {
    .style-studio { grid-template-columns: 1fr; }
    .st-rail { grid-template-rows: none; border-right: 0; border-bottom: 1px solid var(--line); }
    .rail-stages { grid-template-columns: repeat(2, 1fr); }
    .rail-stage.on::before { display: none; }
    .rail-stage.on { background: var(--accent-soft); }
    .scene-row { grid-template-columns: minmax(110px, 1.2fr) 44px 60px 44px 60px 60px minmax(70px, 1fr); }
  }
  @media (max-width: 700px) {
    .st-stage { padding: 16px; }
    .rail-stages { grid-template-columns: 1fr; }
    .scene-row { grid-template-columns: 1fr 1fr 1fr 1fr; }
    .scene-row.head { display: none; }
  }
</style>
