<script lang="ts">
  import { exportCompilation } from '$lib/actions/export';
  import type { ExportFormat, ExportScope } from '$lib/actions/export';
  import { statsStore } from '$lib/stores/statsStore';
  import { projectStore } from '$lib/stores/projectStore';
  import { fileTreeStore } from '$lib/stores/fileTreeStore';
  import { listEpisodes } from '$lib/actions/episodes';

  let format: ExportFormat = 'txt';
  let scope: ExportScope = 'all';
  let running = false;
  let lastPath: string | null = null;

  $: root = $projectStore.current?.rootPath || 'sample-project';
  $: episodeCount = listEpisodes($fileTreeStore.nodes).length;
  function daysFrom(proj: Record<string, number>): Array<{ date: string; words: number }> {
    const out: Array<{ date: string; words: number }> = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      out.push({ date: key, words: proj[key] ?? 0 });
    }
    return out;
  }
  $: days = daysFrom($statsStore[root] ?? {});
  $: weekTotal = days.reduce((a, d) => a + d.words, 0);
  $: maxDay = Math.max(1, ...days.map((d) => d.words));

  async function run() {
    running = true;
    try {
      lastPath = await exportCompilation(format, scope);
    } finally {
      running = false;
    }
  }
</script>

<div class="card">
  <div class="kpi"><strong>원고 내보내기</strong><span class="badge">회차 {episodeCount}개</span></div>
  <div class="exp-form">
    <label class="exp-row">
      <span>범위</span>
      <select bind:value={scope}>
        <option value="all">전체 회차 합본</option>
        <option value="current">현재 회차만</option>
      </select>
    </label>
    <label class="exp-row">
      <span>형식</span>
      <select bind:value={format}>
        <option value="txt">TXT (연재 플랫폼 붙여넣기)</option>
        <option value="html">HTML (인쇄·전자책 변환용)</option>
      </select>
    </label>
    <div class="exp-actions">
      <button class="primary" on:click={run} disabled={running}>{running ? '내보내는 중…' : '내보내기'}</button>
      <span class="exp-hint">데스크톱에서는 <code>exports/</code> 폴더에 저장되고, 브라우저에서는 다운로드됩니다. 회차 프런트매터는 자동 제거됩니다.</span>
    </div>
    {#if lastPath}<p class="exp-done">저장됨: {lastPath}</p>{/if}
  </div>
</div>

<div class="card">
  <div class="kpi"><strong>집필 통계</strong><span class="badge">최근 7일 {weekTotal.toLocaleString()} 단어</span></div>
  <div class="stat-bars" role="img" aria-label="최근 7일 집필량">
    {#each days as d}
      <div class="stat-col" title={`${d.date} · ${d.words.toLocaleString()} 단어`}>
        <div class="stat-bar-track"><i style={`height:${Math.round((d.words / maxDay) * 100)}%`}></i></div>
        <span class="stat-day">{d.date.slice(5).replace('-', '/')}</span>
        <span class="stat-num">{d.words > 0 ? d.words.toLocaleString() : '·'}</span>
      </div>
    {/each}
  </div>
  <p class="stat-note">저장할 때마다 늘어난 단어 수가 그 날짜에 누적됩니다.</p>
</div>

<style>
  .exp-form { display: grid; gap: 8px; margin-top: 10px; }
  .exp-row { display: grid; grid-template-columns: 60px minmax(0, 1fr); align-items: center; gap: 10px; }
  .exp-row > span { color: var(--faint); font-size: 10.5px; font-weight: 800; letter-spacing: .09em; text-transform: uppercase; }
  .exp-actions { display: flex; align-items: center; gap: 12px; margin-top: 4px; }
  .exp-hint { color: var(--faint); font-size: 11.5px; line-height: 1.5; }
  .exp-hint code { background: var(--accent-soft); border-radius: 4px; padding: 0 4px; font-family: ui-monospace, monospace; }
  .exp-done { margin: 4px 0 0; color: var(--ok); font-size: 12px; }

  .stat-bars { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; margin-top: 12px; }
  .stat-col { display: grid; gap: 3px; justify-items: center; }
  .stat-bar-track { width: 100%; height: 64px; display: flex; align-items: flex-end; background: var(--chip); border-radius: 5px; overflow: hidden; }
  .stat-bar-track i { display: block; width: 100%; background: var(--accent); border-radius: 5px 5px 0 0; min-height: 0; }
  .stat-day { color: var(--faint); font-size: 9.5px; font-family: ui-monospace, monospace; }
  .stat-num { color: var(--muted); font-size: 10px; font-variant-numeric: tabular-nums; }
  .stat-note { margin: 10px 0 0; color: var(--faint); font-size: 11.5px; }
</style>
