<script lang="ts">
  import { plotStore } from '$lib/stores/plotStore';
  import { loadPlotAction, savePlotAction } from '$lib/actions/pipeline';
  import { analyzePlotGrid, tensionValue } from '$lib/domain/plot';
  import type { Tension, PlotRow } from '$lib/domain/plot';

  $: grid = $plotStore.grid;
  $: warnings = grid ? analyzePlotGrid(grid) : [];
  $: filtered = grid ? (plotFilter ? grid.plotlines.filter((p) => p.id === plotFilter) : grid.plotlines) : [];
  let plotFilter = '';
  let editing = false;
  let draggingIndex: number | null = null;
  let dragOverIndex: number | null = null;

  const tensionColor: Record<Tension, string> = { low: 'var(--muted)', mid: 'var(--warn)', high: 'var(--bad)' };
  const tensions: Tension[] = ['low', 'mid', 'high'];
  const tensionLabel: Record<Tension, string> = { low: '낮음', mid: '중간', high: '높음' };

  function mutate(fn: (rows: PlotRow[]) => PlotRow[]) {
    plotStore.update((s) => (s.grid ? { ...s, grid: { ...s.grid, rows: fn(s.grid.rows.map((r) => ({ ...r, beats: { ...r.beats } }))) } } : s));
  }
  function setTitle(i: number, title: string) { mutate((rows) => { rows[i].title = title; return rows; }); }
  function setTension(i: number, t: Tension) { mutate((rows) => { rows[i].tension = t; return rows; }); }
  function setBeat(i: number, plotline: string, value: string) { mutate((rows) => { rows[i].beats[plotline] = value; return rows; }); }
  function removeRow(i: number) { mutate((rows) => rows.filter((_, idx) => idx !== i)); }
  function moveRow(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    mutate((rows) => {
      const next = [...rows];
      const [row] = next.splice(from, 1);
      next.splice(to, 0, row);
      return next;
    });
  }
  function onDragStart(e: DragEvent, i: number) {
    if (!editing) return;
    draggingIndex = i;
    e.dataTransfer?.setData('text/plain', String(i));
    if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move';
  }
  function onDrop(e: DragEvent, i: number) {
    e.preventDefault();
    const raw = e.dataTransfer?.getData('text/plain');
    const from = raw ? parseInt(raw, 10) : draggingIndex;
    if (typeof from === 'number' && Number.isFinite(from)) moveRow(from, i);
    draggingIndex = null;
    dragOverIndex = null;
  }
  function addRow() {
    if (!grid) return;
    const n = grid.rows.length + 1;
    const beats: Record<string, string> = {};
    for (const p of grid.plotlines) beats[p.id] = '';
    const lastEp = grid.rows[grid.rows.length - 1]?.episode ?? 'ep001';
    mutate((rows) => [...rows, { scene: `scene-${String(n).padStart(2, '0')}`, title: '새 장면', episode: lastEp, tension: 'low', beats }]);
  }
  async function saveAndClose() {
    await savePlotAction();
    editing = false;
  }
</script>

<div class="plot-wrap">
  <div class="plot-toolbar">
    <strong>플롯 보드</strong>
    <div class="pt-right">
      <select bind:value={plotFilter} class="filter">
        <option value="">모든 플롯라인</option>
        {#if grid}{#each grid.plotlines as p}<option value={p.id}>{p.label}</option>{/each}{/if}
      </select>
      {#if grid}
        {#if editing}
          <button class="ghost tiny" on:click={addRow}>+ 장면</button>
          <button class="primary tiny" on:click={saveAndClose}>저장</button>
        {:else}
          <button class="ghost tiny" on:click={() => (editing = true)}>편집</button>
        {/if}
      {/if}
      <button class="ghost tiny" on:click={loadPlotAction} disabled={$plotStore.loading}>{$plotStore.loading ? '…' : '불러오기'}</button>
    </div>
  </div>

  {#if !grid}
    <div class="empty">플롯 보드를 불러오면 장면 × 플롯라인 매트릭스가 표시됩니다.</div>
  {:else}
    <div class="grid-scroll">
      <table>
        <thead>
          <tr>
      <th class="corner">장면</th>
            <th class="tcol">긴장</th>
            {#each filtered as p}<th style={`color:${p.color}`}>{p.label}</th>{/each}
          </tr>
        </thead>
        <tbody>
          {#each grid.rows as row, i}
            <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
            <tr
              draggable={editing}
              class:dragging={draggingIndex === i}
              class:drag-over={dragOverIndex === i}
              on:dragstart={(e) => onDragStart(e, i)}
              on:dragover={(e) => { if (editing) { e.preventDefault(); dragOverIndex = i; } }}
              on:dragleave={() => { if (dragOverIndex === i) dragOverIndex = null; }}
              on:drop={(e) => onDrop(e, i)}
              on:dragend={() => { draggingIndex = null; dragOverIndex = null; }}
            >
              <td class="scene">
                {#if editing}
                  <div class="scene-edit">
                    <button class="drag-handle" title="장면 순서 이동" aria-label="장면 순서 이동">↕</button>
                    <input class="cell-input" value={row.title} on:change={(e) => setTitle(i, e.currentTarget.value)} />
                    <button class="row-del" title="장면 삭제" on:click={() => removeRow(i)}>×</button>
                  </div>
                  <div class="scene-meta">{row.episode} · {row.scene}</div>
                {:else}
                  <div class="scene-title">{row.title}</div>
                  <div class="scene-meta">{row.episode} · {row.scene}</div>
                {/if}
              </td>
              <td class="tcell">
                {#if editing}
                  <select class="cell-select" value={row.tension} on:change={(e) => setTension(i, e.currentTarget.value as Tension)}>
                    {#each tensions as t}<option value={t}>{tensionLabel[t]}</option>{/each}
                  </select>
                {:else}
                  <div class="tension-bars">
                    {#each [1, 2, 3] as lvl}
                      <span class="tbar" class:on={tensionValue(row.tension) >= lvl} style={`background:${tensionValue(row.tension) >= lvl ? tensionColor[row.tension] : ''}`}></span>
                    {/each}
                  </div>
                {/if}
              </td>
              {#each filtered as p}
                <td class="beat" class:empty-beat={!row.beats[p.id]}>
                  {#if editing}
                    <input class="cell-input beat-input" placeholder="비움" value={row.beats[p.id] ?? ''} on:change={(e) => setBeat(i, p.id, e.currentTarget.value)} />
                  {:else if row.beats[p.id]}
                    <span class="beat-label" style={`border-color:${p.color}44`}>{row.beats[p.id]}</span>
                  {/if}
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

    {#if warnings.length}
      <div class="warnings">
        <div class="w-head">플롯 경고 {warnings.length}건</div>
        {#each warnings as w}
          <div class="w-item {w.severity}"><span class="dot"></span>{w.message}</div>
        {/each}
      </div>
    {/if}
  {/if}
</div>

<style>
  .plot-wrap { display: flex; flex-direction: column; min-height: 0; height: 100%; max-width: 100%; }
  .plot-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 8px; padding: 4px 2px 10px; flex-wrap: wrap; }
  .pt-right { display: flex; gap: 6px; align-items: center; min-width: 0; }
  .filter { max-width: 190px; background: var(--chip); color: var(--text); border: 1px solid var(--line); border-radius: 8px; padding: 5px 8px; font-size: 11.5px; }
  .tiny { padding: 5px 9px; font-size: 11.5px; }
  .empty { color: var(--muted); padding: 16px 4px; font-size: 13px; }
  .grid-scroll { overflow: auto; max-width: 100%; border: 1px solid var(--line); border-radius: 14px; background: var(--bg-2); min-height: 0; }
  table { border-collapse: separate; border-spacing: 0; width: max-content; min-width: 100%; font-size: 11.5px; }
  th, td { border-bottom: 1px solid var(--line); border-right: 1px solid var(--chip); padding: 7px 8px; text-align: left; vertical-align: middle; white-space: nowrap; }
  th { position: sticky; top: 0; background: var(--pop); font-size: 10.5px; font-weight: 750; z-index: 2; }
  tr.dragging { opacity: .45; }
  tr.drag-over td { border-top: 2px solid var(--accent); }
  .corner, .scene { position: sticky; left: 0; z-index: 3; background: var(--pop); box-shadow: 1px 0 0 var(--line); }
  .scene { z-index: 1; background: var(--bg-2); }
  .corner { min-width: 148px; }
  .tcol { width: 40px; text-align: center; }
  .tcell { text-align: center; }
  .scene-title { max-width: 138px; overflow: hidden; text-overflow: ellipsis; font-weight: 650; }
  .scene-meta { font-size: 9.5px; color: var(--faint); font-family: ui-monospace, monospace; margin-top: 2px; }
  .tension-bars { display: inline-flex; gap: 2px; }
  .tbar { width: 5px; height: 14px; border-radius: 2px; background: var(--line); }
  .beat { min-width: 118px; max-width: 164px; }
  .beat-label { display: inline-block; max-width: 148px; overflow: hidden; text-overflow: ellipsis; font-size: 10.8px; padding: 2px 8px; border-radius: 999px; border: 1px solid; background: var(--hover); }
  .empty-beat { background: var(--bg); }
  .warnings { margin-top: 12px; }
  .w-head { font-size: 11px; text-transform: uppercase; letter-spacing: .05em; color: var(--faint); margin-bottom: 6px; }
  .w-item { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 5px 0; color: var(--muted); }
  .w-item .dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
  .w-item.warn .dot { background: var(--warn); }
  .w-item.info .dot { background: var(--accent-2); }
  .cell-input { width: 100%; min-width: 90px; font-size: 11.5px; padding: 4px 6px; }
  .beat-input { min-width: 104px; }
  .cell-select { font-size: 11px; padding: 3px 4px; }
  .scene-edit { display: flex; gap: 4px; align-items: center; }
  .drag-handle { border: 0; padding: 2px 4px; color: var(--faint); cursor: grab; }
  tr.dragging .drag-handle { cursor: grabbing; }
  .row-del { border: 0; padding: 2px 6px; color: var(--bad); font-size: 13px; }
</style>
