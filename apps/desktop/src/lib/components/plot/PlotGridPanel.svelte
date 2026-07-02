<script lang="ts">
  import { plotStore } from '$lib/stores/plotStore';
  import { loadPlotAction } from '$lib/actions/pipeline';
  import { analyzePlotGrid, tensionValue } from '$lib/domain/plot';
  import type { Tension } from '$lib/domain/plot';

  $: grid = $plotStore.grid;
  $: warnings = grid ? analyzePlotGrid(grid) : [];
  $: filtered = grid ? (plotFilter ? grid.plotlines.filter((p) => p.id === plotFilter) : grid.plotlines) : [];
  let plotFilter = '';

  const tensionColor: Record<Tension, string> = { low: 'var(--muted)', mid: 'var(--warn)', high: 'var(--bad)' };
</script>

<div class="plot-wrap">
  <div class="plot-toolbar">
    <strong>플롯 보드</strong>
    <div class="pt-right">
      <select bind:value={plotFilter} class="filter">
        <option value="">모든 플롯라인</option>
        {#if grid}{#each grid.plotlines as p}<option value={p.id}>{p.label}</option>{/each}{/if}
      </select>
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
          {#each grid.rows as row}
            <tr>
              <td class="scene">
                <div class="scene-title">{row.title}</div>
                <div class="scene-meta">{row.episode} · {row.scene}</div>
              </td>
              <td class="tcell">
                <div class="tension-bars">
                  {#each [1, 2, 3] as lvl}
                    <span class="tbar" class:on={tensionValue(row.tension) >= lvl} style={`background:${tensionValue(row.tension) >= lvl ? tensionColor[row.tension] : ''}`}></span>
                  {/each}
                </div>
              </td>
              {#each filtered as p}
                <td class="beat" class:empty-beat={!row.beats[p.id]}>
                  {#if row.beats[p.id]}<span class="beat-label" style={`border-color:${p.color}44`}>{row.beats[p.id]}</span>{/if}
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
</style>
