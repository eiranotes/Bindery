<script lang="ts">
  // 문체 - 한/일 원문을 분석해 문체 프리셋을 만들고, 집필 파이프라인에 적용한다.
  // 흐름: 원문 입력 → 장면별 분해(로컬) → 문체 종합 분석(AI) → 프리셋 저장 →
  // 적용(style-guide.md 렌더) → 집필 시 장면 유형별 오버레이 자동 주입.
  import { ctx, withBusy, toast, busy, activeRun, clearRunFeed } from '$lib/stores/app';
  import {
    analyzeStyleSource, saveStylePreset, applyStylePreset, deactivateStylePreset,
    deleteStylePreset, loadPresetIndex, loadPreset, loadStyleHistory, renderStyleGuide,
    detectLang, SCENE_TYPE_LABELS,
    type StyleAnalysisResult, type StylePresetIndex, type StyleHistoryEntry, type StylePreset, type StyleSceneType
  } from '$lib/harness/styleTransfer';
  import LiveRunPanel from '../LiveRunPanel.svelte';

  let sourceText = $state('');
  let analysis = $state<StyleAnalysisResult | null>(null);
  let presetName = $state('');
  let index = $state<StylePresetIndex | null>(null);
  let history = $state<StyleHistoryEntry[]>([]);
  let openedPreset = $state<StylePreset | null>(null);
  let fileInput = $state<HTMLInputElement | null>(null);

  const running = $derived(Boolean($busy || $activeRun));
  const sourceChars = $derived(sourceText.replace(/\s/g, '').length);
  const sourceLang = $derived(sourceText.trim() ? detectLang(sourceText) : '');
  const langLabel = (lang: string) =>
    lang === 'ko' ? '한국어' : lang === 'ja' ? '일본어' : lang === 'mixed' ? '한·일 혼합' : '판별 불가';
  const actionLabel: Record<StyleHistoryEntry['action'], string> = {
    analyzed: '분석',
    saved: '프리셋 저장',
    applied: '적용',
    deactivated: '적용 해제',
    deleted: '삭제'
  };
  const sceneTypeLabel = (type: string) => SCENE_TYPE_LABELS[type as StyleSceneType] ?? type;

  $effect(() => {
    void refresh();
  });

  async function refresh() {
    try {
      const c = ctx();
      index = await loadPresetIndex(c);
      history = await loadStyleHistory(c);
    } catch {
      index = null;
      history = [];
    }
  }

  async function pickFile(event: Event) {
    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    sourceText = await file.text();
    input.value = '';
    toast(`${file.name} 불러옴 (${sourceText.replace(/\s/g, '').length.toLocaleString()}자)`, 'ok');
  }

  async function analyze() {
    if (sourceChars < 300) {
      toast('문체를 읽기에는 원문이 짧습니다 (최소 300자 권장).', 'warn');
      return;
    }
    clearRunFeed();
    analysis = null;
    const r = await withBusy('문체 분석', () => analyzeStyleSource(ctx(), sourceText), false);
    if (!r) return;
    analysis = r;
    presetName = '';
    if (r.source === 'fallback') {
      toast('AI 실행기가 연결되지 않아 로컬 통계 뼈대만 만들었습니다. 설정을 확인하세요.', 'warn');
    } else {
      toast(`문체 분석 완료 - 장면 ${r.stats.scenes}개에서 결을 추출했습니다. 프리셋으로 저장하세요.`, 'ok');
    }
    await refresh();
  }

  async function savePreset() {
    if (!analysis) return;
    const saved = await withBusy('프리셋 저장', () => saveStylePreset(ctx(), presetName, analysis!), false);
    if (!saved) return;
    toast(`프리셋 「${saved.name}」 저장됨. 적용하면 집필에 바로 반영됩니다.`, 'ok');
    analysis = null;
    sourceText = '';
    presetName = '';
    await refresh();
  }

  async function apply(id: string) {
    const preset = await withBusy('프리셋 적용', () => applyStylePreset(ctx(), id), false);
    if (!preset) return;
    toast(`「${preset.name}」 적용됨 - 스타일 지침이 갱신됐고(이전본 스냅샷 보존), 다음 집필부터 장면별로 반영됩니다.`, 'ok');
    await refresh();
  }

  async function deactivate() {
    await withBusy('적용 해제', () => deactivateStylePreset(ctx()), false);
    toast('프리셋 적용을 해제했습니다. 스타일 지침 파일은 그대로 남아 있습니다.', 'info');
    await refresh();
  }

  async function remove(id: string, name: string) {
    if (!confirm(`프리셋 「${name}」을 삭제할까요? 이미 적용된 스타일 지침 파일은 남습니다.`)) return;
    await withBusy('프리셋 삭제', () => deleteStylePreset(ctx(), id), false);
    if (openedPreset?.id === id) openedPreset = null;
    toast(`「${name}」 삭제됨`, 'info');
    await refresh();
  }

  async function toggleDetail(id: string) {
    if (openedPreset?.id === id) {
      openedPreset = null;
      return;
    }
    openedPreset = await loadPreset(ctx(), id);
  }

  const activeName = $derived(index?.presets.find((p) => p.id === index?.activePresetId)?.name ?? null);
</script>

<div class="surface">
  <div class="col">
    <header class="head">
      <h1>문체</h1>
      <p class="lead">
        한국어·일본어 원문을 장면별로 분해해 결을 분석하고, 프리셋으로 저장해 집필에 적용합니다.
        원문 표현은 복제하지 않습니다 - 전역 분위기와 장면 유형별 특징만 가져옵니다.
      </p>
    </header>

    <div class="active" class:none={!activeName}>
      {#if activeName}
        <span class="chip ok">적용 중</span>
        <b>{activeName}</b>
        <span class="dim">집필 시 전역 분위기 + 이번 화 장면 유형에 맞는 특징이 자동 주입됩니다.</span>
        <span class="grow"></span>
        <button class="quiet" onclick={deactivate}>적용 해제</button>
      {:else}
        <span class="chip muted">프리셋 없음</span>
        <span class="dim">현재는 style/style-guide.md의 수동 지침을 사용합니다.</span>
      {/if}
    </div>

    {#if running}
      <LiveRunPanel title="문체 분석 중" />
    {:else if analysis}
      <section class="block">
        <span class="kicker">
          분석 결과 - {langLabel(analysis.stats.lang)} · {analysis.stats.chars.toLocaleString()}자 · 장면 {analysis.stats.scenes}개
          {#if analysis.source === 'agent'}<span class="chip ok">AI</span>{:else}<span class="chip warn">로컬 뼈대</span>{/if}
        </span>
        <p class="summary">{analysis.profile.summary}</p>
        <div class="cols2">
          <div>
            <span class="label">전역 규칙 {analysis.profile.global_rules.length}개</span>
            <ul class="rules">
              {#each analysis.profile.global_rules as rule}<li>{rule}</li>{/each}
            </ul>
          </div>
          <div>
            {#if analysis.profile.dialogue_voice.length}
              <span class="label">대화 처리</span>
              <ul class="rules">
                {#each analysis.profile.dialogue_voice as rule}<li>{rule}</li>{/each}
              </ul>
            {/if}
            {#if analysis.profile.forbidden.length}
              <span class="label">금지</span>
              <ul class="rules warn">
                {#each analysis.profile.forbidden as rule}<li>{rule}</li>{/each}
              </ul>
            {/if}
          </div>
        </div>
        {#if analysis.profile.scene_overlays.length}
          <span class="label">장면 유형별 특징 - 집필 시 이번 화에 나오는 유형만 골라 적용됩니다</span>
          <div class="overlays">
            {#each analysis.profile.scene_overlays as o}
              <div class="overlay">
                <span class="chip info">{sceneTypeLabel(o.scene_type)}</span>
                <div class="obody">
                  {#each o.traits as t}<p>{t}</p>{/each}
                  {#if o.quote}<p class="quote">"{o.quote}" <span class="dim">- 형태 참고용, 복제 금지</span></p>{/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
        {#if analysis.profile.content_terms.length}
          <p class="terms dim">원문 고유명사 (사용 금지 목록): {analysis.profile.content_terms.join(', ')}</p>
        {/if}
        <div class="row">
          <input class="grow" bind:value={presetName} placeholder="프리셋 이름 (예: ○○ 작가풍, 건조한 1인칭)" />
          <button class="primary big" onclick={savePreset}>프리셋으로 저장</button>
          <button class="quiet" onclick={() => (analysis = null)}>버리기</button>
        </div>
      </section>
    {:else}
      <section class="block">
        <span class="kicker">원문 분석 - 한국어·일본어 텍스트를 붙여넣거나 파일로 불러오세요</span>
        <textarea
          rows="10"
          bind:value={sourceText}
          placeholder="문체를 배우고 싶은 원문을 붙여넣으세요. 여러 장면이 포함될수록 분석이 정확해집니다. (권장 3,000자 이상)"
        ></textarea>
        <div class="row">
          <input class="hidden-input" type="file" accept=".txt,.md,text/plain" bind:this={fileInput} onchange={pickFile} />
          <button class="quiet" onclick={() => fileInput?.click()}>파일 불러오기 (.txt/.md)</button>
          {#if sourceText.trim()}
            <span class="dim">{langLabel(sourceLang)} · {sourceChars.toLocaleString()}자</span>
          {/if}
          <span class="grow"></span>
          <button class="primary big" onclick={analyze} disabled={!sourceText.trim()}>문체 분석</button>
        </div>
        <p class="dim small">
          분석은 원문을 저장하지 않습니다. 장면 분해와 고유명사 추출은 로컬에서, 결 해석만 AI가 수행합니다.
        </p>
      </section>
    {/if}

    <section class="block">
      <span class="kicker">프리셋 {index?.presets.length ?? 0}개</span>
      {#if !index?.presets.length}
        <p class="empty">저장된 문체 프리셋이 없습니다. 위에서 원문을 분석해 첫 프리셋을 만드세요.</p>
      {:else}
        <div class="presets">
          {#each index.presets as p (p.id)}
            <div class="preset" class:on={p.id === index.activePresetId}>
              <button class="namebtn" onclick={() => toggleDetail(p.id)} title="상세 보기">
                <b>{p.name}</b>
                <span class="chip muted">{langLabel(p.lang)}</span>
                {#if p.source !== 'agent'}<span class="chip warn">뼈대</span>{/if}
                {#if p.id === index.activePresetId}<span class="chip ok">적용 중</span>{/if}
              </button>
              <div class="row act">
                {#if p.id !== index.activePresetId}
                  <button class="primary" onclick={() => apply(p.id)}>적용</button>
                {/if}
                <button class="quiet" onclick={() => remove(p.id, p.name)}>삭제</button>
              </div>
              <p class="psum dim">{p.summary} · {p.createdAt.slice(0, 10)}</p>
              {#if openedPreset?.id === p.id}
                <pre class="pre panel detail">{renderStyleGuide(openedPreset)}</pre>
              {/if}
            </div>
          {/each}
        </div>
      {/if}
    </section>

    <section class="block">
      <span class="kicker">이력</span>
      {#if !history.length}
        <p class="empty">아직 기록이 없습니다.</p>
      {:else}
        <ul class="hist">
          {#each history.slice(0, 30) as h}
            <li>
              <span class="mono dim when">{h.at.slice(0, 16).replace('T', ' ')}</span>
              <span class="chip {h.action === 'applied' ? 'ok' : h.action === 'deleted' ? 'bad' : 'muted'}">{actionLabel[h.action]}</span>
              {#if h.name}<b>{h.name}</b>{/if}
              {#if h.note}<span class="dim">{h.note}</span>{/if}
            </li>
          {/each}
        </ul>
      {/if}
    </section>
  </div>
</div>

<style>
  .surface { padding: 26px 32px 40px; }
  .col { max-width: 860px; margin: 0 auto; display: grid; gap: 18px; align-content: start; }
  .head h1 { margin: 0; font-size: 22px; }
  .lead { margin: 4px 0 0; color: var(--muted); max-width: 62ch; line-height: 1.65; }
  .kicker { font-size: 10px; font-weight: 800; letter-spacing: 0.07em; text-transform: uppercase; color: var(--faint); display: flex; gap: 8px; align-items: center; }
  .block { display: grid; gap: 10px; border-top: 1px solid var(--line-strong); padding-top: 14px; }
  .row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
  .grow { flex: 1; min-width: 160px; }
  .big { padding: 8px 18px; font-size: 13.5px; }
  .small { font-size: 11.5px; margin: 0; }
  .hidden-input { display: none; }

  .active {
    display: flex; gap: 10px; align-items: center; flex-wrap: wrap;
    border: 1px solid var(--line); border-radius: 4px; background: var(--bg-1);
    padding: 10px 14px; font-size: 13px;
  }
  .active.none { background: transparent; }

  textarea { width: 100%; font-size: 13px; line-height: 1.7; }

  .summary { margin: 0; font-size: 13.5px; line-height: 1.7; }
  .cols2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
  .rules { margin: 4px 0 10px; padding-left: 18px; font-size: 12.5px; line-height: 1.65; display: grid; gap: 3px; }
  .rules.warn li { color: var(--warn); }

  .overlays { display: grid; border-top: 1px solid var(--line); }
  .overlay { display: flex; gap: 10px; align-items: baseline; padding: 9px 2px; border-bottom: 1px solid var(--line); }
  .overlay .obody { display: grid; gap: 3px; min-width: 0; }
  .overlay p { margin: 0; font-size: 12.5px; line-height: 1.6; }
  .overlay .quote { color: var(--muted); font-family: var(--serif); }
  .terms { margin: 0; font-size: 11.5px; }

  .presets { display: grid; border-top: 1px solid var(--line); }
  .preset {
    display: grid; gap: 4px;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 11px 2px;
    border-bottom: 1px solid var(--line);
  }
  .preset.on { background: var(--accent-soft); margin: 0 -10px; padding: 11px 12px; border-radius: 4px; }
  .namebtn { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; border: 0; padding: 0; text-align: left; font-size: 13.5px; color: var(--text); }
  .preset .act { grid-column: 2; grid-row: 1; flex-wrap: nowrap; }
  .psum { grid-column: 1 / -1; margin: 0; font-size: 12px; }
  .detail { grid-column: 1 / -1; max-height: 340px; overflow: auto; }
  .panel { border: 1px solid var(--line); border-radius: 4px; padding: 10px; background: var(--bg-1); }

  .hist { list-style: none; margin: 0; padding: 0; display: grid; border-top: 1px solid var(--line); }
  .hist li { display: flex; gap: 8px; align-items: baseline; flex-wrap: wrap; padding: 7px 2px; border-bottom: 1px solid var(--line); font-size: 12.5px; }
  .hist .when { font-size: 11px; }

  @media (max-width: 640px) {
    .cols2 { grid-template-columns: 1fr; }
    .preset { grid-template-columns: minmax(0, 1fr); }
    .preset .act { grid-column: 1; grid-row: auto; }
  }
</style>
