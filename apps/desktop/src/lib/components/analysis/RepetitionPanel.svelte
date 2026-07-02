<script lang="ts">
  import { analysisStore } from '$lib/stores/analysisStore';
  import { runAnalyzeAction } from '$lib/actions/pipeline';
  import { distribution } from '$lib/domain/reports';
  import type { AnalysisMode } from '$lib/domain/analysis';
  import { gotoLine } from '$lib/stores/editorNavStore';
  import { editorStore } from '$lib/stores/editorStore';

  const KIND_LABEL: Record<string, string> = { word: '반복어', crutch: '상투 반응', 'dialogue-tag': '대사 태그', cliche: 'AI 클리셰' };
  const modes: Array<[AnalysisMode, string]> = [['word', '단어'], ['ending', '문장 끝']];

  $: totalChars = $analysisStore.repetition?.rhythm?.chars || $editorStore.content.length || 1;
  function heat(count: number, max: number): string {
    if (count === 0) return 'var(--chip)';
    const r = Math.min(1, count / (max || 1));
    return `color-mix(in srgb, var(--accent) ${Math.round(24 + r * 50)}%, transparent)`;
  }
  function jumpToOffset(offset: number) {
    const line = $editorStore.content.slice(0, offset).split('\n').length;
    gotoLine(line);
  }
  function firstPositionInBucket(positions: number[], bucket: number, buckets = 24): number | null {
    const len = Math.max(1, totalChars);
    const from = Math.floor((bucket / buckets) * len);
    const to = Math.floor(((bucket + 1) / buckets) * len);
    return positions.find((p) => p >= from && p < to) ?? null;
  }
</script>

<div class="card">
  <div class="kpi">
    <strong>반복 표현 지도</strong>
    <div class="rep-head">
      <div class="seg">
        {#each modes as [m, label]}
          <button class="seg-btn" class:on={$analysisStore.mode === m} on:click={() => runAnalyzeAction(m)}>{label}</button>
        {/each}
      </div>
      <button class="ghost tiny" on:click={() => runAnalyzeAction()} disabled={$analysisStore.running}>{$analysisStore.running ? '...' : '분석'}</button>
    </div>
  </div>

  {#if !$analysisStore.repetition}
    <p class="muted">현재 회차를 분석하면 반복어·상투 반응·대사 태그·AI 클리셰와 문서 내 분포가 표시됩니다.</p>
  {:else}
    {@const terms = $analysisStore.repetition.terms.filter((t) => t.judgment !== 'ok').slice(0, 10)}
    {#if terms.length === 0}
      <p class="muted">임계치를 넘는 반복이 없습니다. 좋은 리듬이에요.</p>
    {/if}
    {#each terms as term}
      {@const dist = distribution(term.positions, totalChars, 24)}
      {@const maxBucket = Math.max(...dist, 1)}
      <div class="term">
        <div class="term-top">
          <span class="term-word">{term.term}</span>
          {#if term.kind && term.kind !== 'word'}<span class="kind {term.kind}">{KIND_LABEL[term.kind]}</span>{/if}
          <span class="term-count">{term.count}</span>
          <span class="j {term.judgment}">{term.judgment}</span>
        </div>
        <div class="strip">
          {#each dist as c, i}
            <button class="cell" style={`background:${heat(c, maxBucket)}`} title={`${c} hits`} on:click={() => { const pos = firstPositionInBucket(term.positions, i); if (pos != null) jumpToOffset(pos); }} aria-label={`bucket ${i}`}></button>
          {/each}
        </div>
      </div>
    {/each}
    {#if $analysisStore.repetition.rhythm}
      <div class="rhythm">
        <span>{totalChars.toLocaleString()} chars</span>
        {#if $analysisStore.repetition.rhythm.paragraphs}<span>· {$analysisStore.repetition.rhythm.paragraphs} ¶</span>{/if}
      </div>
    {/if}
  {/if}
</div>

<style>
  .rep-head { display: flex; align-items: center; gap: 6px; }
  .seg { display: inline-flex; background: var(--hover); border: 1px solid var(--line); border-radius: 8px; padding: 2px; }
  .seg-btn { background: transparent; border: 0; padding: 4px 8px; border-radius: 6px; color: var(--muted); font-size: 11px; }
  .seg-btn.on { background: var(--accent-soft); color: var(--text); }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .muted { color: var(--muted); font-size: 13px; line-height: 1.5; }
  .term { padding: 8px 0; border-bottom: 1px solid var(--line); }
  .term:last-child { border-bottom: 0; }
  .term-top { display: flex; align-items: center; gap: 8px; }
  .term-word { font-size: 13.5px; }
  .kind { font-size: 9px; text-transform: uppercase; letter-spacing: .03em; padding: 2px 6px; border-radius: 5px; color: var(--accent-2); background: var(--accent-2-soft); }
  .kind.cliche { color: var(--bad); background: var(--bad-soft); }
  .kind.dialogue-tag { color: var(--warn); background: var(--warn-soft); }
  .term-count { margin-left: auto; font-variant-numeric: tabular-nums; font-weight: 700; color: var(--muted); }
  .j { font-size: 9.5px; text-transform: uppercase; font-weight: 700; padding: 2px 6px; border-radius: 5px; }
  .j.overused { color: var(--bad); background: var(--bad-soft); }
  .j.watch { color: var(--warn); background: var(--warn-soft); }
  .strip { display: grid; grid-template-columns: repeat(24, 1fr); gap: 2px; margin-top: 6px; height: 14px; }
  .cell { border: 0; border-radius: 2px; padding: 0; cursor: pointer; height: 100%; }
  .cell:hover { outline: 1px solid var(--accent-2); }
  .rhythm { margin-top: 10px; font-size: 11px; color: var(--faint); display: flex; gap: 6px; }
</style>
