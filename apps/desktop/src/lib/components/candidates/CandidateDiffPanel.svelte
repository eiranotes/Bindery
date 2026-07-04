<script lang="ts">
  import DiffView from '$lib/components/diff/DiffView.svelte';
  import { candidateStore } from '$lib/stores/candidateStore';
  import { editorStore } from '$lib/stores/editorStore';
  import { uiStore } from '$lib/stores/uiStore';
  import { toasts } from '$lib/stores/toastStore';
  import { createSnapshot } from '$lib/api/commands';
  import { projectStore } from '$lib/stores/projectStore';
  import { runDraftAction, runQAAction } from '$lib/actions/pipeline';
  import { diffLines, applyHunk } from '$lib/domain/diff';
  import { styleStore } from '$lib/stores/styleStore';
  import { recordHumanDecision } from '$lib/stores/runStore';
  import { scoreStyleMatch } from '$lib/domain/style';
  import { contentHash, shortHash } from '$lib/domain/hash';

  $: active = $candidateStore.candidates.find((c) => c.id === $candidateStore.activeId) || null;
  $: session = $candidateStore.session;
  // 기본 diff 기준: 생성 시점 baseline. 세션이 없으면 라이브 에디터로 폴백한다.
  let diffBase: 'baseline' | 'editor' = 'baseline';
  $: if (!session) diffBase = 'editor';
  $: editorMatchesBaseline = session ? contentHash($editorStore.content) === session.baselineHash : true;
  $: baseText = diffBase === 'baseline' && session ? session.baselineContent : $editorStore.content;
  $: diff = active ? diffLines(baseText, active.content) : null;

  // 문체 시스템에 프리셋이 있으면 후보별 문체 부합도를 매겨 검토 판단을 돕는다.
  $: styleProfile = $styleStore.presets[0] ?? null;
  $: candidateScores = (() => {
    const profile = styleProfile;
    if (!profile) return {} as Record<string, number>;
    return Object.fromEntries(
      $candidateStore.candidates.map((c) => [c.id, Math.round(scoreStyleMatch(c.content, profile).total_score * 100)])
    );
  })();

  function select(id: string) {
    candidateStore.update((s) => ({ ...s, activeId: id }));
  }

  async function applyAll() {
    if (!active) return;
    if (diffBase === 'baseline' && !editorMatchesBaseline) {
      toasts.push('현재 원고가 baseline과 달라 전체 적용을 막았습니다. hunk 적용 또는 「현재 원고 기준」으로 전환하세요', 'warn');
      return;
    }
    await ensureSessionSnapshot();
    editorStore.update((s) => ({ ...s, content: active!.content, dirty: active!.content !== s.savedContent }));
    candidateStore.update((s) => ({ ...s, appliedHunks: new Set(diff?.hunks.map((h) => h.id) ?? []) }));
    recordHumanDecision('apply-all', active.label);
    toasts.push('후보 전체 적용됨. 저장 전 검토', 'ok');
    uiStore.update((s) => ({ ...s, centerView: 'write' }));
  }

  async function applyOneHunk(hunkId: string) {
    if (!active || !diff) return;
    if (diffBase === 'baseline' && !editorMatchesBaseline) {
      toasts.push('현재 원고가 baseline과 달라 hunk를 안전하게 적용할 수 없습니다. 「현재 원고 기준」으로 전환 후 다시 시도하세요', 'warn');
      return;
    }
    const hunk = diff.hunks.find((h) => h.id === hunkId);
    if (!hunk) return;
    await ensureSessionSnapshot();
    const next = applyHunk($editorStore.content, hunk);
    editorStore.update((s) => ({ ...s, content: next, dirty: next !== s.savedContent }));
    candidateStore.update((s) => {
      const applied = new Set(s.appliedHunks);
      applied.add(hunkId);
      return { ...s, appliedHunks: applied };
    });
    recordHumanDecision('apply-hunk', `${active.label} · ${hunkId}`);
    toasts.push(`${hunkId} 적용됨`, 'ok');
  }

  async function ensureSessionSnapshot() {
    if (!$editorStore.path) return;
    if ($candidateStore.sessionSnapshotId) return;
    const info = await createSnapshot($projectStore.current?.rootPath || 'sample-project', $editorStore.path, 'before-apply-candidate', $editorStore.content);
    candidateStore.update((s) => ({ ...s, sessionSnapshotId: info.id }));
    toasts.push(`스냅샷 생성됨 ${info.id}`, 'info');
  }

  function discard() {
    recordHumanDecision('discard-candidates', `${$candidateStore.candidates.length}개`);
    candidateStore.set({ candidates: [], activeId: null, generating: false, appliedHunks: new Set(), sessionSnapshotId: null, session: null });
  }
</script>

<div class="cand-panel">
  <div class="cand-toolbar">
    <div class="cand-tabs">
      {#each $candidateStore.candidates as c}
        <button class="cand-tab" class:on={c.id === $candidateStore.activeId} on:click={() => select(c.id)}>
          {c.label}
          {#if candidateScores[c.id] !== undefined}<span class="cand-score">{candidateScores[c.id]}</span>{/if}
        </button>
      {/each}
    </div>
    <div class="cand-actions">
      <button class="ghost tiny" on:click={() => runQAAction('current-editor')} title="현재 에디터 원고를 QA 검사">현재 원고 QA</button>
      <button class="ghost tiny" on:click={() => runQAAction('candidate')} disabled={!active} title="선택된 후보를 QA 검사">선택 후보 QA</button>
      <button class="ghost tiny" on:click={() => runDraftAction('draft')} disabled={$candidateStore.generating}>다시 생성</button>
      <button class="ghost tiny" on:click={discard}>버리기</button>
    </div>
  </div>

  {#if $candidateStore.generating}
    <div class="cand-empty"><div class="spinner"></div> 후보 생성 중…</div>
  {:else if !active}
    <div class="cand-empty">
      <p>후보가 없습니다.</p>
      <p class="muted">파이프라인의 <b>초안 후보</b>를 실행하거나, 에디터에서 <code>/draft</code>를 입력하세요.</p>
      <button on:click={() => runDraftAction('draft')}>후보 생성</button>
    </div>
  {:else}
    <!-- 세션 헤더: 무엇을 기준으로 만들어졌는지 항상 명시 -->
    <div class="session-strip">
      <div class="session-row">
        <span class="label">기준</span>
        <div class="mode-toggle" role="radiogroup" aria-label="diff 기준">
          <button
            class:on={diffBase === 'baseline'}
            disabled={!session}
            title={session ? '후보 생성 시점 원고와 비교' : 'baseline 세션 정보 없음'}
            on:click={() => (diffBase = 'baseline')}
          >baseline{session ? ` · ${shortHash(session.baselineContent)}` : ''}</button>
          <button class:on={diffBase === 'editor'} on:click={() => (diffBase = 'editor')}>현재 원고 · {shortHash($editorStore.content)}</button>
        </div>
        <span class="session-source">{active.source}</span>
        {#if $candidateStore.sessionSnapshotId}
          <span class="snap">스냅샷: {$candidateStore.sessionSnapshotId}</span>
        {/if}
        {#if styleProfile && candidateScores[active.id] !== undefined}
          <span class="style-fit" title="문체 시스템 프리셋 기준 부합도(로컬 채점)">문체 {candidateScores[active.id]}/100 · {styleProfile.name}</span>
        {/if}
      </div>
      {#if session && !editorMatchesBaseline && diffBase === 'baseline'}
        <p class="mismatch">현재 원고가 baseline과 달라졌습니다 · hunk 적용 전에 「현재 원고 기준」으로 전환하세요.</p>
      {/if}
    </div>

    <div class="apply-bar">
      <button class="primary" on:click={applyAll} disabled={diffBase === 'baseline' && !editorMatchesBaseline}>전체 적용 (스냅샷 후)</button>
      <span class="muted small">AI 출력은 후보입니다. 첫 적용 전에 원본이 스냅샷됩니다.</span>
    </div>
    {#if diff}
      <div class="diff-host">
        <DiffView {diff} appliedHunks={$candidateStore.appliedHunks} onApplyHunk={applyOneHunk} />
      </div>
    {/if}
  {/if}
</div>

<style>
  .cand-panel { display: flex; flex-direction: column; min-height: 0; height: 100%; }
  .cand-toolbar { display: flex; justify-content: space-between; align-items: center; padding: 8px 10px; border-bottom: 1px solid var(--line); gap: 8px; }
  .cand-tabs { display: flex; gap: 6px; overflow-x: auto; }
  .cand-tab { padding: 5px 11px; border-radius: 0; background: transparent; border: 0; border-bottom: 2px solid transparent; color: var(--muted); font-size: 12.5px; white-space: nowrap; }
  .cand-tab.on { color: var(--text); border-bottom-color: var(--accent); font-weight: 650; }
  .cand-score { margin-left: 6px; font-variant-numeric: tabular-nums; color: var(--accent); font-size: 11px; font-weight: 700; }
  .cand-actions { display: flex; gap: 4px; flex-wrap: wrap; }
  .tiny { padding: 4px 8px; font-size: 11.5px; }
  .session-strip { padding: 6px 12px; border-bottom: 1px solid var(--line); display: grid; gap: 4px; }
  .session-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; font-size: 11.5px; color: var(--muted); }
  .label { color: var(--faint); font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .07em; }
  .mode-toggle { display: inline-flex; border: 1px solid var(--line-strong); border-radius: 5px; overflow: hidden; }
  .mode-toggle button { padding: 3px 9px; border: 0; background: transparent; color: var(--muted); font-size: 11.5px; font-family: ui-monospace, monospace; }
  .mode-toggle button.on { background: var(--accent-soft); color: var(--text); font-weight: 650; }
  .mode-toggle button:disabled { color: var(--faint); }
  .session-source { color: var(--faint); font-family: ui-monospace, monospace; }
  .snap { color: var(--accent-2); border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; font-family: ui-monospace, monospace; }
  .style-fit { color: var(--accent); border: 1px solid var(--line); border-radius: 4px; padding: 1px 6px; font-variant-numeric: tabular-nums; }
  .mismatch { margin: 0; padding: 5px 8px; border: 1px solid var(--warn); background: var(--warn-soft); color: var(--warn); font-size: 11.5px; }
  .apply-bar { display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  .small { font-size: 11px; }
  .muted { color: var(--muted); }
  .diff-host { min-height: 0; overflow: auto; flex: 1; display: flex; flex-direction: column; }
  .cand-empty { padding: 32px 20px; text-align: center; color: var(--text); display: flex; flex-direction: column; gap: 10px; align-items: center; }
  .cand-empty .muted { color: var(--muted); font-size: 13px; }
  .cand-empty code { background: var(--accent-soft); padding: 1px 6px; border-radius: 4px; font-family: ui-monospace, monospace; }
  .spinner { width: 16px; height: 16px; border: 2px solid var(--line); border-top-color: var(--accent); border-radius: 50%; display: inline-block; animation: spin .7s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
